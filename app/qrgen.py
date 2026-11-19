"""Generador autónomo de códigos QR en formato SVG (ISO/IEC 18004, modo Byte).

No requiere librerías externas ni conexión a internet (CDN), permitiendo
generar e imprimir los QR fijos de cada mesa tanto en modo local como en la nube.
"""

# Versiones 1 a 10 en nivel de corrección L: (total_data_codewords, ec_per_block, num_blocks, align_centers)
_VERSIONS_L = {
    1: (19, 7, 1, ()),
    2: (34, 10, 1, (6, 18)),
    3: (55, 15, 1, (6, 22)),
    4: (80, 20, 1, (6, 26)),
    5: (108, 26, 1, (6, 30)),
    6: (136, 18, 2, (6, 34)),
    7: (156, 20, 2, (6, 22, 38)),
    8: (194, 24, 2, (6, 24, 42)),
    9: (232, 30, 2, (6, 26, 46)),
    10: (274, 18, 4, (6, 28, 50)),
}

# Tablas log/exp para GF(256) con polinomio primitivo 0x11D
_EXP = [0] * 512
_LOG = [0] * 256
_x = 1
for _i in range(255):
    _EXP[_i] = _x
    _LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    _EXP[_i] = _EXP[_i - 255]


def _gf_mul(a: int, b: int) -> int:
    if a == 0 or b == 0:
        return 0
    return _EXP[_LOG[a] + _LOG[b]]


def _rs_generator(degree: int) -> list[int]:
    poly = [1]
    for i in range(degree):
        nxt = [0] * (len(poly) + 1)
        root = _EXP[i]
        for j, coef in enumerate(poly):
            nxt[j] ^= coef
            nxt[j + 1] ^= _gf_mul(coef, root)
        poly = nxt
    return poly


def _rs_encode(data: list[int], ec_len: int) -> list[int]:
    gen = _rs_generator(ec_len)
    rem = [0] * ec_len
    for byte in data:
        factor = byte ^ rem[0]
        rem = rem[1:] + [0]
        if factor:
            for i in range(ec_len):
                rem[i] ^= _gf_mul(gen[i + 1], factor)
    return rem


def _format_bits(ecl_bits: int, mask_id: int) -> int:
    data = (ecl_bits << 3) | mask_id
    rem = data << 10
    for i in range(14, 9, -1):
        if (rem >> i) & 1:
            rem ^= 0x537 << (i - 10)
    return ((data << 10) | rem) ^ 0x5412


def _version_bits(version: int) -> int:
    rem = version << 12
    for i in range(17, 11, -1):
        if (rem >> i) & 1:
            rem ^= 0x1F25 << (i - 12)
    return (version << 12) | rem


