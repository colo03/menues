"""Motor de datos SQLite y lógica de negocio de SaleListo.

Gestiona:
- Bloques/sectores pre-armados del salón y grilla de mesas con token QR fijo.
- Plantel de mozos en vivo con asignación híbrida (pre-asignación por bloque o
  automática por menor carga) y reasignación automática al dar de baja un mozo.
- Ruteo directo y separado de pedidos hacia Cocina y Barra en simultáneo.
- Sesiones reales de mesa para KPIs, arqueo de caja, propinas y cierres seguros.
"""
from __future__ import annotations

import base64
import re
import secrets
import sqlite3
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any


class ActionError(Exception):
    pass


BLOCK_TEMPLATES: list[dict[str, Any]] = [
    {'id': 'interior', 'name': 'Interior', 'icon': '🏠', 'columns': 4, 'prefix': '', 'seats': 4, 'count': 6},
    {'id': 'terraza', 'name': 'Terraza', 'icon': '🌿', 'columns': 3, 'prefix': 'T', 'seats': 4, 'count': 4},
    {'id': 'exterior', 'name': 'Exterior / Vereda', 'icon': '☀️', 'columns': 3, 'prefix': 'E', 'seats': 4, 'count': 4},
    {'id': 'barra', 'name': 'Barra', 'icon': '🍸', 'columns': 4, 'prefix': 'B', 'seats': 2, 'count': 4},
    {'id': 'sector1', 'name': 'Sector 1', 'icon': '📍', 'columns': 4, 'prefix': 'S1-', 'seats': 4, 'count': 4},
    {'id': 'sector2', 'name': 'Sector 2', 'icon': '📍', 'columns': 4, 'prefix': 'S2-', 'seats': 4, 'count': 4},
    {'id': 'patio', 'name': 'Patio', 'icon': '🪴', 'columns': 3, 'prefix': 'P', 'seats': 4, 'count': 4},
    {'id': 'vip', 'name': 'Salón VIP', 'icon': '⭐', 'columns': 2, 'prefix': 'VIP-', 'seats': 6, 'count': 2},
]

ORDER_FLOW = ['nuevo', 'cocina', 'listo', 'entregado']
PAYMENTS = {'Efectivo', 'Tarjeta', 'QR', 'Transferencia'}
TIPS = {0, 5, 10, 15}
STATIONS = {'cocina', 'barra'}
WAITER_COLORS = ['#d9412b', '#2f6bd9', '#2f8a57', '#8b5cf6', '#d97706', '#0d9488', '#db2777', '#4f46e5']

# Etiquetas dietarias permitidas en la carta QR (se guardan separadas por coma)
ITEM_TAGS = ('sin_tacc', 'veggie', 'vegano', 'picante', 'sin_alcohol')
DEFAULT_ITEM_TAGS: dict[str, str] = {
    'Edamame al wok': 'sin_tacc,veggie,vegano',
    'Karaage crujiente': 'picante',
    'Ramen Tonkotsu': 'picante',
    'Ramen Miso Veggie': 'veggie',
    'Okonomiyaki': 'veggie',
    'Roll Philadelphia': 'sin_tacc',
    'Temaki de salmón': 'sin_tacc',
    'Mochi artesanal': 'sin_tacc,veggie',
    'Cheesecake de matcha': 'veggie',
    'Gin Tonic de Yuzu': 'sin_tacc,veggie,vegano',
    'Ramune Original': 'sin_tacc,veggie,vegano,sin_alcohol',
    'Limonada con Jengibre y Menta': 'sin_tacc,veggie,vegano,sin_alcohol',
    'Té Verde Sencha': 'sin_tacc,veggie,vegano,sin_alcohol',
}

LEAD_STATUSES = ('nuevo', 'contactado', 'piloto', 'descartado')


def normalize_tags(raw: Any) -> str:
    """Acepta lista o texto separado por comas y devuelve solo etiquetas válidas, sin duplicados."""
    if isinstance(raw, (list, tuple, set)):
        parts = [str(x) for x in raw]
    else:
        parts = str(raw or '').split(',')
    out: list[str] = []
    for p in parts:
        tag = p.strip().lower().replace(' ', '_').replace('-', '_')
        if tag in ITEM_TAGS and tag not in out:
            out.append(tag)
    # vegano implica veggie para que el filtro rápido lo encuentre siempre
    if 'vegano' in out and 'veggie' not in out:
        out.append('veggie')
    return ','.join(t for t in ITEM_TAGS if t in out)


def split_tags(stored: str) -> list[str]:
    return [t for t in str(stored or '').split(',') if t]


def now_ms() -> int:
    return int(time.time() * 1000)


def start_of_today_ms() -> int:
    now = datetime.now()
    midnight = datetime(now.year, now.month, now.day)
    return int(midnight.timestamp() * 1000)


def clean_text(payload: dict[str, Any], key: str, maxlen: int) -> str:
    return str(payload.get(key) or '').strip()[:maxlen]


def clip_compact(text: str, maxlen: int) -> str:
    norm = ' '.join(str(text or '').split())
    if len(norm) <= maxlen:
        return norm
    return norm[: maxlen - 1].rstrip() + '…'


def table_short_tag(code: str) -> str:
    c = str(code or '?').strip()
    if c and c[0].isdigit():
        return f'M{c}'
    return c


def new_qr_token() -> str:
    alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
    return ''.join(secrets.choice(alphabet) for _ in range(10))


