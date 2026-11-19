"""Web Push nativo (RFC 8291 aes128gcm + VAPID RFC 8292) 100% Python stdlib.

Implementa sin dependencias externas (cero pip / cero C extensions):
- Curva eliptica NIST P-256 (secp256r1): claves VAPID y efimeras, ECDH y firma
  ECDSA SHA-256 (ES256 en formato raw r || s de 64 bytes para JWT VAPID).
- AES-128-GCM puro (FIPS 197 + NIST SP 800-38D GHASH en GF(2^128)) + HKDF-SHA256.
- Cifrado y descifrado de payload Web Push RFC 8291 / RFC 8188 (aes128gcm).
- Persistencia automatica de claves VAPID en DATA_DIR / 'vapid_keys.json'.
- Despacho HTTP POST asincrono en segundo plano con limpieza de endpoints 404/410.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import socket
import struct
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable


DEFAULT_VAPID_SUBJECT = os.environ.get('VAPID_SUBJECT') or 'mailto:simonguerenu@gmail.com'
_vapid_lock = threading.Lock()
_PUSH_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix='salelisto-webpush')


# ---------- Base64url (RFC 7515 / RFC 8291 / RFC 8292) ----------

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def b64url_decode(text: str) -> bytes:
    cleaned = text.strip().replace('+', '-').replace('/', '_')
    pad = '=' * ((4 - len(cleaned) % 4) % 4)
    return base64.urlsafe_b64decode(cleaned + pad)


# ---------- Curva Eliptica NIST P-256 (secp256r1 / prime256v1) ----------

P256_P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
P256_A = P256_P - 3
P256_B = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
P256_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
P256_GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296
P256_GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5
P256_G: tuple[int, int] = (P256_GX, P256_GY)

JacPoint = tuple[int, int, int] | None
AffPoint = tuple[int, int] | None


def point_is_on_curve(pt: AffPoint) -> bool:
    if pt is None:
        return False
    x, y = pt
    if not (0 <= x < P256_P and 0 <= y < P256_P):
        return False
    return (y * y - (x * x * x + P256_A * x + P256_B)) % P256_P == 0


def _jac_double(pt: JacPoint) -> JacPoint:
    if pt is None:
        return None
    x1, y1, z1 = pt
    if y1 == 0 or z1 == 0:
        return None
    p = P256_P
    yy = (y1 * y1) % p
    yyyy = (yy * yy) % p
    zz = (z1 * z1) % p
    s = (4 * x1 * yy) % p
    # Como a = -3 mod p: 3*X1^2 + a*Z1^4 = 3*(X1 - Z1^2)*(X1 + Z1^2)
    m = (3 * (x1 - zz) * (x1 + zz)) % p
    x3 = (m * m - 2 * s) % p
    y3 = (m * (s - x3) - 8 * yyyy) % p
    z3 = (2 * y1 * z1) % p
    return (x3, y3, z3)


def _jac_add(p1: JacPoint, p2: JacPoint) -> JacPoint:
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1, z1 = p1
    x2, y2, z2 = p2
    if z1 == 0:
        return p2
    if z2 == 0:
        return p1
    p = P256_P
    z1z1 = (z1 * z1) % p
    z2z2 = (z2 * z2) % p
    u1 = (x1 * z2z2) % p
    u2 = (x2 * z1z1) % p
    s1 = (y1 * z2 * z2z2) % p
    s2 = (y2 * z1 * z1z1) % p
    if u1 == u2:
        if s1 != s2:
            return None
        return _jac_double(p1)
    h = (u2 - u1) % p
    i = (4 * h * h) % p
    j = (h * i) % p
    r = (2 * (s2 - s1)) % p
    v = (u1 * i) % p
    x3 = (r * r - j - 2 * v) % p
    y3 = (r * (v - x3) - 2 * s1 * j) % p
    z3 = (((z1 + z2) * (z1 + z2) - z1z1 - z2z2) * h) % p
    return (x3, y3, z3)


def _jac_to_affine(pt: JacPoint) -> AffPoint:
    if pt is None or pt[2] == 0:
        return None
    x, y, z = pt
    inv_z = pow(z, -1, P256_P)
    inv_z2 = (inv_z * inv_z) % P256_P
    inv_z3 = (inv_z2 * inv_z) % P256_P
    return ((x * inv_z2) % P256_P, (y * inv_z3) % P256_P)


def p256_scalar_mult(k: int, pt: tuple[int, int] = P256_G) -> AffPoint:
    if k % P256_N == 0 and pt == P256_G:
        return None
    if k == 0 or not point_is_on_curve(pt):
        if k == 0:
            return None
        raise ValueError('Punto P-256 fuera de la curva')
    if k < 0:
        k = -k
        pt = (pt[0], (-pt[1]) % P256_P)

    result: JacPoint = None
    addend: JacPoint = (pt[0], pt[1], 1)
    scalar = k
    while scalar > 0:
        if scalar & 1:
            result = _jac_add(result, addend)
        addend = _jac_double(addend)
        scalar >>= 1
    return _jac_to_affine(result)


def p256_point_add(p1: AffPoint, p2: AffPoint) -> AffPoint:
    j1: JacPoint = None if p1 is None else (p1[0], p1[1], 1)
    j2: JacPoint = None if p2 is None else (p2[0], p2[1], 1)
    return _jac_to_affine(_jac_add(j1, j2))


def encode_p256_public(pt: tuple[int, int]) -> bytes:
    if not point_is_on_curve(pt):
        raise ValueError('Clave publica P-256 invalida')
    return b'\x04' + pt[0].to_bytes(32, 'big') + pt[1].to_bytes(32, 'big')


def decode_p256_public(raw: bytes) -> tuple[int, int]:
    if len(raw) == 65 and raw[0] == 0x04:
        x = int.from_bytes(raw[1:33], 'big')
        y = int.from_bytes(raw[33:65], 'big')
        pt = (x, y)
    elif len(raw) == 33 and raw[0] in (0x02, 0x03):
        x = int.from_bytes(raw[1:33], 'big')
        if x >= P256_P:
            raise ValueError('Coordenada X P-256 fuera de rango')
        rhs = (pow(x, 3, P256_P) + P256_A * x + P256_B) % P256_P
        y = pow(rhs, (P256_P + 1) // 4, P256_P)
        if (y & 1) != (raw[0] & 1):
            y = P256_P - y
        pt = (x, y)
    else:
        raise ValueError('Formato de punto P-256 no soportado')

    if not point_is_on_curve(pt):
        raise ValueError('El punto decodificado no pertenece a NIST P-256')
    return pt


def generate_p256_keypair() -> tuple[int, tuple[int, int]]:
    priv = secrets.randbelow(P256_N - 1) + 1
    pub = p256_scalar_mult(priv, P256_G)
    if pub is None:
        raise RuntimeError('Error al generar clave publica P-256')
    return priv, pub


def ecdh_shared_secret(private_scalar: int, peer_public: tuple[int, int] | bytes) -> bytes:
    peer_pt = decode_p256_public(peer_public) if isinstance(peer_public, (bytes, bytearray)) else peer_public
    if not (1 <= private_scalar < P256_N):
        raise ValueError('Clave privada P-256 fuera de rango')
    if not point_is_on_curve(peer_pt):
        raise ValueError('Clave publica remota P-256 invalida')
    shared = p256_scalar_mult(private_scalar, peer_pt)
    if shared is None:
        raise ValueError('Secreto compartido ECDH invalido')
    return shared[0].to_bytes(32, 'big')


def ecdsa_sign_es256(private_scalar: int, message: bytes) -> bytes:
    """Firma ECDSA P-256 con SHA-256 en formato JWS ES256 (64 bytes raw r || s)."""
    if not (1 <= private_scalar < P256_N):
        raise ValueError('Clave privada ECDSA invalida')
    z = int.from_bytes(hashlib.sha256(message).digest(), 'big')
    while True:
        k = secrets.randbelow(P256_N - 1) + 1
        pt = p256_scalar_mult(k, P256_G)
        if pt is None:
            continue
        r = pt[0] % P256_N
        if r == 0:
            continue
        s = (pow(k, -1, P256_N) * (z + r * private_scalar)) % P256_N
        if s == 0:
            continue
        if s > P256_N // 2:
            s = P256_N - s
        return r.to_bytes(32, 'big') + s.to_bytes(32, 'big')


def ecdsa_verify_es256(public_key: tuple[int, int] | bytes, message: bytes, signature: bytes) -> bool:
    try:
        pub_pt = decode_p256_public(public_key) if isinstance(public_key, (bytes, bytearray)) else public_key
    except ValueError:
        return False
    if not point_is_on_curve(pub_pt) or len(signature) != 64:
        return False
    r = int.from_bytes(signature[:32], 'big')
    s = int.from_bytes(signature[32:], 'big')
    if not (1 <= r < P256_N and 1 <= s < P256_N):
        return False
    z = int.from_bytes(hashlib.sha256(message).digest(), 'big')
    w = pow(s, -1, P256_N)
    u1 = (z * w) % P256_N
    u2 = (r * w) % P256_N
    check_pt = p256_point_add(p256_scalar_mult(u1, P256_G), p256_scalar_mult(u2, pub_pt))
    if check_pt is None:
        return False
    return (check_pt[0] % P256_N) == r


# ---------- AES-128 Puro (FIPS 197) + GHASH / AES-128-GCM (NIST SP 800-38D) ----------

def _build_aes_tables() -> tuple[list[int], list[int]]:
    # Construye S-Box oficial de Rijndael en GF(2^8) mod (x^8 + x^4 + x^3 + x + 1)
    def gf_mul(a: int, b: int) -> int:
        p = 0
        for _ in range(8):
            if b & 1:
                p ^= a
            hi = a & 0x80
            a = (a << 1) & 0xFF
            if hi:
                a ^= 0x1B
            b >>= 1
        return p

    sbox = [0] * 256
    for x in range(256):
        if x == 0:
            inv = 0
        else:
            # x^254 en GF(2^8) es el inverso multiplicativo
            inv = 1
            base = x
            exp = 254
            while exp > 0:
                if exp & 1:
                    inv = gf_mul(inv, base)
                base = gf_mul(base, base)
                exp >>= 1
        s = inv
        for shift in (1, 2, 3, 4):
            s ^= ((inv << shift) | (inv >> (8 - shift))) & 0xFF
        sbox[x] = (s ^ 0x63) & 0xFF

    xtime = [((i << 1) ^ 0x1B) & 0xFF if (i & 0x80) else (i << 1) for i in range(256)]
    return sbox, xtime


_AES_SBOX, _AES_XTIME = _build_aes_tables()
_AES_RCON = (0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36)


def _aes128_expand_key(key: bytes) -> list[bytes]:
    if len(key) != 16:
        raise ValueError('AES-128 requiere una clave de 16 bytes')
    words = [list(key[i : i + 4]) for i in range(0, 16, 4)]
    for i in range(4, 44):
        temp = list(words[i - 1])
        if i % 4 == 0:
            temp = [
                _AES_SBOX[temp[1]] ^ _AES_RCON[(i // 4) - 1],
                _AES_SBOX[temp[2]],
                _AES_SBOX[temp[3]],
                _AES_SBOX[temp[0]],
            ]
        prev = words[i - 4]
        words.append([prev[j] ^ temp[j] for j in range(4)])

    round_keys: list[bytes] = []
    for r in range(11):
        rk = []
        for c in range(4):
            rk.extend(words[r * 4 + c])
        round_keys.append(bytes(rk))
    return round_keys


def _aes128_encrypt_block_expanded(block: bytes, round_keys: list[bytes]) -> bytes:
    s = [b ^ k for b, k in zip(block, round_keys[0])]
    sbox = _AES_SBOX
    xt = _AES_XTIME

    for r in range(1, 10):
        # SubBytes + ShiftRows combinado (estado column-major de 16 bytes)
        t0 = sbox[s[0]];  t1 = sbox[s[5]];  t2 = sbox[s[10]]; t3 = sbox[s[15]]
        t4 = sbox[s[4]];  t5 = sbox[s[9]];  t6 = sbox[s[14]]; t7 = sbox[s[3]]
        t8 = sbox[s[8]];  t9 = sbox[s[13]]; t10 = sbox[s[2]]; t11 = sbox[s[7]]
        t12 = sbox[s[12]]; t13 = sbox[s[1]]; t14 = sbox[s[6]]; t15 = sbox[s[11]]

        rk = round_keys[r]
        # MixColumns + AddRoundKey por cada columna
        u = t0 ^ t1 ^ t2 ^ t3
        s0 = t0 ^ u ^ xt[t0 ^ t1] ^ rk[0]
        s1 = t1 ^ u ^ xt[t1 ^ t2] ^ rk[1]
        s2 = t2 ^ u ^ xt[t2 ^ t3] ^ rk[2]
        s3 = t3 ^ u ^ xt[t3 ^ t0] ^ rk[3]

        u = t4 ^ t5 ^ t6 ^ t7
        s4 = t4 ^ u ^ xt[t4 ^ t5] ^ rk[4]
        s5 = t5 ^ u ^ xt[t5 ^ t6] ^ rk[5]
        s6 = t6 ^ u ^ xt[t6 ^ t7] ^ rk[6]
        s7 = t7 ^ u ^ xt[t7 ^ t4] ^ rk[7]

        u = t8 ^ t9 ^ t10 ^ t11
        s8 = t8 ^ u ^ xt[t8 ^ t9] ^ rk[8]
        s9 = t9 ^ u ^ xt[t9 ^ t10] ^ rk[9]
        s10 = t10 ^ u ^ xt[t10 ^ t11] ^ rk[10]
        s11 = t11 ^ u ^ xt[t11 ^ t8] ^ rk[11]

        u = t12 ^ t13 ^ t14 ^ t15
        s12 = t12 ^ u ^ xt[t12 ^ t13] ^ rk[12]
        s13 = t13 ^ u ^ xt[t13 ^ t14] ^ rk[13]
        s14 = t14 ^ u ^ xt[t14 ^ t15] ^ rk[14]
        s15 = t15 ^ u ^ xt[t15 ^ t12] ^ rk[15]

        s = [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15]

    rk10 = round_keys[10]
    return bytes([
        sbox[s[0]] ^ rk10[0],   sbox[s[5]] ^ rk10[1],   sbox[s[10]] ^ rk10[2],  sbox[s[15]] ^ rk10[3],
        sbox[s[4]] ^ rk10[4],   sbox[s[9]] ^ rk10[5],   sbox[s[14]] ^ rk10[6],  sbox[s[3]] ^ rk10[7],
        sbox[s[8]] ^ rk10[8],   sbox[s[13]] ^ rk10[9],  sbox[s[2]] ^ rk10[10],  sbox[s[7]] ^ rk10[11],
        sbox[s[12]] ^ rk10[12], sbox[s[1]] ^ rk10[13],  sbox[s[6]] ^ rk10[14],  sbox[s[11]] ^ rk10[15],
    ])


def aes128_encrypt_block(key: bytes, block: bytes) -> bytes:
    if len(block) != 16:
        raise ValueError('El bloque AES debe tener 16 bytes')
    return _aes128_encrypt_block_expanded(block, _aes128_expand_key(key))


_GCM_R = 0xE1000000000000000000000000000000


def _gf128_mul(x: int, y: int) -> int:
    z = 0
    v = y
    for i in range(127, -1, -1):
        if (x >> i) & 1:
            z ^= v
        if v & 1:
            v = (v >> 1) ^ _GCM_R
        else:
            v >>= 1
    return z


def _ghash(h_int: int, aad: bytes, ciphertext: bytes) -> bytes:
    aad_pad = (-len(aad)) % 16
    ct_pad = (-len(ciphertext)) % 16
    stream = (
        aad
        + (b'\x00' * aad_pad)
        + ciphertext
        + (b'\x00' * ct_pad)
        + struct.pack('>QQ', len(aad) * 8, len(ciphertext) * 8)
    )
    y = 0
    for off in range(0, len(stream), 16):
        blk = int.from_bytes(stream[off : off + 16], 'big')
        y = _gf128_mul(y ^ blk, h_int)
    return y.to_bytes(16, 'big')


def _aes128_gctr(round_keys: list[bytes], icb: bytes, data: bytes) -> bytes:
    if not data:
        return b''
    prefix = icb[:12]
    counter = struct.unpack('>I', icb[12:16])[0]
    out = bytearray(len(data))
    for off in range(0, len(data), 16):
        cb = prefix + struct.pack('>I', counter & 0xFFFFFFFF)
        ks = _aes128_encrypt_block_expanded(cb, round_keys)
        chunk = data[off : off + 16]
        for j, b in enumerate(chunk):
            out[off + j] = b ^ ks[j]
        counter = (counter + 1) & 0xFFFFFFFF
    return bytes(out)


def aes128_gcm_encrypt(key: bytes, nonce: bytes, plaintext: bytes, aad: bytes = b'') -> bytes:
    """Devuelve ciphertext || tag (16 bytes) segun NIST SP 800-38D."""
    if len(key) != 16:
        raise ValueError('AES-128-GCM requiere clave de 16 bytes')
    if len(nonce) != 12:
        raise ValueError('AES-128-GCM requiere nonce de 12 bytes')

    rks = _aes128_expand_key(key)
    h_int = int.from_bytes(_aes128_encrypt_block_expanded(b'\x00' * 16, rks), 'big')
    j0 = nonce + b'\x00\x00\x00\x01'
    icb = nonce + b'\x00\x00\x00\x02'

    ciphertext = _aes128_gctr(rks, icb, plaintext)
    s_tag = _ghash(h_int, aad, ciphertext)
    j0_enc = _aes128_encrypt_block_expanded(j0, rks)
    tag = bytes(a ^ b for a, b in zip(j0_enc, s_tag))
    return ciphertext + tag


def aes128_gcm_decrypt(key: bytes, nonce: bytes, ciphertext_and_tag: bytes, aad: bytes = b'') -> bytes:
    if len(key) != 16 or len(nonce) != 12:
        raise ValueError('Parametros invalidos para AES-128-GCM')
    if len(ciphertext_and_tag) < 16:
        raise ValueError('Ciphertext GCM truncado')

    ciphertext = ciphertext_and_tag[:-16]
    tag = ciphertext_and_tag[-16:]

    rks = _aes128_expand_key(key)
    h_int = int.from_bytes(_aes128_encrypt_block_expanded(b'\x00' * 16, rks), 'big')
    j0 = nonce + b'\x00\x00\x00\x01'
    icb = nonce + b'\x00\x00\x00\x02'

    s_tag = _ghash(h_int, aad, ciphertext)
    j0_enc = _aes128_encrypt_block_expanded(j0, rks)
    expected_tag = bytes(a ^ b for a, b in zip(j0_enc, s_tag))
    if not hmac.compare_digest(expected_tag, tag):
        raise ValueError('Fallo de autenticacion GCM (tag invalido)')
    return _aes128_gctr(rks, icb, ciphertext)


# ---------- HKDF-SHA256 (RFC 5869) + Cifrado Web Push RFC 8291 (aes128gcm) ----------

def hkdf_sha256(salt: bytes, ikm: bytes, info: bytes, length: int) -> bytes:
    if not salt:
        salt = b'\x00' * 32
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    out = b''
    prev = b''
    counter = 1
    while len(out) < length:
        prev = hmac.new(prk, prev + info + bytes([counter]), hashlib.sha256).digest()
        out += prev
        counter += 1
    return out[:length]


def encrypt_webpush_aes128gcm(
    plaintext: bytes,
    ua_public_b64: str,
    auth_secret_b64: str,
    *,
    salt: bytes | None = None,
    as_keypair: tuple[int, tuple[int, int]] | None = None,
    record_size: int = 4096,
) -> bytes:
    """Cifra un mensaje Web Push con Content-Encoding: aes128gcm (RFC 8291 + RFC 8188)."""
    ua_pub_pt = decode_p256_public(b64url_decode(ua_public_b64))
    ua_pub_bytes = encode_p256_public(ua_pub_pt)
    auth_secret = b64url_decode(auth_secret_b64)
    if len(auth_secret) < 12:
        raise ValueError('Secreto auth de suscripcion Push invalido')

    msg_salt = salt if salt is not None else secrets.token_bytes(16)
    if len(msg_salt) != 16:
        raise ValueError('El salt de aes128gcm debe medir 16 bytes')

    as_priv, as_pub_pt = as_keypair if as_keypair is not None else generate_p256_keypair()
    as_pub_bytes = encode_p256_public(as_pub_pt)

    shared_secret = ecdh_shared_secret(as_priv, ua_pub_pt)
    key_info = b'WebPush: info\x00' + ua_pub_bytes + as_pub_bytes
    ikm = hkdf_sha256(auth_secret, shared_secret, key_info, 32)

    cek = hkdf_sha256(msg_salt, ikm, b'Content-Encoding: aes128gcm\x00', 16)
    nonce = hkdf_sha256(msg_salt, ikm, b'Content-Encoding: nonce\x00', 12)

    # RFC 8188: registro final unico delimitado con 0x02
    padded = plaintext + b'\x02'
    if len(padded) + 16 > record_size:
        raise ValueError('El payload Web Push excede el tamano maximo de registro')

    encrypted_record = aes128_gcm_encrypt(cek, nonce, padded, aad=b'')
    header = msg_salt + struct.pack('>IB', record_size, len(as_pub_bytes)) + as_pub_bytes
    return header + encrypted_record


def decrypt_webpush_aes128gcm(
    payload_body: bytes,
    ua_private_scalar: int,
    ua_public_bytes: bytes,
    auth_secret: bytes,
) -> bytes:
    """Descifra un cuerpo RFC 8291 aes128gcm (usado para verificacion end-to-end)."""
    if len(payload_body) < 21 + 65 + 17:
        raise ValueError('Cuerpo aes128gcm demasiado corto')
    salt = payload_body[:16]
    rs, idlen = struct.unpack('>IB', payload_body[16:21])
    if rs < 18 or len(payload_body) < 21 + idlen + 17:
        raise ValueError('Cabecera aes128gcm invalida')

    as_pub_bytes = payload_body[21 : 21 + idlen]
    ciphertext = payload_body[21 + idlen :]

    as_pub_pt = decode_p256_public(as_pub_bytes)
    ua_pub_pt = decode_p256_public(ua_public_bytes)
    ua_pub_uncompressed = encode_p256_public(ua_pub_pt)

    shared_secret = ecdh_shared_secret(ua_private_scalar, as_pub_pt)
    key_info = b'WebPush: info\x00' + ua_pub_uncompressed + encode_p256_public(as_pub_pt)
    ikm = hkdf_sha256(auth_secret, shared_secret, key_info, 32)

    cek = hkdf_sha256(salt, ikm, b'Content-Encoding: aes128gcm\x00', 16)
    nonce = hkdf_sha256(salt, ikm, b'Content-Encoding: nonce\x00', 12)

    padded = aes128_gcm_decrypt(cek, nonce, ciphertext, aad=b'')
    # Quitar ceros de relleno al final hasta el delimitador 0x02
    idx = len(padded) - 1
    while idx >= 0 and padded[idx] == 0x00:
        idx -= 1
    if idx < 0 or padded[idx] != 0x02:
        raise ValueError('Delimitador de registro RFC 8188 (0x02) ausente')
    return padded[:idx]


# ---------- Claves VAPID Persistentes, Proteccion Anti-SSRF y Cabeceras RFC 8292 ----------

def _parse_vapid_pair(priv_b64: str, pub_b64: str) -> dict[str, str] | None:
    priv_bytes = b64url_decode(str(priv_b64 or ''))
    pub_bytes = b64url_decode(str(pub_b64 or ''))
    if len(priv_bytes) != 32:
        return None
    priv_int = int.from_bytes(priv_bytes, 'big')
    if not (1 <= priv_int < P256_N):
        return None
    pub_pt = decode_p256_public(pub_bytes)
    derived_pub = p256_scalar_mult(priv_int, P256_G)
    if derived_pub is None or derived_pub != pub_pt:
        return None
    return {
        'privateKey': b64url_encode(priv_bytes),
        'publicKey': b64url_encode(encode_p256_public(pub_pt)),
    }


def ensure_vapid_keys(data_dir: Path) -> dict[str, str]:
    """Carga VAPID desde variables de entorno o persiste en DATA_DIR/vapid_keys.json."""
    with _vapid_lock:
        env_priv = (os.environ.get('VAPID_PRIVATE_KEY') or '').strip()
        env_pub = (os.environ.get('VAPID_PUBLIC_KEY') or '').strip()
        if env_priv and env_pub:
            try:
                env_pair = _parse_vapid_pair(env_priv, env_pub)
                if env_pair is not None:
                    return env_pair
            except Exception as err:
                sys.stderr.write(f'[webpush] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY invalidas: {err}\n')

        data_dir.mkdir(parents=True, exist_ok=True)
        key_file = data_dir / 'vapid_keys.json'
        if key_file.is_file():
            try:
                saved = json.loads(key_file.read_text(encoding='utf-8'))
                file_pair = _parse_vapid_pair(str(saved.get('privateKey') or ''), str(saved.get('publicKey') or ''))
                if file_pair is not None:
                    return file_pair
            except Exception as err:
                sys.stderr.write(f'[webpush] No se pudo leer vapid_keys.json, regenerando: {err}\n')

        priv_int, pub_pt = generate_p256_keypair()
        vapid = {
            'privateKey': b64url_encode(priv_int.to_bytes(32, 'big')),
            'publicKey': b64url_encode(encode_p256_public(pub_pt)),
        }
        tmp_file = data_dir / f'vapid_keys.{secrets.token_hex(4)}.tmp'
        tmp_file.write_text(json.dumps(vapid, indent=2) + '\n', encoding='utf-8')
        tmp_file.replace(key_file)
        try:
            os.chmod(key_file, 0o600)
        except OSError:
            pass
        return vapid


def _is_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return bool(
        ip.is_global
        and not ip.is_private
        and not ip.is_loopback
        and not ip.is_link_local
        and not ip.is_multicast
        and not ip.is_reserved
        and not ip.is_unspecified
    )


def validate_push_endpoint(endpoint: str, *, resolve_dns: bool = True) -> None:
    """Valida que el endpoint Web Push sea HTTPS publico (bloquea Blind SSRF)."""
    raw = str(endpoint or '').strip()
    if not raw or len(raw) > 2048:
        raise ValueError('Endpoint Web Push invalido')
    parsed = urllib.parse.urlparse(raw)
    allow_local = os.environ.get('WEBPUSH_ALLOW_LOCAL_TEST') == '1'

    if allow_local:
        if parsed.scheme not in ('https', 'http') or not parsed.hostname:
            raise ValueError('Endpoint Web Push invalido')
        return

    if parsed.scheme != 'https':
        raise ValueError('El endpoint Web Push debe usar https://')
    if parsed.username or parsed.password:
        raise ValueError('El endpoint Web Push no puede incluir credenciales')

    host = (parsed.hostname or '').strip().lower().rstrip('.')
    if not host or host == 'localhost' or host.endswith(('.localhost', '.local', '.internal', '.arpa')):
        raise ValueError('Host de endpoint Web Push no permitido')

    try:
        ip_lit = ipaddress.ip_address(host)
    except ValueError:
        ip_lit = None

    if ip_lit is not None:
        if not _is_public_ip(ip_lit):
            raise ValueError('IP privada o interna bloqueada en endpoint Web Push')
        return

    if resolve_dns:
        port = parsed.port or 443
        try:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except OSError as err:
            raise ValueError(f'No se pudo resolver el host Web Push ({host}): {err}') from err
        if not infos:
            raise ValueError('Host Web Push sin registros DNS')
        for info in infos:
            addr_str = str(info[4][0]).split('%', 1)[0]
            ip_obj = ipaddress.ip_address(addr_str)
            if not _is_public_ip(ip_obj):
                raise ValueError('El host Web Push resuelve a una IP no publica (SSRF bloqueado)')


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Bloquea redirecciones HTTP 3xx para impedir salto SSRF hacia redes internas."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, f'Redireccion Web Push bloqueada ({code})', headers, fp)


_PUSH_OPENER = urllib.request.build_opener(_NoRedirectHandler())


def build_vapid_jwt(
    endpoint: str,
    vapid_keys: dict[str, str],
    subject: str = DEFAULT_VAPID_SUBJECT,
    ttl_seconds: int = 43200,
) -> str:
    parsed = urllib.parse.urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError('Endpoint Web Push invalido')
    aud = f'{parsed.scheme}://{parsed.netloc}'
    header = {'typ': 'JWT', 'alg': 'ES256'}
    claims = {
        'aud': aud,
        'exp': int(time.time()) + max(60, min(ttl_seconds, 86400)),
        'sub': subject,
    }
    h_b64 = b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    c_b64 = b64url_encode(json.dumps(claims, separators=(',', ':')).encode('utf-8'))
    signing_input = f'{h_b64}.{c_b64}'.encode('ascii')

    priv_int = int.from_bytes(b64url_decode(vapid_keys['privateKey']), 'big')
    sig = ecdsa_sign_es256(priv_int, signing_input)
    return f'{h_b64}.{c_b64}.{b64url_encode(sig)}'


def send_webpush(
    subscription: dict[str, Any],
    payload: dict[str, Any] | str | bytes,
    vapid_keys: dict[str, str],
    *,
    subject: str = DEFAULT_VAPID_SUBJECT,
    ttl: int = 120,
    timeout: float = 10.0,
) -> tuple[int, str]:
    """Cifra y envia un Web Push real por HTTPS POST al servicio Push del navegador."""
    endpoint = str(subscription.get('endpoint') or '').strip()
    p256dh = str(subscription.get('p256dh') or '').strip()
    auth = str(subscription.get('auth') or '').strip()
    if not endpoint or not p256dh or not auth:
        return 0, 'Suscripcion incompleta'

    try:
        validate_push_endpoint(endpoint, resolve_dns=True)
    except ValueError as err:
        sys.stderr.write(f'[webpush] Endpoint rechazado ({endpoint[:80]}): {err}\n')
        return 0, str(err)

    if isinstance(payload, dict):
        raw_payload = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    elif isinstance(payload, str):
        raw_payload = payload.encode('utf-8')
    else:
        raw_payload = payload

    encrypted_body = encrypt_webpush_aes128gcm(raw_payload, p256dh, auth)
    jwt_token = build_vapid_jwt(endpoint, vapid_keys, subject=subject)
    pub_b64 = vapid_keys['publicKey']

    headers = {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': str(len(encrypted_body)),
        'TTL': str(ttl),
        'Urgency': 'high',
        'Authorization': f'vapid t={jwt_token}, k={pub_b64}',
    }

    req = urllib.request.Request(endpoint, data=encrypted_body, headers=headers, method='POST')
    try:
        with _PUSH_OPENER.open(req, timeout=timeout) as resp:
            status = getattr(resp, 'status', 201)
            return int(status), 'OK'
    except urllib.error.HTTPError as err:
        try:
            detail = err.read(300).decode('utf-8', errors='replace')
        except Exception:
            detail = str(err)
        sys.stderr.write(f'[webpush] HTTP {err.code} desde {endpoint[:80]}: {detail[:120]}\n')
        return int(err.code), detail
    except Exception as err:
        sys.stderr.write(f'[webpush] Error de red hacia {endpoint[:80]}: {err}\n')
        return 0, str(err)


def dispatch_webpush_async(
    deliveries: list[tuple[dict[str, Any], dict[str, Any]]],
    vapid_keys: dict[str, str],
    on_expired: Callable[[str], None] | None = None,
    subject: str = DEFAULT_VAPID_SUBJECT,
) -> None:
    """Despacha entregas Web Push en un ThreadPoolExecutor acotado (max_workers=4)."""
    if not deliveries:
        return

    def _send_one(sub: dict[str, Any], payload: dict[str, Any]) -> None:
        endpoint = str(sub.get('endpoint') or '')
        try:
            status, _ = send_webpush(sub, payload, vapid_keys, subject=subject)
            if status in (404, 410) and endpoint and on_expired is not None:
                on_expired(endpoint)
        except Exception as err:
            sys.stderr.write(f'[webpush] Fallo inesperado despachando push ({endpoint[:80]}): {err}\n')

    for sub, payload in deliveries:
        try:
            _PUSH_EXECUTOR.submit(_send_one, sub, payload)
        except RuntimeError as err:
            sys.stderr.write(f'[webpush] Executor cerrado al encolar push: {err}\n')


# ---------- Auto-Test Criptografico Oficial (NIST + P-256 + RFC 8291) ----------

def self_test() -> None:
    # 1. Vector oficial NIST FIPS 197 Apendice B (AES-128 bloque puro)
    fips_key = bytes.fromhex('2b7e151628aed2a6abf7158809cf4f3c')
    fips_pt = bytes.fromhex('3243f6a8885a308d313198a2e0370734')
    fips_ct_expected = bytes.fromhex('3925841d02dc09fbdc118597196a0b32')
    assert aes128_encrypt_block(fips_key, fips_pt) == fips_ct_expected, 'Fallo vector FIPS 197 AES-128'

    # 2. Vectores oficiales NIST SP 800-38D para AES-128-GCM (Test Cases 2, 3 y 4)
    # Test Case 2
    tc2_out = aes128_gcm_encrypt(bytes(16), bytes(12), bytes(16), b'')
    assert tc2_out == bytes.fromhex(
        '0388dace60b6a392f328c2b971b2fe78'
        'ab6e47d42cec13bdf53a67b21257bddf'
    ), 'Fallo NIST AES-128-GCM Test Case 2'
    assert aes128_gcm_decrypt(bytes(16), bytes(12), tc2_out, b'') == bytes(16)

    # Test Case 3 (64 bytes multi-bloque, sin AAD)
    tc3_key = bytes.fromhex('feffe9928665731c6d6a8f9467308308')
    tc3_iv = bytes.fromhex('cafebabefacedbaddecaf888')
    tc3_pt = bytes.fromhex(
        'd9313225f88406e5a55909c5aff5269a'
        '86a7a9531534f7da2e4c303d8a318a72'
        '1c3c0c95956809532fcf0e2449a6b525'
        'b16aedf5aa0de657ba637b391aafd255'
    )
    tc3_expected = bytes.fromhex(
        '42831ec2217774244b7221b784d0d49c'
        'e3aa212f2c02a4e035c17e2329aca12e'
        '21d514b25466931c7d8f6a5aac84aa05'
        '1ba30b396a0aac973d58e091473f5985'
        '4d5c2af327cd64a62cf35abd2ba6fab4'
    )
    assert aes128_gcm_encrypt(tc3_key, tc3_iv, tc3_pt, b'') == tc3_expected, 'Fallo NIST AES-128-GCM Test Case 3'

    # Test Case 4 (60 bytes con bloque parcial + 20 bytes AAD)
    tc4_key = tc3_key
    tc4_iv = tc3_iv
    tc4_pt = tc3_pt[:60]
    tc4_aad = bytes.fromhex('feedfacedeadbeeffeedfacedeadbeefabaddad2')
    tc4_expected = bytes.fromhex(
        '42831ec2217774244b7221b784d0d49c'
        'e3aa212f2c02a4e035c17e2329aca12e'
        '21d514b25466931c7d8f6a5aac84aa05'
        '1ba30b396a0aac973d58e091'
        '5bc94fbc3221a5db94fae95ae7121a47'
    )
    tc4_out = aes128_gcm_encrypt(tc4_key, tc4_iv, tc4_pt, tc4_aad)
    assert tc4_out == tc4_expected, 'Fallo NIST AES-128-GCM Test Case 4'
    assert aes128_gcm_decrypt(tc4_key, tc4_iv, tc4_out, tc4_aad) == tc4_pt

    tampered = bytearray(tc4_out)
    tampered[-1] ^= 0x01
    try:
        aes128_gcm_decrypt(tc4_key, tc4_iv, bytes(tampered), tc4_aad)
        raise AssertionError('AES-128-GCM acepto un tag adulterado')
    except ValueError:
        pass

    # 3. Curva NIST P-256: orden del subgrupo, ECDH simetrico y firma/verificacion ES256 + JWT VAPID
    assert point_is_on_curve(P256_G), 'Punto generador G no esta en P-256'
    assert p256_scalar_mult(P256_N, P256_G) is None, 'N * G debe ser el punto al infinito'

    priv_a, pub_a = generate_p256_keypair()
    priv_b, pub_b = generate_p256_keypair()
    pub_a_bytes = encode_p256_public(pub_a)
    pub_a_b64 = b64url_encode(pub_a_bytes)
    assert len(pub_a_bytes) == 65 and pub_a_bytes[0] == 0x04
    assert len(pub_a_b64) == 87 and pub_a_b64.startswith('B'), 'Formato VAPID publicKey invalido'

    secret_ab = ecdh_shared_secret(priv_a, pub_b)
    secret_ba = ecdh_shared_secret(priv_b, pub_a)
    assert secret_ab == secret_ba and len(secret_ab) == 32, 'Fallo simetria ECDH P-256'

    sample_msg = b'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJodHRwczovL2ZjbS5nb29nbGVhcGlzLmNvbSJ9'
    sig = ecdsa_sign_es256(priv_a, sample_msg)
    assert len(sig) == 64
    assert ecdsa_verify_es256(pub_a, sample_msg, sig), 'Fallo verificacion ECDSA P-256'
    assert not ecdsa_verify_es256(pub_a, sample_msg + b'x', sig), 'ECDSA acepto mensaje alterado'
    assert not ecdsa_verify_es256(pub_b, sample_msg, sig), 'ECDSA acepto clave publica ajena'

    vapid_pair = {
        'privateKey': b64url_encode(priv_a.to_bytes(32, 'big')),
        'publicKey': pub_a_b64,
    }
    jwt_tok = build_vapid_jwt('https://fcm.googleapis.com/fcm/send/demo-token', vapid_pair)
    jwt_parts = jwt_tok.split('.')
    assert len(jwt_parts) == 3
    assert ecdsa_verify_es256(
        pub_a_bytes,
        f'{jwt_parts[0]}.{jwt_parts[1]}'.encode('ascii'),
        b64url_decode(jwt_parts[2]),
    ), 'Firma JWT VAPID invalida'

    # 4. Cifrado y descifrado completo RFC 8291 (aes128gcm) para Xiaomi Band
    ua_priv, ua_pub = generate_p256_keypair()
    ua_pub_bytes = encode_p256_public(ua_pub)
    ua_auth = secrets.token_bytes(16)
    push_payload = json.dumps(
        {
            'title': '🍳 M4 · Retirar Cocina',
            'body': '2x Ramen Tonkotsu',
            'urgent': True,
        },
        ensure_ascii=False,
    ).encode('utf-8')

    encrypted = encrypt_webpush_aes128gcm(
        push_payload,
        b64url_encode(ua_pub_bytes),
        b64url_encode(ua_auth),
    )
    # Cabecera RFC 8188: 16B salt + 4B rs + 1B idlen(65) + 65B clave efimera = 86 bytes
    rs_hdr, idlen_hdr = struct.unpack('>IB', encrypted[16:21])
    assert rs_hdr == 4096 and idlen_hdr == 65 and encrypted[21] == 0x04
    decrypted = decrypt_webpush_aes128gcm(encrypted, ua_priv, ua_pub_bytes, ua_auth)
    assert decrypted == push_payload, 'Fallo round-trip RFC 8291 aes128gcm'

    # 5. Proteccion anti-Blind-SSRF en endpoints Web Push
    prev_allow = os.environ.pop('WEBPUSH_ALLOW_LOCAL_TEST', None)
    try:
        for blocked_ep in (
            'http://fcm.googleapis.com/fcm/send/token',
            'https://localhost/push/123',
            'https://127.0.0.1:8443/push',
            'https://10.0.0.5/push',
            'https://192.168.1.20/push',
            'https://169.254.169.254/latest/meta-data',
            'https://[::1]/push',
        ):
            try:
                validate_push_endpoint(blocked_ep, resolve_dns=False)
                raise AssertionError(f'Debio bloquearse endpoint SSRF: {blocked_ep}')
            except ValueError:
                pass
        validate_push_endpoint('https://8.8.8.8/fcm/send/demo', resolve_dns=False)
    finally:
        if prev_allow is not None:
            os.environ['WEBPUSH_ALLOW_LOCAL_TEST'] = prev_allow

    print('OK self_test webpush.py: NIST AES-128-GCM + P-256 ECDH/ES256 + VAPID + RFC 8291 + Anti-SSRF verificados.')


if __name__ == '__main__':
    self_test()