def _mask_fn(mask_id: int, r: int, c: int) -> bool:
    if mask_id == 0:
        return (r + c) % 2 == 0
    if mask_id == 1:
        return r % 2 == 0
    if mask_id == 2:
        return c % 3 == 0
    if mask_id == 3:
        return (r + c) % 3 == 0
    if mask_id == 4:
        return (r // 2 + c // 3) % 2 == 0
    if mask_id == 5:
        return (r * c) % 2 + (r * c) % 3 == 0
    if mask_id == 6:
        return ((r * c) % 2 + (r * c) % 3) % 2 == 0
    return ((r + c) % 2 + (r * c) % 3) % 2 == 0


def _penalty(mat: list[list[int]]) -> int:
    n = len(mat)
    score = 0
    # Regla 1: corridas de 5+ módulos iguales en filas y columnas
    for r in range(n):
        run_h = 1
        run_v = 1
        for c in range(1, n):
            if mat[r][c] == mat[r][c - 1]:
                run_h += 1
                if run_h == 5:
                    score += 3
                elif run_h > 5:
                    score += 1
            else:
                run_h = 1
            if mat[c][r] == mat[c - 1][r]:
                run_v += 1
                if run_v == 5:
                    score += 3
                elif run_v > 5:
                    score += 1
            else:
                run_v = 1
    # Regla 2: bloques 2x2
    for r in range(n - 1):
        for c in range(n - 1):
            v = mat[r][c]
            if v == mat[r][c + 1] == mat[r + 1][c] == mat[r + 1][c + 1]:
                score += 3
    return score


def build_qr_matrix(text: str) -> list[list[int]]:
    raw = text.encode('utf-8')
    version = None
    for v, (cap, _, _, _) in _VERSIONS_L.items():
        overhead = 3 if v >= 10 else 2
        if len(raw) + overhead <= cap:
            version = v
            break
    if version is None:
        raise ValueError('Texto demasiado largo para generar QR (máx. 271 bytes)')

    data_cap, ec_len, num_blocks, align_pos = _VERSIONS_L[version]

    # Armar flujo de bits: Modo Byte (0100) + longitud (8 bits en V1-9, 16 bits en V10+) + bytes + terminador
    count_bits = 16 if version >= 10 else 8
    bits: list[int] = [0, 1, 0, 0]
    for i in range(count_bits - 1, -1, -1):
        bits.append((len(raw) >> i) & 1)
    for b in raw:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    max_bits = data_cap * 8
    for _ in range(min(4, max_bits - len(bits))):
        bits.append(0)
    while len(bits) % 8 != 0:
        bits.append(0)

    codewords: list[int] = []
    for i in range(0, len(bits), 8):
        val = 0
        for bit in bits[i:i + 8]:
            val = (val << 1) | bit
        codewords.append(val)

    pads = (0xEC, 0x11)
    idx = 0
    while len(codewords) < data_cap:
        codewords.append(pads[idx % 2])
        idx += 1

    # Dividir en bloques Reed-Solomon (soporta 1 o 2 tamaños de bloque según ISO/IEC 18004) e intercalar
    short_len = data_cap // num_blocks
    num_long = data_cap % num_blocks
    num_short = num_blocks - num_long
    data_blocks: list[list[int]] = []
    offset = 0
    for b in range(num_blocks):
        blk_len = short_len + (1 if b >= num_short else 0)
        data_blocks.append(codewords[offset:offset + blk_len])
        offset += blk_len
    ec_blocks = [_rs_encode(blk, ec_len) for blk in data_blocks]

    final_bytes: list[int] = []
    for col in range(short_len):
        for b in range(num_blocks):
            final_bytes.append(data_blocks[b][col])
    for b in range(num_short, num_blocks):
        final_bytes.append(data_blocks[b][short_len])
    for col in range(ec_len):
        for b in range(num_blocks):
            final_bytes.append(ec_blocks[b][col])

    stream: list[int] = []
    for byte in final_bytes:
        for i in range(7, -1, -1):
            stream.append((byte >> i) & 1)

    n = 17 + 4 * version
    base: list[list[int | None]] = [[None] * n for _ in range(n)]
    reserved = [[False] * n for _ in range(n)]

    def set_fn(r: int, c: int, val: int):
        if 0 <= r < n and 0 <= c < n:
            base[r][c] = val
            reserved[r][c] = True

    # Patrones de búsqueda (7x7) + separadores blancos
    for fr, fc in ((0, 0), (0, n - 7), (n - 7, 0)):
        for dr in range(-1, 8):
            for dc in range(-1, 8):
                if 0 <= dr <= 6 and 0 <= dc <= 6:
                    dark = dr in (0, 6) or dc in (0, 6) or (2 <= dr <= 4 and 2 <= dc <= 4)
                    set_fn(fr + dr, fc + dc, 1 if dark else 0)
                else:
                    set_fn(fr + dr, fc + dc, 0)

    # Patrones de alineación (5x5)
    for ar in align_pos:
        for ac in align_pos:
            if reserved[ar][ac]:
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    dark = abs(dr) == 2 or abs(dc) == 2 or (dr == 0 and dc == 0)
                    set_fn(ar + dr, ac + dc, 1 if dark else 0)

    # Líneas de sincronización (timing patterns)
    for i in range(8, n - 8):
        val = 1 if i % 2 == 0 else 0
        if not reserved[6][i]:
            set_fn(6, i, val)
        if not reserved[i][6]:
            set_fn(i, 6, val)

    # Módulo oscuro fijo y reserva de áreas de formato
    set_fn(n - 8, 8, 1)
    for i in range(9):
        if not reserved[8][i]:
            set_fn(8, i, 0)
        if not reserved[i][8]:
            set_fn(i, 8, 0)
    for i in range(8):
        if not reserved[8][n - 1 - i]:
            set_fn(8, n - 1 - i, 0)
    for i in range(7):
        if not reserved[n - 1 - i][8]:
            set_fn(n - 1 - i, 8, 0)

    # Bloques de información de versión (6x3) obligatorios a partir de Versión 7
    if version >= 7:
        vbits = _version_bits(version)
        for i in range(18):
            vbit = (vbits >> i) & 1
            va, vb = i // 3, i % 3
            set_fn(n - 11 + vb, va, vbit)
            set_fn(va, n - 11 + vb, vbit)

    # Ubicar bits de datos en zig-zag de derecha a izquierda
    bit_idx = 0
    upward = True
    col = n - 1
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(n - 1, -1, -1) if upward else range(n)
        for r in rows:
            for dc in (0, -1):
                c = col + dc
                if not reserved[r][c]:
                    base[r][c] = stream[bit_idx] if bit_idx < len(stream) else 0
                    bit_idx += 1
        upward = not upward
        col -= 2

    # Elegir la máscara con menor penalización
    best_mat = None
    best_score = None
    for mask_id in range(8):
        cand = [row[:] for row in base]  # type: ignore[list-item]
        for r in range(n):
            for c in range(n):
                if not reserved[r][c] and _mask_fn(mask_id, r, c):
                    cand[r][c] ^= 1  # type: ignore[operator]
        fmt = _format_bits(0b01, mask_id)  # Nivel L = 01
        # Copia 1 (arriba-izquierda)
        c1_coords = [
            (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5),
            (8, 7), (8, 8), (7, 8),
            (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8),
        ]
        for i, (fr, fc) in enumerate(c1_coords):
            cand[fr][fc] = (fmt >> (14 - i)) & 1
        # Copia 2 (abajo-izquierda + arriba-derecha)
        for i in range(7):
            cand[n - 1 - i][8] = (fmt >> (14 - i)) & 1
        for i in range(8):
            cand[8][n - 8 + i] = (fmt >> (7 - i)) & 1

        sc = _penalty(cand)  # type: ignore[arg-type]
        if best_score is None or sc < best_score:
            best_score = sc
            best_mat = cand

    return best_mat  # type: ignore[return-value]


def qr_svg(text: str, margin: int = 2) -> str:
    mat = build_qr_matrix(text)
    n = len(mat)
    size = n + margin * 2
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" shape-rendering="crispEdges">',
        f'<rect width="{size}" height="{size}" fill="#ffffff"/>',
        '<path fill="#1f1b16" d="',
    ]
    cmds = []
    for r, row in enumerate(mat):
        y = r + margin
        c = 0
        while c < n:
            if row[c]:
                start = c
                while c < n and row[c]:
                    c += 1
                w = c - start
                cmds.append(f'M{start + margin} {y}h{w}v1h-{w}z')
            else:
                c += 1
    parts.append(''.join(cmds))
    parts.append('"/></svg>')
    return ''.join(parts)