class Database:
    def __init__(self, db_path: Path, uploads_dir: Path):
        self.db_path = db_path
        self.uploads_dir = uploads_dir
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.version = 1
        self._tx_notifications: list[dict[str, Any]] | None = None
        self._pending_push_notifications: list[dict[str, Any]] = []
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA foreign_keys = ON')
        conn.execute('PRAGMA journal_mode = WAL')
        return conn

    def _init_schema(self) -> None:
        with self.lock:
            conn = self._connect()
            try:
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS seqs (
                        prefix TEXT PRIMARY KEY,
                        val INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS restaurant (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        name TEXT NOT NULL,
                        subtitle TEXT NOT NULL DEFAULT '',
                        admin_pin TEXT NOT NULL DEFAULT '1234',
                        assignment_mode TEXT NOT NULL DEFAULT 'hybrid',
                        public_url TEXT NOT NULL DEFAULT '',
                        demo_mode INTEGER NOT NULL DEFAULT 1
                    );

                    CREATE TABLE IF NOT EXISTS blocks (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        template TEXT NOT NULL DEFAULT 'sector1',
                        icon TEXT NOT NULL DEFAULT '📍',
                        columns INTEGER NOT NULL DEFAULT 4,
                        assignment_mode TEXT NOT NULL DEFAULT 'auto',
                        sort_order INTEGER NOT NULL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS tables (
                        id TEXT PRIMARY KEY,
                        block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
                        code TEXT NOT NULL,
                        seats INTEGER NOT NULL DEFAULT 4,
                        qr_token TEXT NOT NULL UNIQUE,
                        active INTEGER NOT NULL DEFAULT 1,
                        sort_order INTEGER NOT NULL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS waiters (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        color TEXT NOT NULL DEFAULT '#d9412b',
                        pin TEXT NOT NULL DEFAULT '',
                        available INTEGER NOT NULL DEFAULT 1,
                        last_assigned_at INTEGER NOT NULL DEFAULT 0,
                        created_at INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS block_waiters (
                        block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
                        waiter_id TEXT NOT NULL REFERENCES waiters(id) ON DELETE CASCADE,
                        PRIMARY KEY (block_id, waiter_id)
                    );

                    CREATE TABLE IF NOT EXISTS categories (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        icon TEXT NOT NULL DEFAULT '🍽️',
                        station TEXT NOT NULL DEFAULT 'cocina',
                        sort_order INTEGER NOT NULL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS items (
                        id TEXT PRIMARY KEY,
                        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL DEFAULT '',
                        price INTEGER NOT NULL DEFAULT 0,
                        emoji TEXT NOT NULL DEFAULT '🍽️',
                        image_url TEXT NOT NULL DEFAULT '',
                        station_override TEXT NOT NULL DEFAULT '',
                        popular INTEGER NOT NULL DEFAULT 0,
                        available INTEGER NOT NULL DEFAULT 1,
                        sort_order INTEGER NOT NULL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS table_sessions (
                        id TEXT PRIMARY KEY,
                        table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
                        waiter_id TEXT REFERENCES waiters(id) ON DELETE SET NULL,
                        status TEXT NOT NULL DEFAULT 'open',
                        opened_at INTEGER NOT NULL,
                        closed_at INTEGER,
                        subtotal INTEGER NOT NULL DEFAULT 0,
                        tip_pct INTEGER NOT NULL DEFAULT 0,
                        tip_amount INTEGER NOT NULL DEFAULT 0,
                        total INTEGER NOT NULL DEFAULT 0,
                        payment_method TEXT NOT NULL DEFAULT '',
                        closed_waiter_name TEXT NOT NULL DEFAULT ''
                    );

                    CREATE TABLE IF NOT EXISTS orders (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
                        table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
                        batch_id TEXT NOT NULL,
                        station TEXT NOT NULL DEFAULT 'cocina',
                        status TEXT NOT NULL DEFAULT 'nuevo',
                        source TEXT NOT NULL DEFAULT 'cliente',
                        cancel_reason TEXT NOT NULL DEFAULT '',
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS order_items (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                        item_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        emoji TEXT NOT NULL,
                        image_url TEXT NOT NULL DEFAULT '',
                        unit_price INTEGER NOT NULL,
                        qty INTEGER NOT NULL,
                        note TEXT NOT NULL DEFAULT ''
                    );

                    CREATE TABLE IF NOT EXISTS calls (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
                        table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
                        waiter_id TEXT REFERENCES waiters(id) ON DELETE SET NULL,
                        type TEXT NOT NULL,
                        reason TEXT NOT NULL DEFAULT '',
                        payment TEXT NOT NULL DEFAULT 'Tarjeta',
                        tip_pct INTEGER NOT NULL DEFAULT 0,
                        status TEXT NOT NULL DEFAULT 'pendiente',
                        created_at INTEGER NOT NULL,
                        attended_at INTEGER
                    );

                    CREATE TABLE IF NOT EXISTS notifications (
                        id TEXT PRIMARY KEY,
                        waiter_id TEXT REFERENCES waiters(id) ON DELETE CASCADE,
                        kind TEXT NOT NULL,
                        table_id TEXT,
                        title TEXT NOT NULL,
                        body TEXT NOT NULL DEFAULT '',
                        short_title TEXT NOT NULL DEFAULT '',
                        short_body TEXT NOT NULL DEFAULT '',
                        read INTEGER NOT NULL DEFAULT 0,
                        created_at INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS push_subscriptions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        waiter_id TEXT NOT NULL REFERENCES waiters(id) ON DELETE CASCADE,
                        endpoint TEXT NOT NULL UNIQUE,
                        p256dh TEXT NOT NULL,
                        auth TEXT NOT NULL,
                        wristband_mode INTEGER NOT NULL DEFAULT 1,
                        created_at INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS leads (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        restaurant_name TEXT,
                        zone TEXT,
                        tables_count TEXT,
                        contact TEXT,
                        plan_interest TEXT,
                        message TEXT,
                        status TEXT NOT NULL DEFAULT 'nuevo',
                        created_at INTEGER NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_sessions_status_closed ON table_sessions(status, closed_at);
                    """
                )
                item_cols = {r['name'] for r in conn.execute('PRAGMA table_info(items)').fetchall()}
                if 'tags' not in item_cols:
                    conn.execute("ALTER TABLE items ADD COLUMN tags TEXT NOT NULL DEFAULT ''")
                    # Base existente: etiquetamos sutilmente los platos clásicos de la carta demo
                    for item_name, tags in DEFAULT_ITEM_TAGS.items():
                        conn.execute(
                            "UPDATE items SET tags = ? WHERE name = ? AND tags = ''",
                            (tags, item_name),
                        )
                notif_cols = {
                    r['name'] for r in conn.execute('PRAGMA table_info(notifications)').fetchall()
                }
                if 'short_title' not in notif_cols:
                    conn.execute("ALTER TABLE notifications ADD COLUMN short_title TEXT NOT NULL DEFAULT ''")
                if 'short_body' not in notif_cols:
                    conn.execute("ALTER TABLE notifications ADD COLUMN short_body TEXT NOT NULL DEFAULT ''")

                row = conn.execute('SELECT id FROM restaurant WHERE id = 1').fetchone()
                if not row:
                    self._seed_factory(conn)
                conn.commit()
            finally:
                conn.close()

    def _next_id(self, conn: sqlite3.Connection, prefix: str) -> str:
        row = conn.execute('SELECT val FROM seqs WHERE prefix = ?', (prefix,)).fetchone()
        nxt = (row['val'] + 1) if row else 1
        conn.execute(
            'INSERT INTO seqs (prefix, val) VALUES (?, ?) ON CONFLICT(prefix) DO UPDATE SET val = excluded.val',
            (prefix, nxt),
        )
        return f'{prefix}{nxt}'

    def _unique_qr_token(self, conn: sqlite3.Connection) -> str:
        while True:
            tok = new_qr_token()
            if not conn.execute('SELECT 1 FROM tables WHERE qr_token = ?', (tok,)).fetchone():
                return tok

    def _seed_factory(self, conn: sqlite3.Connection) -> None:
        conn.executescript(
            """
            DELETE FROM push_subscriptions;
            DELETE FROM notifications;
            DELETE FROM calls;
            DELETE FROM order_items;
            DELETE FROM orders;
            DELETE FROM table_sessions;
            DELETE FROM block_waiters;
            DELETE FROM tables;
            DELETE FROM blocks;
            DELETE FROM waiters;
            DELETE FROM items;
            DELETE FROM categories;
            DELETE FROM restaurant;
            DELETE FROM seqs;
            """
        )
        ts = now_ms()
        conn.execute(
            """
            INSERT INTO restaurant (id, name, subtitle, admin_pin, assignment_mode, public_url, demo_mode)
            VALUES (1, 'Kaiten Bar', 'Cocina Asiática & Barra de Autor', '1234', 'hybrid', '', 1)
            """
        )

        # Mozos iniciales activos
        waiters_seed = [
            ('w1', 'Lucía', '#d9412b', '', 1, ts - 3000),
            ('w2', 'Mateo', '#2f6bd9', '', 1, ts - 2000),
            ('w3', 'Sofía', '#2f8a57', '', 1, ts - 1000),
        ]
        for wid, name, color, pin, avail, last_ts in waiters_seed:
            conn.execute(
                'INSERT INTO waiters (id, name, color, pin, available, last_assigned_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (wid, name, color, pin, avail, last_ts, ts),
            )
        conn.execute("INSERT INTO seqs (prefix, val) VALUES ('w', 3)")

        # Bloques pre-armados del salón
        blocks_seed = [
            ('b1', 'Interior', 'interior', '🏠', 3, 'preassigned', 1),
            ('b2', 'Terraza', 'terraza', '🌿', 2, 'preassigned', 2),
            ('b3', 'Barra', 'barra', '🍸', 4, 'auto', 3),
        ]
        for bid, bname, tpl, icon, cols, amode, order in blocks_seed:
            conn.execute(
                'INSERT INTO blocks (id, name, template, icon, columns, assignment_mode, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (bid, bname, tpl, icon, cols, amode, order),
            )
        conn.execute("INSERT INTO seqs (prefix, val) VALUES ('b', 3)")

        # Pre-asignaciones: Interior -> Lucía y Mateo; Terraza -> Sofía; Barra -> Automático
        for bid, wid in (('b1', 'w1'), ('b1', 'w2'), ('b2', 'w3')):
            conn.execute('INSERT INTO block_waiters (block_id, waiter_id) VALUES (?, ?)', (bid, wid))

        # Mesas con tokens QR fijos únicos
        tables_spec = [
            ('b1', '1', 4), ('b1', '2', 4), ('b1', '3', 2),
            ('b1', '4', 4), ('b1', '5', 6), ('b1', '6', 4),
            ('b2', 'T1', 4), ('b2', 'T2', 4), ('b2', 'T3', 2), ('b2', 'T4', 6),
            ('b3', 'B1', 2), ('b3', 'B2', 2), ('b3', 'B3', 2), ('b3', 'B4', 2),
        ]
        for idx, (bid, code, seats) in enumerate(tables_spec, start=1):
            tid = self._next_id(conn, 't')
            tok = self._unique_qr_token(conn)
            conn.execute(
                'INSERT INTO tables (id, block_id, code, seats, qr_token, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)',
                (tid, bid, code, seats, tok, idx),
            )

        # Categorías con ruteo directo a Cocina o Barra
        cats_seed = [
            ('c1', 'Entradas', '🥟', 'cocina', 1),
            ('c2', 'Principales', '🍜', 'cocina', 2),
            ('c3', 'Sushi', '🍣', 'cocina', 3),
            ('c4', 'Postres', '🍡', 'cocina', 4),
            ('c5', 'Bebidas y Barra', '🍸', 'barra', 5),
        ]
        for cid, cname, icon, station, order in cats_seed:
            conn.execute(
                'INSERT INTO categories (id, name, icon, station, sort_order) VALUES (?, ?, ?, ?, ?)',
                (cid, cname, icon, station, order),
            )
        conn.execute("INSERT INTO seqs (prefix, val) VALUES ('c', 5)")

        # Platos y bebidas iniciales
        items_seed = [
            ('c1', 'Gyozas de cerdo', '6 unidades doradas a la plancha con salsa ponzu.', 6500, '🥟', 1, 1),
            ('c1', 'Edamame al wok', 'Vainas de soja con sal marina y ralladura de lima.', 4200, '🫛', 0, 1),
            ('c1', 'Karaage crujiente', 'Pollo frito estilo japonés con mayo picante de yuzu.', 7800, '🍗', 0, 1),
            ('c2', 'Ramen Tonkotsu', 'Caldo de cerdo 12 h, chashu, ajitama, verdeo y aceite de chile.', 14500, '🍜', 1, 1),
            ('c2', 'Ramen Miso Veggie', 'Caldo cremoso de miso, tofu grillado, maíz y hongos.', 13200, '🥢', 0, 1),
            ('c2', 'Katsudon', 'Milanesa de cerdo panko, huevo y cebolla sobre arroz.', 12800, '🍛', 0, 1),
            ('c2', 'Okonomiyaki', 'Panqueque japonés de repollo con salsa okonomi.', 11500, '🥞', 0, 0),
            ('c3', 'Combinado 12 piezas', 'Selección del sushiman: nigiris y rolls del día.', 18900, '🍣', 1, 1),
            ('c3', 'Roll Philadelphia', '8 piezas de salmón rosado y queso crema.', 10500, '🍙', 0, 1),
            ('c3', 'Temaki de salmón', 'Cono crocante de alga nori con salmón y palta.', 7900, '🌯', 0, 1),
            ('c4', 'Mochi artesanal', '3 unidades: matcha, sésamo tostado y frutilla.', 5600, '🍡', 0, 1),
            ('c4', 'Cheesecake de matcha', 'Porción cremosa con base crocante.', 6200, '🍰', 0, 1),
            ('c5', 'Cerveza Asahi Tirada', 'Pinta bien fría tirada en barra.', 5200, '🍺', 1, 1),
            ('c5', 'Gin Tonic de Yuzu', 'Gin macerado, tónica botánica y piel de cítricos.', 6800, '🍸', 1, 1),
            ('c5', 'Ramune Original', 'Gaseosa japonesa tradicional.', 3800, '🧃', 0, 1),
            ('c5', 'Limonada con Jengibre y Menta', 'Jarra individual recién exprimida.', 3500, '🥤', 0, 1),
            ('c5', 'Té Verde Sencha', 'Tetera caliente en hebras.', 2500, '🍵', 0, 1),
        ]
        for idx, (cid, name, desc, price, emoji, pop, avail) in enumerate(items_seed, start=1):
            iid = self._next_id(conn, 'i')
            conn.execute(
                """
                INSERT INTO items (id, category_id, name, description, price, emoji, image_url, station_override, popular, available, sort_order, tags)
                VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?)
                """,
                (iid, cid, name, desc, price, emoji, pop, avail, idx, DEFAULT_ITEM_TAGS.get(name, '')),
            )

    # ---------- Motor de Asignación y Reasignación de Mozos ----------

    def _add_notification(
        self,
        conn: sqlite3.Connection,
        waiter_id: str | None,
        kind: str,
        table_id: str | None,
        title: str,
        body: str = '',
        short_title: str = '',
        short_body: str = '',
    ) -> dict[str, Any]:
        nid = self._next_id(conn, 'N')
        ts = now_ms()
        s_title = clip_compact(short_title or title, 26)
        s_body = clip_compact(short_body or body, 48)
        conn.execute(
            """
            INSERT INTO notifications (id, waiter_id, kind, table_id, title, body, short_title, short_body, read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (nid, waiter_id, kind, table_id, title, body, s_title, s_body, ts),
        )
        # Conservar las últimas 150 notificaciones para mantener liviano el estado
        conn.execute(
            """
            DELETE FROM notifications
            WHERE id NOT IN (SELECT id FROM notifications ORDER BY created_at DESC LIMIT 150)
            """
        )
        rec = {
            'id': nid,
            'waiterId': waiter_id,
            'kind': kind,
            'tableId': table_id,
            'title': title,
            'body': body,
            'shortTitle': s_title,
            'shortBody': s_body,
            'createdAt': ts,
        }
        if self._tx_notifications is not None:
            self._tx_notifications.append(rec)
        return rec

    def _pick_waiter_for_table(
        self,
        conn: sqlite3.Connection,
        table_id: str,
        exclude_waiter_id: str | None = None,
    ) -> dict[str, Any] | None:
        rest = conn.execute('SELECT assignment_mode FROM restaurant WHERE id = 1').fetchone()
        tbl = conn.execute(
            """
            SELECT t.id, t.block_id, b.assignment_mode AS block_mode
            FROM tables t JOIN blocks b ON b.id = t.block_id
            WHERE t.id = ?
            """,
            (table_id,),
        ).fetchone()
        if not tbl:
            return None

        params: tuple[Any, ...] = (exclude_waiter_id,) if exclude_waiter_id else ()
        where_excl = 'AND id != ?' if exclude_waiter_id else ''
        avail_rows = conn.execute(
            f'SELECT * FROM waiters WHERE available = 1 {where_excl} ORDER BY created_at ASC',
            params,
        ).fetchall()
        if not avail_rows:
            return None

        # Contar cuántas mesas abiertas atiende actualmente cada mozo
        loads_raw = conn.execute(
            "SELECT waiter_id, COUNT(*) AS cnt FROM table_sessions WHERE status = 'open' AND waiter_id IS NOT NULL GROUP BY waiter_id"
        ).fetchall()
        load_map = {r['waiter_id']: r['cnt'] for r in loads_raw}

        pool = [dict(r) for r in avail_rows]
        if rest['assignment_mode'] == 'hybrid' and tbl['block_mode'] == 'preassigned':
            assigned_ids = {
                r['waiter_id']
                for r in conn.execute('SELECT waiter_id FROM block_waiters WHERE block_id = ?', (tbl['block_id'],)).fetchall()
            }
            sector_pool = [w for w in pool if w['id'] in assigned_ids]
            if sector_pool:
                pool = sector_pool

        pool.sort(key=lambda w: (load_map.get(w['id'], 0), w['last_assigned_at'], w['id']))
        chosen = pool[0]
        conn.execute('UPDATE waiters SET last_assigned_at = ? WHERE id = ?', (now_ms(), chosen['id']))
        return chosen

    def _ensure_open_session(
        self,
        conn: sqlite3.Connection,
        table_id: str,
        preferred_waiter_id: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any] | None, bool]:
        """Devuelve (session, waiter_dict_or_None, was_just_assigned)."""
        sess = conn.execute(
            "SELECT * FROM table_sessions WHERE table_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
            (table_id,),
        ).fetchone()

        if sess:
            sess_d = dict(sess)
            if sess_d['waiter_id']:
                w = conn.execute('SELECT * FROM waiters WHERE id = ?', (sess_d['waiter_id'],)).fetchone()
                if w and w['available']:
                    return sess_d, dict(w), False
            # Si no tenía mozo (o había quedado huérfana), intentar asignar ahora
            chosen = None
            if preferred_waiter_id:
                pw = conn.execute('SELECT * FROM waiters WHERE id = ? AND available = 1', (preferred_waiter_id,)).fetchone()
                if pw:
                    chosen = dict(pw)
            if not chosen:
                chosen = self._pick_waiter_for_table(conn, table_id)
            if chosen:
                conn.execute('UPDATE table_sessions SET waiter_id = ? WHERE id = ?', (chosen['id'], sess_d['id']))
                conn.execute(
                    "UPDATE calls SET waiter_id = ? WHERE session_id = ? AND status != 'atendida'",
                    (chosen['id'], sess_d['id']),
                )
                sess_d['waiter_id'] = chosen['id']
                return sess_d, chosen, True
            return sess_d, None, False

        # Abrir nueva sesión para la mesa
        chosen = None
        if preferred_waiter_id:
            pw = conn.execute('SELECT * FROM waiters WHERE id = ? AND available = 1', (preferred_waiter_id,)).fetchone()
            if pw:
                chosen = dict(pw)
                conn.execute('UPDATE waiters SET last_assigned_at = ? WHERE id = ?', (now_ms(), chosen['id']))
        if not chosen:
            chosen = self._pick_waiter_for_table(conn, table_id)

        sid = self._next_id(conn, 'S')
        ts = now_ms()
        wid = chosen['id'] if chosen else None
        conn.execute(
            'INSERT INTO table_sessions (id, table_id, waiter_id, status, opened_at) VALUES (?, ?, ?, ?, ?)',
            (sid, table_id, wid, 'open', ts),
        )
        new_sess = dict(conn.execute('SELECT * FROM table_sessions WHERE id = ?', (sid,)).fetchone())
        return new_sess, chosen, bool(chosen)

    def _redistribute_from_waiter(
        self,
        conn: sqlite3.Connection,
        old_waiter_id: str,
        old_waiter_name: str,
    ) -> list[dict[str, str]]:
        open_sessions = conn.execute(
            """
            SELECT s.id, s.table_id, t.code AS table_code, b.name AS block_name
            FROM table_sessions s
            JOIN tables t ON t.id = s.table_id
            JOIN blocks b ON b.id = t.block_id
            WHERE s.status = 'open' AND s.waiter_id = ?
            ORDER BY s.opened_at ASC
            """,
            (old_waiter_id,),
        ).fetchall()

        transfers: list[dict[str, str]] = []
        for s in open_sessions:
            new_w = self._pick_waiter_for_table(conn, s['table_id'], exclude_waiter_id=old_waiter_id)
            new_wid = new_w['id'] if new_w else None
            conn.execute('UPDATE table_sessions SET waiter_id = ? WHERE id = ?', (new_wid, s['id']))
            conn.execute(
                "UPDATE calls SET waiter_id = ? WHERE session_id = ? AND status != 'atendida'",
                (new_wid, s['id']),
            )
            tag = table_short_tag(s['table_code'])
            if new_w:
                self._add_notification(
                    conn,
                    new_w['id'],
                    'table_transferred',
                    s['table_id'],
                    f"🔄 Mesa {s['table_code']} ({s['block_name']}) ahora está a tu cargo",
                    f"Reasignada automáticamente porque {old_waiter_name} dejó de estar disponible.",
                    short_title=f"🔄 {tag} · A tu cargo",
                    short_body=f"Sector {s['block_name']}",
                )
                transfers.append({'tableCode': s['table_code'], 'waiterName': new_w['name']})
            else:
                self._add_notification(
                    conn,
                    None,
                    'table_unassigned',
                    s['table_id'],
                    f"⚠️ Mesa {s['table_code']} quedó sin mozo asignado",
                    'No quedan mozos disponibles en turno.',
                    short_title=f"⚠️ {tag} · Sin mozo",
                    short_body='Sin mozos en turno',
                )
                transfers.append({'tableCode': s['table_code'], 'waiterName': 'Sin mozo disponible'})
        return transfers

    def _adopt_orphan_sessions(self, conn: sqlite3.Connection) -> None:
        orphans = conn.execute(
            """
            SELECT s.id, s.table_id, t.code AS table_code, b.name AS block_name
            FROM table_sessions s
            JOIN tables t ON t.id = s.table_id
            JOIN blocks b ON b.id = t.block_id
            WHERE s.status = 'open' AND s.waiter_id IS NULL
            ORDER BY s.opened_at ASC
            """
        ).fetchall()
        for s in orphans:
            new_w = self._pick_waiter_for_table(conn, s['table_id'])
            if new_w:
                tag = table_short_tag(s['table_code'])
                conn.execute('UPDATE table_sessions SET waiter_id = ? WHERE id = ?', (new_w['id'], s['id']))
                conn.execute(
                    "UPDATE calls SET waiter_id = ? WHERE session_id = ? AND status != 'atendida'",
                    (new_w['id'], s['id']),
                )
                self._add_notification(
                    conn,
                    new_w['id'],
                    'table_transferred',
                    s['table_id'],
                    f"🪑 Mesa {s['table_code']} ({s['block_name']}) asignada a vos",
                    'Tenía consumos activos esperando mozo disponible.',
                    short_title=f"🪑 {tag} · Asignada",
                    short_body=f"Sector {s['block_name']}",
                )

    def _session_subtotal(self, conn: sqlite3.Connection, session_id: str) -> int:
        row = conn.execute(
            """
            SELECT COALESCE(SUM(oi.unit_price * oi.qty), 0) AS sub
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            WHERE o.session_id = ? AND o.status != 'cancelado'
            """,
            (session_id,),
        ).fetchone()
        return int(row['sub'] or 0)

    def _save_uploaded_image(self, item_id: str, data_url: str) -> str:
        m = re.match(r'^data:image/(jpeg|jpg|png|webp);base64,(.+)$', data_url, re.IGNORECASE | re.DOTALL)
        if not m:
            raise ActionError('Formato de imagen inválido')
        ext = 'jpg' if m.group(1).lower() in ('jpeg', 'jpg') else m.group(1).lower()
        raw = base64.b64decode(m.group(2))
        if len(raw) > 2_500_000:
            raise ActionError('La imagen supera el tamaño máximo (2.5 MB)')
        fname = f'{item_id}_{now_ms()}.{ext}'
        (self.uploads_dir / fname).write_bytes(raw)
        return f'uploads/{fname}'

    # ---------- Resolución de Mesa (por Token QR o ID interno) ----------

    def _resolve_table(self, conn: sqlite3.Connection, payload: dict[str, Any], allow_inactive: bool = False) -> dict[str, Any]:
        qr_token = str(payload.get('qrToken') or '').strip()
        table_id = str(payload.get('tableId') or '').strip()
        if qr_token:
            row = conn.execute(
                """
                SELECT t.*, b.name AS block_name, b.icon AS block_icon
                FROM tables t JOIN blocks b ON b.id = t.block_id
                WHERE t.qr_token = ?
                """,
                (qr_token,),
            ).fetchone()
        elif table_id:
            row = conn.execute(
                """
                SELECT t.*, b.name AS block_name, b.icon AS block_icon
                FROM tables t JOIN blocks b ON b.id = t.block_id
                WHERE t.id = ?
                """,
                (table_id,),
            ).fetchone()
        else:
            raise ActionError('Mesa no especificada')

        if not row:
            raise ActionError('Mesa inexistente o código QR vencido')
        if not allow_inactive and not row['active']:
            raise ActionError('Esta mesa se encuentra deshabilitada temporalmente')
        return dict(row)

    # ---------- Acciones Operativas (Pedidos, Llamados, Cierres) ----------

    def act_order_create(self, conn: sqlite3.Connection, p: dict[str, Any], is_staff: bool = False) -> dict[str, Any]:
        demo_row = conn.execute('SELECT demo_mode FROM restaurant WHERE id = 1').fetchone()
        demo_on = bool(demo_row and demo_row['demo_mode'])
        if not is_staff and not p.get('qrToken') and not (demo_on and p.get('tableId')):
            raise ActionError('Código QR de mesa requerido')
        tbl = self._resolve_table(conn, p)
        raw_lines = p.get('items') or []
        if not isinstance(raw_lines, list) or not raw_lines:
            raise ActionError('El pedido está vacío')

        by_station: dict[str, list[dict[str, Any]]] = {'barra': [], 'cocina': []}
        for line in raw_lines:
            iid = str(line.get('itemId') or '')
            item = conn.execute(
                """
                SELECT i.*, c.station AS cat_station
                FROM items i JOIN categories c ON c.id = i.category_id
                WHERE i.id = ?
                """,
                (iid,),
            ).fetchone()
            if not item:
                raise ActionError('Uno de los platos ya no existe en el menú')
            if not item['available']:
                raise ActionError(f"{item['name']} se acaba de agotar")
            try:
                qty = int(line.get('qty') or 0)
            except (TypeError, ValueError):
                raise ActionError('Cantidad inválida')
            if not 1 <= qty <= 30:
                raise ActionError('Cantidad inválida (1 a 30)')

            station = item['station_override'] if item['station_override'] in STATIONS else item['cat_station']
            if station not in STATIONS:
                station = 'cocina'
            by_station[station].append(
                {
                    'item_id': item['id'],
                    'name': item['name'],
                    'emoji': item['emoji'],
                    'image_url': item['image_url'],
                    'unit_price': int(item['price']),
                    'qty': qty,
                    'note': clean_text(line, 'note', 100),
                }
            )

        preferred_wid = str(p.get('waiterId') or '').strip() if is_staff else None
        session, waiter, newly_assigned = self._ensure_open_session(conn, tbl['id'], preferred_wid or None)

        batch_id = self._next_id(conn, 'R')
        ts = now_ms()
        source = clean_text(p, 'source', 16) if is_staff else 'cliente'
        if source not in ('cliente', 'mozo', 'caja'):
            source = 'cliente'

        created_ids: list[str] = []
        stations_used: list[str] = []
        for st in ('barra', 'cocina'):
            lines = by_station[st]
            if not lines:
                continue
            oid = self._next_id(conn, 'P')
            conn.execute(
                """
                INSERT INTO orders (id, session_id, table_id, batch_id, station, status, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'nuevo', ?, ?, ?)
                """,
                (oid, session['id'], tbl['id'], batch_id, st, source, ts, ts),
            )
            for ln in lines:
                conn.execute(
                    """
                    INSERT INTO order_items (order_id, item_id, name, emoji, image_url, unit_price, qty, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (oid, ln['item_id'], ln['name'], ln['emoji'], ln['image_url'], ln['unit_price'], ln['qty'], ln['note']),
                )
            created_ids.append(oid)
            stations_used.append('Barra' if st == 'barra' else 'Cocina')

        summary_items = ', '.join(
            f"{ln['qty']}× {ln['name']}" for st in ('barra', 'cocina') for ln in by_station[st]
        )[:90]
        compact_items = ', '.join(
            f"{ln['qty']}x {ln['name']}" for st in ('barra', 'cocina') for ln in by_station[st]
        )
        dest_label = ' + '.join(stations_used)
        if waiter:
            prefix_msg = 'Asignada a vos · ' if newly_assigned else ''
            if source != 'mozo':
                tag = table_short_tag(tbl['code'])
                self._add_notification(
                    conn,
                    waiter['id'],
                    'new_order',
                    tbl['id'],
                    f"🆕 Mesa {tbl['code']} ({tbl['block_name']}) pidió a {dest_label}",
                    f"{prefix_msg}{summary_items}",
                    short_title=f"🆕 {tag} · Nuevo pedido",
                    short_body=compact_items,
                )

        return {
            'orderIds': created_ids,
            'waiterName': waiter['name'] if waiter else None,
            'stations': stations_used,
        }

    def _notify_order_ready(self, conn: sqlite3.Connection, order: sqlite3.Row) -> None:
        oid = order['id']
        items = conn.execute('SELECT qty, name FROM order_items WHERE order_id = ?', (oid,)).fetchall()
        desc = ', '.join(f"{r['qty']}× {r['name']}" for r in items)[:90]
        compact_desc = ', '.join(f"{r['qty']}x {r['name']}" for r in items)
        tag = table_short_tag(order['table_code'])
        is_bar = order['station'] == 'barra'
        st_title = '🍸 BARRA' if is_bar else '🍳 COCINA'
        short_hdr = f"🍸 {tag} · Retirar Barra" if is_bar else f"🍳 {tag} · Retirar Cocina"
        self._add_notification(
            conn,
            order['waiter_id'],
            'order_ready',
            order['table_id'],
            f"🔔 Retirar en {st_title} → Mesa {order['table_code']} ({order['block_name']})",
            desc,
            short_title=short_hdr,
            short_body=compact_desc,
        )

    def act_order_advance(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        oid = str(p.get('id') or p.get('orderId') or '')
        order = conn.execute(
            """
            SELECT o.*, s.waiter_id, t.code AS table_code, b.name AS block_name
            FROM orders o
            JOIN table_sessions s ON s.id = o.session_id
            JOIN tables t ON t.id = o.table_id
            JOIN blocks b ON b.id = t.block_id
            WHERE o.id = ?
            """,
            (oid,),
        ).fetchone()
        if not order:
            raise ActionError('Pedido inexistente')
        if order['status'] == 'cancelado':
            raise ActionError('El pedido está anulado')

        idx = ORDER_FLOW.index(order['status'])
        if idx < len(ORDER_FLOW) - 1:
            new_status = ORDER_FLOW[idx + 1]
            conn.execute('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', (new_status, now_ms(), oid))
            if new_status == 'listo':
                self._notify_order_ready(conn, order)
            return {'id': oid, 'status': new_status}
        return {'id': oid, 'status': order['status']}

    def act_order_status(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        oid = str(p.get('orderId') or p.get('id') or '')
        new_status = str(p.get('status') or '').strip()
        if new_status == 'cancelado':
            return self.act_order_cancel(conn, {'id': oid, 'reason': p.get('reason') or ''})
        if new_status not in ORDER_FLOW:
            raise ActionError('Estado de pedido inválido')
        order = conn.execute(
            """
            SELECT o.*, s.waiter_id, t.code AS table_code, b.name AS block_name
            FROM orders o
            JOIN table_sessions s ON s.id = o.session_id
            JOIN tables t ON t.id = o.table_id
            JOIN blocks b ON b.id = t.block_id
            WHERE o.id = ?
            """,
            (oid,),
        ).fetchone()
        if not order:
            raise ActionError('Pedido inexistente')
        prev_status = order['status']
        conn.execute(
            "UPDATE orders SET status = ?, cancel_reason = '', updated_at = ? WHERE id = ?",
            (new_status, now_ms(), oid),
        )
        if prev_status != 'listo' and new_status == 'listo':
            self._notify_order_ready(conn, order)
        return {'id': oid, 'status': new_status}

    def act_order_revert(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        oid = str(p.get('id') or p.get('orderId') or '')
        order = conn.execute('SELECT id, status FROM orders WHERE id = ?', (oid,)).fetchone()
        if not order:
            raise ActionError('Pedido inexistente')
        if order['status'] == 'cancelado':
            conn.execute("UPDATE orders SET status = 'nuevo', cancel_reason = '', updated_at = ? WHERE id = ?", (now_ms(), oid))
            return {'status': 'nuevo'}
        idx = ORDER_FLOW.index(order['status'])
        if idx > 0:
            new_status = ORDER_FLOW[idx - 1]
            conn.execute('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', (new_status, now_ms(), oid))
            return {'status': new_status}
        return {'status': order['status']}

    def act_order_cancel(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        oid = str(p.get('id') or p.get('orderId') or '')
        order = conn.execute(
            """
            SELECT o.*, s.waiter_id, t.code AS table_code, b.name AS block_name
            FROM orders o
            JOIN table_sessions s ON s.id = o.session_id
            JOIN tables t ON t.id = o.table_id
            JOIN blocks b ON b.id = t.block_id
            WHERE o.id = ?
            """,
            (oid,),
        ).fetchone()
        if not order:
            raise ActionError('Pedido inexistente')
        reason = clean_text(p, 'reason', 80) or 'Anulado por el restaurante'
        conn.execute(
            "UPDATE orders SET status = 'cancelado', cancel_reason = ?, updated_at = ? WHERE id = ?",
            (reason, now_ms(), oid),
        )
        if order['waiter_id']:
            tag = table_short_tag(order['table_code'])
            self._add_notification(
                conn,
                order['waiter_id'],
                'order_cancelled',
                order['table_id'],
                f"✕ Pedido #{oid[1:]} de Mesa {order['table_code']} anulado",
                reason,
                short_title=f"✕ {tag} · Anulado #{oid[1:]}",
                short_body=reason,
            )
        return {'id': oid, 'status': 'cancelado'}

    def act_call_create(self, conn: sqlite3.Connection, p: dict[str, Any], is_staff: bool = False) -> dict[str, Any]:
        demo_row = conn.execute('SELECT demo_mode FROM restaurant WHERE id = 1').fetchone()
        demo_on = bool(demo_row and demo_row['demo_mode'])
        if not is_staff and not p.get('qrToken') and not (demo_on and p.get('tableId')):
            raise ActionError('Código QR de mesa requerido')
        tbl = self._resolve_table(conn, p)
        kind = str(p.get('type') or '')
        if kind not in ('mozo', 'cuenta'):
            raise ActionError('Tipo de solicitud inválido')

        session, waiter, _ = self._ensure_open_session(conn, tbl['id'])
        tag = table_short_tag(tbl['code'])

        if kind == 'mozo':
            reason = clean_text(p, 'reason', 40) or 'Consulta'
            existing = conn.execute(
                "SELECT id FROM calls WHERE session_id = ? AND type = 'mozo' AND status != 'atendida' LIMIT 1",
                (session['id'],),
            ).fetchone()
            if existing:
                conn.execute('UPDATE calls SET reason = ?, status = ? WHERE id = ?', (reason, 'pendiente', existing['id']))
                cid = existing['id']
            else:
                cid = self._next_id(conn, 'L')
                conn.execute(
                    """
                    INSERT INTO calls (id, session_id, table_id, waiter_id, type, reason, status, created_at)
                    VALUES (?, ?, ?, ?, 'mozo', ?, 'pendiente', ?)
                    """,
                    (cid, session['id'], tbl['id'], session['waiter_id'], reason, now_ms()),
                )
            self._add_notification(
                conn,
                session['waiter_id'],
                'call_mozo',
                tbl['id'],
                f"🙋 Mesa {tbl['code']} ({tbl['block_name']}) llama al mozo",
                f"Motivo: {reason}",
                short_title=f"🙋 {tag} · Llama",
                short_body=reason,
            )
            return {'id': cid, 'waiterName': waiter['name'] if waiter else None}

        # Solicitud de cuenta
        sub = self._session_subtotal(conn, session['id'])
        if sub <= 0:
            raise ActionError('Todavía no hay consumos activos en esta mesa')
        payment = str(p.get('payment') or 'Tarjeta')
        try:
            tip_pct = int(p.get('tip') or 0)
        except (TypeError, ValueError):
            raise ActionError('Propina inválida')
        if payment not in PAYMENTS or tip_pct not in TIPS:
            raise ActionError('Medio de pago o propina inválidos')

        existing = conn.execute(
            "SELECT id FROM calls WHERE session_id = ? AND type = 'cuenta' AND status != 'atendida' LIMIT 1",
            (session['id'],),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE calls SET payment = ?, tip_pct = ?, status = 'pendiente' WHERE id = ?",
                (payment, tip_pct, existing['id']),
            )
            cid = existing['id']
        else:
            cid = self._next_id(conn, 'L')
            conn.execute(
                """
                INSERT INTO calls (id, session_id, table_id, waiter_id, type, payment, tip_pct, status, created_at)
                VALUES (?, ?, ?, ?, 'cuenta', ?, ?, 'pendiente', ?)
                """,
                (cid, session['id'], tbl['id'], session['waiter_id'], payment, tip_pct, now_ms()),
            )

        total_est = round(sub * (1 + tip_pct / 100))
        total_fmt = f"${total_est:,}".replace(',', '.')
        self._add_notification(
            conn,
            session['waiter_id'],
            'call_cuenta',
            tbl['id'],
            f"💳 Mesa {tbl['code']} ({tbl['block_name']}) pide la cuenta",
            f"{payment} · Propina {tip_pct}% · Total {total_fmt}",
            short_title=f"💳 {tag} · {payment}",
            short_body=f"{total_fmt} (Propina {tip_pct}%)",
        )
        return {'id': cid}

    def act_call_status(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        cid = str(p.get('id') or p.get('callId') or '')
        new_st = str(p.get('status') or 'atendida')
        if new_st not in ('en_camino', 'atendida'):
            raise ActionError('Estado inválido')
        row = conn.execute('SELECT id FROM calls WHERE id = ?', (cid,)).fetchone()
        if not row:
            raise ActionError('Solicitud inexistente')
        att_at = now_ms() if new_st == 'atendida' else None
        conn.execute('UPDATE calls SET status = ?, attended_at = COALESCE(?, attended_at) WHERE id = ?', (new_st, att_at, cid))
        return {'id': cid, 'status': new_st}

    def act_call_attend(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        cid = str(p.get('callId') or p.get('id') or '')
        new_st = str(p.get('status') or 'atendida')
        return self.act_call_status(conn, {'id': cid, 'status': new_st})

    def act_table_close(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        tbl = self._resolve_table(conn, p, allow_inactive=True)
        sess = conn.execute(
            "SELECT * FROM table_sessions WHERE table_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
            (tbl['id'],),
        ).fetchone()
        if not sess:
            raise ActionError('La mesa ya está libre')

        pending_kitchen = conn.execute(
            "SELECT COUNT(*) AS cnt FROM orders WHERE session_id = ? AND status IN ('nuevo', 'cocina', 'listo')",
            (sess['id'],),
        ).fetchone()['cnt']

        if pending_kitchen > 0 and not p.get('force'):
            raise ActionError(
                f'Hay {pending_kitchen} pedido(s) sin entregar en esta mesa. Entregalos/anulalos o confirmá el cierre forzado.'
            )

        bill_call = conn.execute(
            "SELECT payment, tip_pct FROM calls WHERE session_id = ? AND type = 'cuenta' AND status != 'atendida' LIMIT 1",
            (sess['id'],),
        ).fetchone()

        payment = str(p.get('payment') or (bill_call['payment'] if bill_call else 'Efectivo'))
        if payment not in PAYMENTS:
            payment = 'Efectivo'
        try:
            tip_pct = int(p.get('tip') if p.get('tip') is not None else (bill_call['tip_pct'] if bill_call else 0))
        except (TypeError, ValueError):
            tip_pct = 0

        sub = self._session_subtotal(conn, sess['id'])
        tip_amt = round(sub * tip_pct / 100)
        total = sub + tip_amt

        w_name = ''
        if sess['waiter_id']:
            w_row = conn.execute('SELECT name FROM waiters WHERE id = ?', (sess['waiter_id'],)).fetchone()
            if w_row:
                w_name = w_row['name']

        ts = now_ms()
        conn.execute(
            """
            UPDATE table_sessions
            SET status = 'closed', closed_at = ?, subtotal = ?, tip_pct = ?, tip_amount = ?, total = ?,
                payment_method = ?, closed_waiter_name = ?
            WHERE id = ?
            """,
            (ts, sub, tip_pct, tip_amt, total, payment, w_name, sess['id']),
        )
        conn.execute(
            "UPDATE calls SET status = 'atendida', attended_at = ? WHERE session_id = ? AND status != 'atendida'",
            (ts, sess['id']),
        )
        conn.execute(
            "UPDATE orders SET status = 'entregado', updated_at = ? WHERE session_id = ? AND status NOT IN ('entregado', 'cancelado')",
            (ts, sess['id']),
        )
        return {'sessionId': sess['id'], 'total': total}

    def act_session_reassign(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        tbl = self._resolve_table(conn, p, allow_inactive=True)
        wid = str(p.get('waiterId') or '').strip()
        w = conn.execute('SELECT * FROM waiters WHERE id = ?', (wid,)).fetchone()
        if not w:
            raise ActionError('Mozo inexistente')
        sess = conn.execute(
            "SELECT * FROM table_sessions WHERE table_id = ? AND status = 'open' LIMIT 1",
            (tbl['id'],),
        ).fetchone()
        if not sess:
            raise ActionError('La mesa está libre; se asignará al abrirse')
        tag = table_short_tag(tbl['code'])
        conn.execute('UPDATE table_sessions SET waiter_id = ? WHERE id = ?', (wid, sess['id']))
        conn.execute("UPDATE calls SET waiter_id = ? WHERE session_id = ? AND status != 'atendida'", (wid, sess['id']))
        self._add_notification(
            conn,
            wid,
            'table_transferred',
            tbl['id'],
            f"🪑 Se te asignó manualmente la Mesa {tbl['code']} ({tbl['block_name']})",
            'Asignación realizada desde el panel.',
            short_title=f"🪑 {tag} · A tu cargo",
            short_body=f"Sector {tbl['block_name']}",
        )
        return {'waiterName': w['name']}

    # ---------- Acciones de Bloques y Mesas ----------

    def act_block_save(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        bid = str(p.get('id') or '').strip()
        tpl_id = str(p.get('template') or 'sector1')
        tpl = next((t for t in BLOCK_TEMPLATES if t['id'] == tpl_id), BLOCK_TEMPLATES[0])

        name = clean_text(p, 'name', 40) or tpl['name']
        icon = clean_text(p, 'icon', 8) or tpl['icon']
        try:
            columns = max(1, min(8, int(p.get('columns') or tpl['columns'])))
        except (TypeError, ValueError):
            columns = 4
        amode = str(p.get('assignmentMode') or 'auto')
        if amode not in ('auto', 'preassigned'):
            amode = 'auto'
        waiter_ids = [str(x) for x in (p.get('waiterIds') or [])]

        if bid:
            if not conn.execute('SELECT 1 FROM blocks WHERE id = ?', (bid,)).fetchone():
                raise ActionError('Bloque inexistente')
            conn.execute(
                'UPDATE blocks SET name = ?, template = ?, icon = ?, columns = ?, assignment_mode = ? WHERE id = ?',
                (name, tpl_id, icon, columns, amode, bid),
            )
        else:
            bid = self._next_id(conn, 'b')
            max_ord = conn.execute('SELECT COALESCE(MAX(sort_order), 0) AS m FROM blocks').fetchone()['m']
            conn.execute(
                'INSERT INTO blocks (id, name, template, icon, columns, assignment_mode, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (bid, name, tpl_id, icon, columns, amode, max_ord + 1),
            )
            # Crear mesas iniciales si se pidieron al crear el bloque pre-armado
            init_count = max(0, min(40, int(p.get('initialTables') if p.get('initialTables') is not None else tpl['count'])))
            seats = max(1, min(24, int(p.get('seats') or tpl['seats'])))
            prefix = clean_text(p, 'prefix', 8) if 'prefix' in p else tpl['prefix']
            self._bulk_add_tables(conn, bid, init_count, seats, prefix)

        conn.execute('DELETE FROM block_waiters WHERE block_id = ?', (bid,))
        if amode == 'preassigned':
            for wid in waiter_ids:
                if conn.execute('SELECT 1 FROM waiters WHERE id = ?', (wid,)).fetchone():
                    conn.execute('INSERT OR IGNORE INTO block_waiters (block_id, waiter_id) VALUES (?, ?)', (bid, wid))

        self._adopt_orphan_sessions(conn)
        return {'id': bid}

    def _bulk_add_tables(self, conn: sqlite3.Connection, block_id: str, count: int, seats: int, prefix: str) -> list[str]:
        existing_codes = {
            r['code'].upper() for r in conn.execute('SELECT code FROM tables').fetchall()
        }
        max_ord = conn.execute('SELECT COALESCE(MAX(sort_order), 0) AS m FROM tables WHERE block_id = ?', (block_id,)).fetchone()['m']
        created: list[str] = []
        num = 1
        for i in range(count):
            while True:
                cand = f'{prefix}{num}'
                num += 1
                if cand.upper() not in existing_codes:
                    existing_codes.add(cand.upper())
                    break
            tid = self._next_id(conn, 't')
            tok = self._unique_qr_token(conn)
            conn.execute(
                'INSERT INTO tables (id, block_id, code, seats, qr_token, active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)',
                (tid, block_id, cand, seats, tok, max_ord + i + 1),
            )
            created.append(tid)
        return created

    def act_block_move(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        bid = str(p.get('id') or '')
        direction = int(p.get('dir') or 0)
        rows = conn.execute('SELECT id, sort_order FROM blocks ORDER BY sort_order ASC, id ASC').fetchall()
        ids = [r['id'] for r in rows]
        if bid not in ids:
            raise ActionError('Bloque inexistente')
        idx = ids.index(bid)
        swap_idx = idx + (-1 if direction < 0 else 1)
        if 0 <= swap_idx < len(ids):
            ids[idx], ids[swap_idx] = ids[swap_idx], ids[idx]
            for pos, xid in enumerate(ids, start=1):
                conn.execute('UPDATE blocks SET sort_order = ? WHERE id = ?', (pos, xid))

    def act_block_delete(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        bid = str(p.get('id') or '')
        open_cnt = conn.execute(
            """
            SELECT COUNT(*) AS cnt FROM table_sessions s
            JOIN tables t ON t.id = s.table_id
            WHERE t.block_id = ? AND s.status = 'open'
            """,
            (bid,),
        ).fetchone()['cnt']
        if open_cnt > 0:
            raise ActionError('No se puede eliminar un bloque que tiene mesas abiertas actualmente')
        conn.execute('DELETE FROM blocks WHERE id = ?', (bid,))

    def act_table_save(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        tid = str(p.get('id') or '').strip()
        block_id = str(p.get('blockId') or '').strip()
        if not conn.execute('SELECT 1 FROM blocks WHERE id = ?', (block_id,)).fetchone():
            raise ActionError('Bloque inválido')
        code = clean_text(p, 'code', 14)
        if not code:
            raise ActionError('La mesa necesita un código o nombre (ej: 1, T2, B1)')
        dup = conn.execute(
            'SELECT id FROM tables WHERE UPPER(code) = UPPER(?) AND id != ?',
            (code, tid or ''),
        ).fetchone()
        if dup:
            raise ActionError(f'Ya existe otra mesa con el código "{code}"')
        try:
            seats = max(1, min(30, int(p.get('seats') or 4)))
        except (TypeError, ValueError):
            seats = 4
        active = 1 if p.get('active', True) else 0

        if tid:
            if not conn.execute('SELECT 1 FROM tables WHERE id = ?', (tid,)).fetchone():
                raise ActionError('Mesa inexistente')
            conn.execute(
                'UPDATE tables SET block_id = ?, code = ?, seats = ?, active = ? WHERE id = ?',
                (block_id, code, seats, active, tid),
            )
            return {'id': tid}

        tid = self._next_id(conn, 't')
        tok = self._unique_qr_token(conn)
        max_ord = conn.execute('SELECT COALESCE(MAX(sort_order), 0) AS m FROM tables WHERE block_id = ?', (block_id,)).fetchone()['m']
        conn.execute(
            'INSERT INTO tables (id, block_id, code, seats, qr_token, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (tid, block_id, code, seats, tok, active, max_ord + 1),
        )
        return {'id': tid, 'qrToken': tok}

    def act_table_bulk(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        block_id = str(p.get('blockId') or '').strip()
        if not conn.execute('SELECT 1 FROM blocks WHERE id = ?', (block_id,)).fetchone():
            raise ActionError('Bloque inválido')
        count = max(1, min(30, int(p.get('count') or 4)))
        seats = max(1, min(24, int(p.get('seats') or 4)))
        prefix = clean_text(p, 'prefix', 8)
        ids = self._bulk_add_tables(conn, block_id, count, seats, prefix)
        return {'created': len(ids)}

    def act_table_regen_qr(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        tid = str(p.get('id') or '')
        if not conn.execute('SELECT 1 FROM tables WHERE id = ?', (tid,)).fetchone():
            raise ActionError('Mesa inexistente')
        tok = self._unique_qr_token(conn)
        conn.execute('UPDATE tables SET qr_token = ? WHERE id = ?', (tok, tid))
        return {'id': tid, 'qrToken': tok}

    def act_table_delete(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        tid = str(p.get('id') or '')
        open_cnt = conn.execute(
            "SELECT COUNT(*) AS cnt FROM table_sessions WHERE table_id = ? AND status = 'open'",
            (tid,),
        ).fetchone()['cnt']
        if open_cnt > 0:
            raise ActionError('Cerrá primero la cuenta de esta mesa antes de eliminarla')
        conn.execute('DELETE FROM tables WHERE id = ?', (tid,))

    # ---------- Acciones de Mozos ----------

    def act_waiter_save(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        wid = str(p.get('id') or '').strip()
        name = clean_text(p, 'name', 40)
        if not name:
            raise ActionError('El mozo necesita un nombre')
        color = clean_text(p, 'color', 12) or WAITER_COLORS[0]
        pin = re.sub(r'\D', '', str(p.get('pin') or ''))[:6]
        available = 1 if p.get('available', True) else 0
        block_ids = [str(x) for x in (p.get('blockIds') or [])]

        transfers: list[dict[str, str]] = []
        if wid:
            old = conn.execute('SELECT * FROM waiters WHERE id = ?', (wid,)).fetchone()
            if not old:
                raise ActionError('Mozo inexistente')
            conn.execute(
                'UPDATE waiters SET name = ?, color = ?, pin = ?, available = ? WHERE id = ?',
                (name, color, pin, available, wid),
            )
            if old['available'] and not available:
                transfers = self._redistribute_from_waiter(conn, wid, old['name'])
        else:
            wid = self._next_id(conn, 'w')
            conn.execute(
                'INSERT INTO waiters (id, name, color, pin, available, last_assigned_at, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
                (wid, name, color, pin, available, now_ms()),
            )

        if 'blockIds' in p:
            conn.execute('DELETE FROM block_waiters WHERE waiter_id = ?', (wid,))
            for bid in block_ids:
                if conn.execute('SELECT 1 FROM blocks WHERE id = ?', (bid,)).fetchone():
                    conn.execute('INSERT OR IGNORE INTO block_waiters (block_id, waiter_id) VALUES (?, ?)', (bid, wid))
                    conn.execute("UPDATE blocks SET assignment_mode = 'preassigned' WHERE id = ?", (bid,))

        if available:
            self._adopt_orphan_sessions(conn)

        return {'id': wid, 'reassigned': transfers}

    def act_waiter_toggle(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        wid = str(p.get('id') or '')
        old = conn.execute('SELECT * FROM waiters WHERE id = ?', (wid,)).fetchone()
        if not old:
            raise ActionError('Mozo inexistente')
        avail = 1 if p.get('available') else 0
        conn.execute('UPDATE waiters SET available = ? WHERE id = ?', (avail, wid))
        transfers: list[dict[str, str]] = []
        if old['available'] and not avail:
            transfers = self._redistribute_from_waiter(conn, wid, old['name'])
        elif avail:
            self._adopt_orphan_sessions(conn)
        return {'id': wid, 'available': bool(avail), 'reassigned': transfers}

    def act_waiter_delete(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        wid = str(p.get('id') or '')
        old = conn.execute('SELECT * FROM waiters WHERE id = ?', (wid,)).fetchone()
        if not old:
            raise ActionError('Mozo inexistente')
        conn.execute('UPDATE waiters SET available = 0 WHERE id = ?', (wid,))
        transfers = self._redistribute_from_waiter(conn, wid, old['name'])
        conn.execute('DELETE FROM waiters WHERE id = ?', (wid,))
        return {'deleted': wid, 'reassigned': transfers}

    # ---------- Acciones de Menú y Categorías ----------

    def act_category_save(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        cid = str(p.get('id') or '').strip()
        name = clean_text(p, 'name', 40)
        if not name:
            raise ActionError('La categoría necesita un nombre')
        icon = clean_text(p, 'icon', 8) or '🍽️'
        station = str(p.get('station') or 'cocina')
        if station not in STATIONS:
            station = 'cocina'

        if cid:
            if not conn.execute('SELECT 1 FROM categories WHERE id = ?', (cid,)).fetchone():
                raise ActionError('Categoría inexistente')
            conn.execute('UPDATE categories SET name = ?, icon = ?, station = ? WHERE id = ?', (name, icon, station, cid))
            return {'id': cid}

        cid = self._next_id(conn, 'c')
        max_ord = conn.execute('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').fetchone()['m']
        conn.execute(
            'INSERT INTO categories (id, name, icon, station, sort_order) VALUES (?, ?, ?, ?, ?)',
            (cid, name, icon, station, max_ord + 1),
        )
        return {'id': cid}

    def act_category_move(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        cid = str(p.get('id') or '')
        direction = int(p.get('dir') or 0)
        rows = conn.execute('SELECT id FROM categories ORDER BY sort_order ASC, id ASC').fetchall()
        ids = [r['id'] for r in rows]
        if cid not in ids:
            raise ActionError('Categoría inexistente')
        idx = ids.index(cid)
        swap_idx = idx + (-1 if direction < 0 else 1)
        if 0 <= swap_idx < len(ids):
            ids[idx], ids[swap_idx] = ids[swap_idx], ids[idx]
            for pos, xid in enumerate(ids, start=1):
                conn.execute('UPDATE categories SET sort_order = ? WHERE id = ?', (pos, xid))

    def act_category_delete(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        cid = str(p.get('id') or '')
        cnt = conn.execute('SELECT COUNT(*) AS cnt FROM items WHERE category_id = ?', (cid,)).fetchone()['cnt']
        if cnt > 0:
            raise ActionError('Eliminá o mové primero los platos de esta categoría')
        conn.execute('DELETE FROM categories WHERE id = ?', (cid,))

    def act_item_save(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        iid = str(p.get('id') or '').strip()
        name = clean_text(p, 'name', 50)
        if not name:
            raise ActionError('El plato necesita un nombre')
        try:
            price = max(0, int(round(float(p.get('price')))))
        except (TypeError, ValueError):
            raise ActionError('Precio inválido')
        cat_id = str(p.get('cat') or '')
        if not conn.execute('SELECT 1 FROM categories WHERE id = ?', (cat_id,)).fetchone():
            raise ActionError('Categoría inválida')

        desc = clean_text(p, 'desc', 140)
        emoji = clean_text(p, 'emoji', 8) or '🍽️'
        st_ov = str(p.get('stationOverride') or '')
        if st_ov not in ('', 'cocina', 'barra'):
            st_ov = ''
        popular = 1 if p.get('popular') else 0
        available = 1 if p.get('available', True) else 0
        tags_in = p.get('tags') if 'tags' in p else None

        target_id = iid or self._next_id(conn, 'i')
        image_url = clean_text(p, 'imageUrl', 300)
        image_data = str(p.get('imageData') or '').strip()
        if image_data.startswith('data:image/'):
            image_url = self._save_uploaded_image(target_id, image_data)

        if iid:
            cur_item = conn.execute('SELECT tags FROM items WHERE id = ?', (iid,)).fetchone()
            if not cur_item:
                raise ActionError('Plato inexistente')
            tags = normalize_tags(tags_in) if tags_in is not None else cur_item['tags']
            conn.execute(
                """
                UPDATE items
                SET category_id = ?, name = ?, description = ?, price = ?, emoji = ?,
                    image_url = ?, station_override = ?, popular = ?, available = ?, tags = ?
                WHERE id = ?
                """,
                (cat_id, name, desc, price, emoji, image_url, st_ov, popular, available, tags, iid),
            )
            return {'id': iid}

        tags = normalize_tags(tags_in) if tags_in is not None else ''
        max_ord = conn.execute('SELECT COALESCE(MAX(sort_order), 0) AS m FROM items WHERE category_id = ?', (cat_id,)).fetchone()['m']
        conn.execute(
            """
            INSERT INTO items (id, category_id, name, description, price, emoji, image_url, station_override, popular, available, sort_order, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (target_id, cat_id, name, desc, price, emoji, image_url, st_ov, popular, available, max_ord + 1, tags),
        )
        return {'id': target_id}

    def act_item_toggle(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        iid = str(p.get('id') or '')
        if not conn.execute('SELECT 1 FROM items WHERE id = ?', (iid,)).fetchone():
            raise ActionError('Plato inexistente')
        conn.execute('UPDATE items SET available = ? WHERE id = ?', (1 if p.get('available') else 0, iid))

    def act_item_delete(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        iid = str(p.get('id') or '')
        conn.execute('DELETE FROM items WHERE id = ?', (iid,))

    def act_menu_adjust_prices(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        try:
            pct = float(p.get('percent') or 0)
            round_to = max(1, int(p.get('roundTo') or 100))
        except (TypeError, ValueError):
            raise ActionError('Porcentaje inválido')
        if not -90 <= pct <= 500 or pct == 0:
            raise ActionError('Ingresá un porcentaje entre -90% y +500%')

        cat_id = str(p.get('categoryId') or '').strip()
        rows = (
            conn.execute('SELECT id, price FROM items WHERE category_id = ?', (cat_id,)).fetchall()
            if cat_id
            else conn.execute('SELECT id, price FROM items').fetchall()
        )
        factor = 1.0 + pct / 100.0
        for r in rows:
            raw_new = max(0.0, r['price'] * factor)
            rounded = int(round(raw_new / round_to) * round_to)
            conn.execute('UPDATE items SET price = ? WHERE id = ?', (rounded, r['id']))
        return {'updated': len(rows)}

    # ---------- Configuración, Notificaciones y Mantenimiento ----------

    def act_restaurant_save(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        cur = conn.execute('SELECT * FROM restaurant WHERE id = 1').fetchone()
        name = clean_text(p, 'name', 50) or cur['name']
        subtitle = clean_text(p, 'subtitle', 80) if 'subtitle' in p else cur['subtitle']
        amode = str(p.get('assignmentMode') or cur['assignment_mode'])
        if amode not in ('hybrid', 'auto'):
            amode = 'hybrid'
        public_url = clean_text(p, 'publicUrl', 200).rstrip('/') if 'publicUrl' in p else cur['public_url']
        demo_mode = (1 if p.get('demoMode') else 0) if 'demoMode' in p else cur['demo_mode']
        new_pin = re.sub(r'\s+', '', str(p.get('adminPin') or ''))[:16]
        pin = new_pin if len(new_pin) >= 4 else cur['admin_pin']

        conn.execute(
            """
            UPDATE restaurant
            SET name = ?, subtitle = ?, assignment_mode = ?, public_url = ?, demo_mode = ?, admin_pin = ?
            WHERE id = 1
            """,
            (name, subtitle, amode, public_url, demo_mode, pin),
        )

    def act_notifications_read(self, conn: sqlite3.Connection, p: dict[str, Any]) -> None:
        wid = str(p.get('waiterId') or '').strip()
        if wid:
            conn.execute('UPDATE notifications SET read = 1 WHERE waiter_id = ? OR waiter_id IS NULL', (wid,))
        else:
            conn.execute('UPDATE notifications SET read = 1')

    def act_clear_orders(self, conn: sqlite3.Connection, _p: dict[str, Any]) -> None:
        conn.executescript(
            """
            DELETE FROM notifications;
            DELETE FROM calls;
            DELETE FROM order_items;
            DELETE FROM orders;
            DELETE FROM table_sessions;
            """
        )

    def act_reset_demo(self, conn: sqlite3.Connection, _p: dict[str, Any]) -> None:
        self._seed_factory(conn)

    # ---------- Consultas comerciales (Leads de la Landing) y Exportación contable ----------

    @staticmethod
    def _lead_row(r: sqlite3.Row) -> dict[str, Any]:
        return {
            'id': r['id'],
            'name': r['name'] or '',
            'restaurantName': r['restaurant_name'] or '',
            'zone': r['zone'] or '',
            'tablesCount': r['tables_count'] or '',
            'contact': r['contact'] or '',
            'planInterest': r['plan_interest'] or '',
            'message': r['message'] or '',
            'status': r['status'],
            'createdAt': r['created_at'],
        }

    def create_lead(self, p: dict[str, Any]) -> dict[str, Any]:
        """Alta pública de una consulta comercial enviada desde la Landing Page."""
        if not isinstance(p, dict):
            raise ActionError('Datos inválidos')

        def field(key: str, maxlen: int) -> str:
            # Texto plano, compacto y sin caracteres de control
            raw = p.get(key)
            if raw is None:
                return ''
            txt = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', str(raw)).strip()
            return txt[:maxlen]

        name = field('name', 80)
        restaurant_name = field('restaurantName', 100)
        contact = field('contact', 120)
        if not (name or restaurant_name):
            raise ActionError('Contanos tu nombre o el de tu restaurante')
        if not contact:
            raise ActionError('Dejanos un WhatsApp o correo para responderte')
        tables_raw = field('tablesCount', 12)
        tables_digits = re.sub(r'[^0-9]', '', tables_raw)[:4]
        lead = {
            'name': name,
            'restaurant_name': restaurant_name,
            'zone': field('zone', 80),
            'tables_count': tables_digits or tables_raw,
            'contact': contact,
            'plan_interest': field('planInterest', 60),
            'message': field('message', 1200),
        }
        with self.lock:
            conn = self._connect()
            try:
                lid = 'L' + datetime.now().strftime('%y%m%d') + '-' + secrets.token_hex(3)
                ts = now_ms()
                conn.execute(
                    """
                    INSERT INTO leads (id, name, restaurant_name, zone, tables_count, contact, plan_interest, message, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nuevo', ?)
                    """,
                    (lid, lead['name'], lead['restaurant_name'], lead['zone'], lead['tables_count'],
                     lead['contact'], lead['plan_interest'], lead['message'], ts),
                )
                conn.commit()
                self.version += 1
                row = conn.execute('SELECT * FROM leads WHERE id = ?', (lid,)).fetchone()
                return self._lead_row(row)
            finally:
                conn.close()

    def get_leads(self, limit: int = 50) -> list[dict[str, Any]]:
        with self.lock:
            conn = self._connect()
            try:
                return [
                    self._lead_row(r)
                    for r in conn.execute(
                        'SELECT * FROM leads ORDER BY created_at DESC LIMIT ?', (max(1, min(500, int(limit))),)
                    ).fetchall()
                ]
            finally:
                conn.close()

    def act_lead_status(self, conn: sqlite3.Connection, p: dict[str, Any]) -> dict[str, Any]:
        lid = str(p.get('leadId') or p.get('id') or '').strip()
        status = str(p.get('status') or '').strip()
        if status not in LEAD_STATUSES:
            raise ActionError('Estado de consulta inválido')
        if not conn.execute('SELECT 1 FROM leads WHERE id = ?', (lid,)).fetchone():
            raise ActionError('Consulta inexistente')
        conn.execute('UPDATE leads SET status = ? WHERE id = ?', (status, lid))
        return {'leadId': lid, 'status': status}

    def get_closed_sessions_export(self) -> list[dict[str, Any]]:
        """Todas las sesiones cerradas (más recientes primero) para el arqueo contable CSV."""
        with self.lock:
            conn = self._connect()
            try:
                rows = conn.execute(
                    """
                    SELECT s.*, t.code AS table_code, b.name AS block_name, w.name AS live_waiter_name
                    FROM table_sessions s
                    LEFT JOIN tables t ON t.id = s.table_id
                    LEFT JOIN blocks b ON b.id = t.block_id
                    LEFT JOIN waiters w ON w.id = s.waiter_id
                    WHERE s.status = 'closed'
                    ORDER BY s.closed_at DESC
                    """
                ).fetchall()
                return [
                    {
                        'id': r['id'],
                        'openedAt': r['opened_at'],
                        'closedAt': r['closed_at'],
                        'tableCode': r['table_code'] or '?',
                        'blockName': r['block_name'] or '',
                        'waiterName': r['closed_waiter_name'] or r['live_waiter_name'] or 'Sin mozo',
                        'payment': r['payment_method'] or 'Efectivo',
                        'subtotal': r['subtotal'],
                        'tipPct': r['tip_pct'],
                        'tipAmount': r['tip_amount'],
                        'total': r['total'],
                    }
                    for r in rows
                ]
            finally:
                conn.close()

    # ---------- Autenticación de Encargado y Mozos ----------

    def verify_admin_pin(self, pin: str) -> bool:
        with self.lock:
            conn = self._connect()
            try:
                row = conn.execute('SELECT admin_pin FROM restaurant WHERE id = 1').fetchone()
                return bool(row and str(pin).strip() == row['admin_pin'])
            finally:
                conn.close()

    def is_demo_mode(self) -> bool:
        with self.lock:
            conn = self._connect()
            try:
                row = conn.execute('SELECT demo_mode FROM restaurant WHERE id = 1').fetchone()
                return bool(row and row['demo_mode'])
            finally:
                conn.close()

    def verify_waiter_login(self, waiter_id: str, pin: str) -> dict[str, Any]:
        with self.lock:
            conn = self._connect()
            try:
                w = conn.execute('SELECT * FROM waiters WHERE id = ?', (waiter_id,)).fetchone()
                if not w:
                    raise ActionError('Mozo inexistente')
                if w['pin'] and str(pin).strip() != w['pin']:
                    raise ActionError('PIN de mozo incorrecto')
                return {'id': w['id'], 'name': w['name'], 'color': w['color']}
            finally:
                conn.close()

    # ---------- Suscripciones Web Push (Modo Pulsera Xiaomi Band) ----------

    def save_push_subscription(
        self,
        waiter_id: str,
        endpoint: str,
        p256dh: str,
        auth: str,
        wristband_mode: bool = True,
    ) -> dict[str, Any]:
        wid = str(waiter_id or '').strip()
        ep = str(endpoint or '').strip()
        k_pub = str(p256dh or '').strip()
        k_auth = str(auth or '').strip()
        if not wid:
            raise ActionError('Mozo requerido para vincular pulsera')
        if not ep.startswith(('https://', 'http://')) or len(ep) > 2048:
            raise ActionError('Endpoint Web Push inválido')
        if not k_pub or not k_auth:
            raise ActionError('Claves criptográficas de suscripción incompletas')

        wb = 1 if wristband_mode else 0
        ts = now_ms()
        with self.lock:
            conn = self._connect()
            try:
                w = conn.execute('SELECT id, name FROM waiters WHERE id = ?', (wid,)).fetchone()
                if not w:
                    raise ActionError('Mozo inexistente')
                conn.execute(
                    """
                    INSERT INTO push_subscriptions (waiter_id, endpoint, p256dh, auth, wristband_mode, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(endpoint) DO UPDATE SET
                        waiter_id = excluded.waiter_id,
                        p256dh = excluded.p256dh,
                        auth = excluded.auth,
                        wristband_mode = excluded.wristband_mode,
                        created_at = excluded.created_at
                    """,
                    (wid, ep, k_pub, k_auth, wb, ts),
                )
                conn.commit()
                self.version += 1
                return {'waiterId': wid, 'waiterName': w['name'], 'wristbandMode': bool(wb)}
            finally:
                conn.close()

    def delete_push_subscription(self, endpoint: str) -> bool:
        ep = str(endpoint or '').strip()
        if not ep:
            return False
        with self.lock:
            conn = self._connect()
            try:
                cur = conn.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', (ep,))
                conn.commit()
                if cur.rowcount > 0:
                    self.version += 1
                    return True
                return False
            finally:
                conn.close()

    def get_waiter_push_subscriptions(self, waiter_id: str, endpoint: str = '') -> list[dict[str, Any]]:
        wid = str(waiter_id or '').strip()
        ep = str(endpoint or '').strip()
        with self.lock:
            conn = self._connect()
            try:
                if ep:
                    rows = conn.execute(
                        'SELECT waiter_id, endpoint, p256dh, auth, wristband_mode FROM push_subscriptions WHERE endpoint = ?',
                        (ep,),
                    ).fetchall()
                    if rows:
                        return [dict(r) for r in rows]
                if not wid:
                    return []
                rows = conn.execute(
                    'SELECT waiter_id, endpoint, p256dh, auth, wristband_mode FROM push_subscriptions WHERE waiter_id = ?',
                    (wid,),
                ).fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    def drain_push_deliveries(self) -> list[tuple[dict[str, Any], dict[str, Any]]]:
        """Extrae las notificaciones recién creadas y las cruza con suscripciones activas."""
        with self.lock:
            if not self._pending_push_notifications:
                return []
            queued = list(self._pending_push_notifications)
            self._pending_push_notifications.clear()

            conn = self._connect()
            try:
                deliveries: list[tuple[dict[str, Any], dict[str, Any]]] = []
                for n in queued:
                    wid = n.get('waiterId')
                    if wid:
                        subs = conn.execute(
                            'SELECT waiter_id, endpoint, p256dh, auth, wristband_mode FROM push_subscriptions WHERE waiter_id = ?',
                            (wid,),
                        ).fetchall()
                    else:
                        subs = conn.execute(
                            """
                            SELECT ps.waiter_id, ps.endpoint, ps.p256dh, ps.auth, ps.wristband_mode
                            FROM push_subscriptions ps
                            JOIN waiters w ON w.id = ps.waiter_id
                            WHERE w.available = 1
                            """
                        ).fetchall()

                    for s in subs:
                        sub_d = dict(s)
                        wb_mode = bool(sub_d.get('wristband_mode', 1))
                        payload = {
                            'id': n['id'],
                            'kind': n['kind'],
                            'waiterId': sub_d['waiter_id'],
                            'tableId': n.get('tableId'),
                            'title': n['shortTitle'] if wb_mode else n['title'],
                            'body': n['shortBody'] if wb_mode else n['body'],
                            'shortTitle': n['shortTitle'],
                            'shortBody': n['shortBody'],
                            'fullTitle': n['title'],
                            'fullBody': n['body'],
                            'urgent': n['kind'] in ('order_ready', 'call_mozo', 'call_cuenta', 'table_transferred'),
                            'tag': f"salelisto-{n['kind']}-{n.get('tableId') or n['id']}",
                            'url': f"/mozo.html?waiter={sub_d['waiter_id']}",
                            'ts': n['createdAt'],
                        }
                        deliveries.append((sub_d, payload))
                return deliveries
            finally:
                conn.close()

    # ---------- Ejecución Transaccional de Acciones ----------

    def execute(self, action_type: str, payload: dict[str, Any], role: str = 'client') -> Any:
        is_staff = role in ('admin', 'waiter', 'kitchen')
        is_admin = role == 'admin'
        demo_active = self.is_demo_mode()

        client_allowed = {'order.create', 'call.create'}
        staff_allowed = client_allowed | {
            'order.advance', 'order.status', 'order.revert', 'order.cancel',
            'call.status', 'call.attend', 'table.close', 'notifications.read',
            'waiter.toggle', 'session.reassign',
        }
        admin_only = {
            'restaurant.save',
            'block.save', 'block.move', 'block.delete',
            'table.save', 'table.bulk', 'table.regen_qr', 'table.delete',
            'waiter.save', 'waiter.delete',
            'category.save', 'category.move', 'category.delete',
            'item.save', 'item.toggle', 'item.delete', 'menu.adjust_prices',
            'data.clear_orders', 'data.reset_demo',
        }

        if action_type in admin_only and not is_admin:
            raise ActionError('Se requiere acceso de encargado (PIN)')
        if action_type == 'lead.status' and not (is_admin or demo_active):
            raise ActionError('Se requiere acceso de encargado (PIN)')
        if action_type in staff_allowed and action_type not in client_allowed and not (is_staff or demo_active):
            raise ActionError('Acción reservada al personal del restaurante')

        dispatch_map = {
            'lead.status': self.act_lead_status,
            'order.create': lambda c, p: self.act_order_create(c, p, is_staff=is_staff),
            'order.advance': self.act_order_advance,
            'order.status': self.act_order_status,
            'order.revert': self.act_order_revert,
            'order.cancel': self.act_order_cancel,
            'call.create': lambda c, p: self.act_call_create(c, p, is_staff=is_staff),
            'call.status': self.act_call_status,
            'call.attend': self.act_call_attend,
            'table.close': self.act_table_close,
            'session.reassign': self.act_session_reassign,
            'restaurant.save': self.act_restaurant_save,
            'block.save': self.act_block_save,
            'block.move': self.act_block_move,
            'block.delete': self.act_block_delete,
            'table.save': self.act_table_save,
            'table.bulk': self.act_table_bulk,
            'table.regen_qr': self.act_table_regen_qr,
            'table.delete': self.act_table_delete,
            'waiter.save': self.act_waiter_save,
            'waiter.toggle': self.act_waiter_toggle,
            'waiter.delete': self.act_waiter_delete,
            'category.save': self.act_category_save,
            'category.move': self.act_category_move,
            'category.delete': self.act_category_delete,
            'item.save': self.act_item_save,
            'item.toggle': self.act_item_toggle,
            'item.delete': self.act_item_delete,
            'menu.adjust_prices': self.act_menu_adjust_prices,
            'notifications.read': self.act_notifications_read,
            'data.clear_orders': self.act_clear_orders,
            'data.reset_demo': self.act_reset_demo,
        }
        fn = dispatch_map.get(action_type)
        if not fn:
            raise ActionError(f'Acción desconocida: {action_type}')

        with self.lock:
            conn = self._connect()
            self._tx_notifications = []
            try:
                result = fn(conn, payload or {})
                conn.commit()
                self.version += 1
                if self._tx_notifications:
                    self._pending_push_notifications.extend(self._tx_notifications)
                return result
            except Exception:
                conn.rollback()
                raise
            finally:
                self._tx_notifications = None
                conn.close()

    # ---------- Construcción de Snapshots (Staff vs Cliente Scoped) ----------

    def get_staff_state(self) -> dict[str, Any]:
        with self.lock:
            conn = self._connect()
            try:
                rest = dict(conn.execute('SELECT * FROM restaurant WHERE id = 1').fetchone())
                rest.pop('admin_pin', None)
                rest['demoMode'] = bool(rest.pop('demo_mode'))
                rest['assignmentMode'] = rest.pop('assignment_mode')
                rest['publicUrl'] = rest.pop('public_url')

                bw_rows = conn.execute('SELECT block_id, waiter_id FROM block_waiters').fetchall()
                bw_by_block: dict[str, list[str]] = {}
                bw_by_waiter: dict[str, list[str]] = {}
                for r in bw_rows:
                    bw_by_block.setdefault(r['block_id'], []).append(r['waiter_id'])
                    bw_by_waiter.setdefault(r['waiter_id'], []).append(r['block_id'])

                blocks = [
                    {
                        'id': r['id'],
                        'name': r['name'],
                        'template': r['template'],
                        'icon': r['icon'],
                        'columns': r['columns'],
                        'assignmentMode': r['assignment_mode'],
                        'sortOrder': r['sort_order'],
                        'waiterIds': bw_by_block.get(r['id'], []),
                    }
                    for r in conn.execute('SELECT * FROM blocks ORDER BY sort_order ASC, id ASC').fetchall()
                ]
                block_map = {b['id']: b for b in blocks}

                today_ms = start_of_today_ms()

                # Sesiones abiertas por mesa
                open_sessions_raw = conn.execute("SELECT * FROM table_sessions WHERE status = 'open'").fetchall()
                open_by_table = {r['table_id']: dict(r) for r in open_sessions_raw}

                # Ventas cerradas de hoy
                closed_today_rows = conn.execute(
                    "SELECT * FROM table_sessions WHERE status = 'closed' AND closed_at >= ? ORDER BY closed_at DESC",
                    (today_ms,),
                ).fetchall()

                waiter_sales_today: dict[str, dict[str, int]] = {}
                by_payment: dict[str, int] = {}
                closed_sales_total = 0
                closed_tips_total = 0
                for cs in closed_today_rows:
                    closed_sales_total += cs['subtotal']
                    closed_tips_total += cs['tip_amount']
                    pm = cs['payment_method'] or 'Efectivo'
                    by_payment[pm] = by_payment.get(pm, 0) + cs['total']
                    if cs['waiter_id']:
                        st = waiter_sales_today.setdefault(cs['waiter_id'], {'sales': 0, 'tips': 0, 'tables': 0})
                        st['sales'] += cs['subtotal']
                        st['tips'] += cs['tip_amount']
                        st['tables'] += 1

                push_counts = {
                    r['waiter_id']: r['cnt']
                    for r in conn.execute(
                        'SELECT waiter_id, COUNT(*) AS cnt FROM push_subscriptions GROUP BY waiter_id'
                    ).fetchall()
                }

                waiters = []
                waiter_map: dict[str, dict[str, Any]] = {}
                for r in conn.execute('SELECT * FROM waiters ORDER BY created_at ASC').fetchall():
                    ws = waiter_sales_today.get(r['id'], {'sales': 0, 'tips': 0, 'tables': 0})
                    pcnt = int(push_counts.get(r['id'], 0))
                    w_obj = {
                        'id': r['id'],
                        'name': r['name'],
                        'color': r['color'],
                        'hasPin': bool(r['pin']),
                        'available': bool(r['available']),
                        'blockIds': bw_by_waiter.get(r['id'], []),
                        'todaySales': ws['sales'],
                        'todayTips': ws['tips'],
                        'todayClosedTables': ws['tables'],
                        'pushCount': pcnt,
                        'wristbandActive': pcnt > 0,
                    }
                    waiters.append(w_obj)
                    waiter_map[r['id']] = w_obj

                # Pedidos de sesiones abiertas + cerradas hoy
                relevant_session_ids = [r['id'] for r in open_sessions_raw] + [r['id'] for r in closed_today_rows[:40]]
                orders_list: list[dict[str, Any]] = []
                open_subtotals: dict[str, int] = {}

                if relevant_session_ids:
                    placeholders = ','.join('?' for _ in relevant_session_ids)
                    ord_rows = conn.execute(
                        f'SELECT * FROM orders WHERE session_id IN ({placeholders}) ORDER BY created_at ASC',
                        relevant_session_ids,
                    ).fetchall()
                    oid_list = [o['id'] for o in ord_rows]
                    items_by_order: dict[str, list[dict[str, Any]]] = {}
                    if oid_list:
                        ph2 = ','.join('?' for _ in oid_list)
                        for oi in conn.execute(f'SELECT * FROM order_items WHERE order_id IN ({ph2})', oid_list).fetchall():
                            items_by_order.setdefault(oi['order_id'], []).append(
                                {
                                    'itemId': oi['item_id'],
                                    'name': oi['name'],
                                    'emoji': oi['emoji'],
                                    'imageUrl': oi['image_url'],
                                    'price': oi['unit_price'],
                                    'qty': oi['qty'],
                                    'note': oi['note'],
                                }
                            )

                    open_sess_set = {r['id'] for r in open_sessions_raw}
                    sess_waiter_lookup = {r['id']: r['waiter_id'] for r in open_sessions_raw}
                    for cs in closed_today_rows[:40]:
                        sess_waiter_lookup[cs['id']] = cs['waiter_id']

                    tbl_lookup = {
                        r['id']: r for r in conn.execute('SELECT id, code, block_id FROM tables').fetchall()
                    }

                    for o in ord_rows:
                        o_items = items_by_order.get(o['id'], [])
                        o_sub = sum(x['price'] * x['qty'] for x in o_items)
                        if o['session_id'] in open_sess_set and o['status'] != 'cancelado':
                            open_subtotals[o['session_id']] = open_subtotals.get(o['session_id'], 0) + o_sub
                        t_info = tbl_lookup.get(o['table_id'])
                        b_info = block_map.get(t_info['block_id']) if t_info else None
                        wid = sess_waiter_lookup.get(o['session_id'])
                        w_info = waiter_map.get(wid) if wid else None
                        orders_list.append(
                            {
                                'id': o['id'],
                                'sessionId': o['session_id'],
                                'isOpenSession': o['session_id'] in open_sess_set,
                                'tableId': o['table_id'],
                                'tableCode': t_info['code'] if t_info else '?',
                                'blockId': b_info['id'] if b_info else '',
                                'blockName': b_info['name'] if b_info else '',
                                'waiterId': wid,
                                'waiterName': w_info['name'] if w_info else None,
                                'waiterColor': w_info['color'] if w_info else None,
                                'batchId': o['batch_id'],
                                'station': o['station'],
                                'status': o['status'],
                                'source': o['source'],
                                'cancelReason': o['cancel_reason'],
                                'items': o_items,
                                'total': o_sub if o['status'] != 'cancelado' else 0,
                                'createdAt': o['created_at'],
                                'updatedAt': o['updated_at'],
                            }
                        )

                # Llamados activos (no atendidos)
                calls_list: list[dict[str, Any]] = []
                calls_by_table: dict[str, list[dict[str, Any]]] = {}
                tbl_all = {r['id']: dict(r) for r in conn.execute('SELECT * FROM tables').fetchall()}
                for c in conn.execute("SELECT * FROM calls WHERE status != 'atendida' ORDER BY created_at ASC").fetchall():
                    t_info = tbl_all.get(c['table_id'], {})
                    b_info = block_map.get(t_info.get('block_id', ''), {})
                    w_info = waiter_map.get(c['waiter_id']) if c['waiter_id'] else None
                    sub = open_subtotals.get(c['session_id'], 0)
                    tip_amt = round(sub * c['tip_pct'] / 100) if c['type'] == 'cuenta' else 0
                    c_obj = {
                        'id': c['id'],
                        'sessionId': c['session_id'],
                        'tableId': c['table_id'],
                        'tableCode': t_info.get('code', '?'),
                        'blockId': t_info.get('block_id', ''),
                        'blockName': b_info.get('name', ''),
                        'waiterId': c['waiter_id'],
                        'waiterName': w_info['name'] if w_info else None,
                        'waiterColor': w_info['color'] if w_info else None,
                        'type': c['type'],
                        'reason': c['reason'],
                        'payment': c['payment'],
                        'tip': c['tip_pct'],
                        'subtotal': sub,
                        'tipAmount': tip_amt,
                        'total': sub + tip_amt,
                        'status': c['status'],
                        'createdAt': c['created_at'],
                    }
                    calls_list.append(c_obj)
                    calls_by_table.setdefault(c['table_id'], []).append(c_obj)

                # Mesas enriquecidas con sesión abierta y mozo actual
                tables = []
                for r in conn.execute('SELECT * FROM tables ORDER BY sort_order ASC, id ASC').fetchall():
                    sess = open_by_table.get(r['id'])
                    t_calls = calls_by_table.get(r['id'], [])
                    wid = sess['waiter_id'] if sess else None
                    w_info = waiter_map.get(wid) if wid else None
                    b_info = block_map.get(r['block_id'], {})
                    sub = open_subtotals.get(sess['id'], 0) if sess else 0
                    if not r['active']:
                        st = 'inactiva'
                    elif any(x['type'] == 'cuenta' for x in t_calls):
                        st = 'cuenta'
                    elif any(x['type'] == 'mozo' for x in t_calls):
                        st = 'mozo'
                    elif sess:
                        st = 'ocupada'
                    else:
                        st = 'libre'
                    tables.append(
                        {
                            'id': r['id'],
                            'blockId': r['block_id'],
                            'blockName': b_info.get('name', ''),
                            'blockIcon': b_info.get('icon', ''),
                            'code': r['code'],
                            'seats': r['seats'],
                            'qrToken': r['qr_token'],
                            'active': bool(r['active']),
                            'sortOrder': r['sort_order'],
                            'status': st,
                            'sessionId': sess['id'] if sess else None,
                            'openedAt': sess['opened_at'] if sess else None,
                            'waiterId': wid,
                            'waiterName': w_info['name'] if w_info else None,
                            'waiterColor': w_info['color'] if w_info else None,
                            'subtotal': sub,
                        }
                    )

                categories = [
                    {
                        'id': r['id'],
                        'name': r['name'],
                        'icon': r['icon'],
                        'station': r['station'],
                        'sortOrder': r['sort_order'],
                    }
                    for r in conn.execute('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').fetchall()
                ]
                cat_station = {c['id']: c['station'] for c in categories}

                items = [
                    {
                        'id': r['id'],
                        'cat': r['category_id'],
                        'name': r['name'],
                        'desc': r['description'],
                        'price': r['price'],
                        'emoji': r['emoji'],
                        'imageUrl': r['image_url'],
                        'stationOverride': r['station_override'],
                        'effectiveStation': r['station_override'] or cat_station.get(r['category_id'], 'cocina'),
                        'popular': bool(r['popular']),
                        'available': bool(r['available']),
                        'tags': split_tags(r['tags']),
                    }
                    for r in conn.execute('SELECT * FROM items ORDER BY sort_order ASC, id ASC').fetchall()
                ]

                notifications = [
                    {
                        'id': r['id'],
                        'waiterId': r['waiter_id'],
                        'kind': r['kind'],
                        'tableId': r['table_id'],
                        'title': r['title'],
                        'body': r['body'],
                        'shortTitle': r['short_title'] or clip_compact(r['title'], 26),
                        'shortBody': r['short_body'] or clip_compact(r['body'], 48),
                        'read': bool(r['read']),
                        'createdAt': r['created_at'],
                    }
                    for r in conn.execute('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 80').fetchall()
                ]

                closed_history = []
                for cs in closed_today_rows[:50]:
                    t_info = tbl_all.get(cs['table_id'], {})
                    b_info = block_map.get(t_info.get('block_id', ''), {})
                    closed_history.append(
                        {
                            'id': cs['id'],
                            'tableCode': t_info.get('code', '?'),
                            'blockName': b_info.get('name', ''),
                            'waiterName': cs['closed_waiter_name'] or 'Sin mozo',
                            'subtotal': cs['subtotal'],
                            'tipPct': cs['tip_pct'],
                            'tipAmount': cs['tip_amount'],
                            'total': cs['total'],
                            'payment': cs['payment_method'],
                            'closedAt': cs['closed_at'],
                        }
                    )

                open_consumption = sum(open_subtotals.values())
                avg_ticket = round(closed_sales_total / len(closed_today_rows)) if closed_today_rows else 0

                leads = [
                    self._lead_row(r)
                    for r in conn.execute('SELECT * FROM leads ORDER BY created_at DESC LIMIT 50').fetchall()
                ]

                return {
                    'version': self.version,
                    'blockTemplates': BLOCK_TEMPLATES,
                    'restaurant': rest,
                    'blocks': blocks,
                    'tables': tables,
                    'waiters': waiters,
                    'categories': categories,
                    'items': items,
                    'orders': orders_list,
                    'calls': calls_list,
                    'notifications': notifications,
                    'kpis': {
                        'closedSalesToday': closed_sales_total,
                        'closedTipsToday': closed_tips_total,
                        'closedTablesCount': len(closed_today_rows),
                        'openConsumption': open_consumption,
                        'avgTicketClosed': avg_ticket,
                        'byPayment': by_payment,
                    },
                    'closedHistory': closed_history,
                    'leads': leads,
                }
            finally:
                conn.close()

    def get_client_state(self, qr_token: str, legacy_code: str = '') -> dict[str, Any]:
        """Devuelve únicamente la información pública del menú y de la mesa propia del cliente."""
        with self.lock:
            conn = self._connect()
            try:
                rest = conn.execute('SELECT name, subtitle, demo_mode FROM restaurant WHERE id = 1').fetchone()
                tbl = None
                if qr_token:
                    tbl = conn.execute(
                        """
                        SELECT t.*, b.name AS block_name, b.icon AS block_icon
                        FROM tables t JOIN blocks b ON b.id = t.block_id
                        WHERE t.qr_token = ?
                        """,
                        (qr_token,),
                    ).fetchone()
                elif legacy_code and rest['demo_mode']:
                    tbl = conn.execute(
                        """
                        SELECT t.*, b.name AS block_name, b.icon AS block_icon
                        FROM tables t JOIN blocks b ON b.id = t.block_id
                        WHERE UPPER(t.code) = UPPER(?) LIMIT 1
                        """,
                        (legacy_code,),
                    ).fetchone()

                categories = [
                    {'id': r['id'], 'name': r['name'], 'icon': r['icon'], 'station': r['station']}
                    for r in conn.execute('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').fetchall()
                ]
                cat_station = {c['id']: c['station'] for c in categories}
                items = [
                    {
                        'id': r['id'],
                        'cat': r['category_id'],
                        'name': r['name'],
                        'desc': r['description'],
                        'price': r['price'],
                        'emoji': r['emoji'],
                        'imageUrl': r['image_url'],
                        'station': r['station_override'] or cat_station.get(r['category_id'], 'cocina'),
                        'popular': bool(r['popular']),
                        'available': bool(r['available']),
                        'tags': split_tags(r['tags']),
                    }
                    for r in conn.execute('SELECT * FROM items ORDER BY sort_order ASC, id ASC').fetchall()
                ]

                demo_tables = []
                if rest['demo_mode']:
                    demo_tables = [
                        {'code': r['code'], 'blockName': r['block_name'], 'qrToken': r['qr_token']}
                        for r in conn.execute(
                            """
                            SELECT t.code, t.qr_token, b.name AS block_name
                            FROM tables t JOIN blocks b ON b.id = t.block_id
                            WHERE t.active = 1 ORDER BY b.sort_order ASC, t.sort_order ASC
                            """
                        ).fetchall()
                    ]

                if not tbl:
                    return {
                        'version': self.version,
                        'validTable': False,
                        'restaurant': {'name': rest['name'], 'subtitle': rest['subtitle'], 'demoMode': bool(rest['demo_mode'])},
                        'demoTables': demo_tables,
                    }

                sess = conn.execute(
                    "SELECT * FROM table_sessions WHERE table_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1",
                    (tbl['id'],),
                ).fetchone()
                last_closed = conn.execute(
                    "SELECT COALESCE(MAX(closed_at), 0) AS c FROM table_sessions WHERE table_id = ? AND status = 'closed'",
                    (tbl['id'],),
                ).fetchone()['c']

                waiter_info = None
                orders_out: list[dict[str, Any]] = []
                calls_out: list[dict[str, Any]] = []
                subtotal = 0

                if sess:
                    if sess['waiter_id']:
                        w = conn.execute('SELECT name, color FROM waiters WHERE id = ?', (sess['waiter_id'],)).fetchone()
                        if w:
                            waiter_info = {'name': w['name'], 'color': w['color']}
                    ord_rows = conn.execute(
                        'SELECT * FROM orders WHERE session_id = ? ORDER BY created_at ASC',
                        (sess['id'],),
                    ).fetchall()
                    for o in ord_rows:
                        ois = [
                            {
                                'itemId': r['item_id'],
                                'name': r['name'],
                                'emoji': r['emoji'],
                                'price': r['unit_price'],
                                'qty': r['qty'],
                                'note': r['note'],
                            }
                            for r in conn.execute('SELECT * FROM order_items WHERE order_id = ?', (o['id'],)).fetchall()
                        ]
                        o_tot = sum(x['price'] * x['qty'] for x in ois) if o['status'] != 'cancelado' else 0
                        subtotal += o_tot
                        orders_out.append(
                            {
                                'id': o['id'],
                                'station': o['station'],
                                'status': o['status'],
                                'cancelReason': o['cancel_reason'],
                                'items': ois,
                                'total': o_tot,
                                'createdAt': o['created_at'],
                            }
                        )

                    for c in conn.execute('SELECT * FROM calls WHERE session_id = ? ORDER BY created_at ASC', (sess['id'],)).fetchall():
                        calls_out.append(
                            {
                                'id': c['id'],
                                'type': c['type'],
                                'reason': c['reason'],
                                'payment': c['payment'],
                                'tip': c['tip_pct'],
                                'status': c['status'],
                                'createdAt': c['created_at'],
                            }
                        )

                return {
                    'version': self.version,
                    'validTable': True,
                    'restaurant': {'name': rest['name'], 'subtitle': rest['subtitle'], 'demoMode': bool(rest['demo_mode'])},
                    'table': {
                        'id': tbl['id'],
                        'code': tbl['code'],
                        'seats': tbl['seats'],
                        'active': bool(tbl['active']),
                        'qrToken': tbl['qr_token'],
                        'blockName': tbl['block_name'],
                        'blockIcon': tbl['block_icon'],
                    },
                    'waiter': waiter_info,
                    'categories': categories,
                    'items': items,
                    'orders': orders_out,
                    'calls': calls_out,
                    'subtotal': subtotal,
                    'lastClosedAt': last_closed,
                    'demoTables': demo_tables,
                }
            finally:
                conn.close()
