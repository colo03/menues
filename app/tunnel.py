"""Gestor integrado de tunel HTTPS 4G/5G con Cloudflare Tunnel (cloudflared).

Permite exponer SaleListo desde una PC local de mostrador sobre HTTPS publico
apto para datos moviles 4G/5G sin abrir puertos en el router ni pedir Wi-Fi:
- Modo Quick Tunnel: `cloudflared tunnel --no-autoupdate --url http://127.0.0.1:<PORT>`
  generando una URL instantanea `https://*.trycloudflare.com`.
- Modo Tunel Permanente con Token: `cloudflared tunnel --no-autoupdate run`
  leyendo `TUNNEL_TOKEN` por entorno para dominios fijos impresos en acrilico.

100% biblioteca estandar de Python (0 dependencias pip).
"""
from __future__ import annotations

import collections
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

QUICK_TUNNEL_URL_RE = re.compile(r'https://[a-z0-9-]+\.trycloudflare\.com\b', re.IGNORECASE)
TOKEN_READY_RE = re.compile(r'registered tunnel connection|connection .* registered', re.IGNORECASE)
CTRL_CHARS_RE = re.compile(r'[\x00-\x1f\x7f]')

ALLOWED_DOWNLOAD_HOSTS = {
    'github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com',
}
MIN_BINARY_BYTES = 5 * 1024 * 1024      # 5 MB
MAX_BINARY_BYTES = 140 * 1024 * 1024    # 140 MB
MIN_FREE_DISK_BYTES = 120 * 1024 * 1024  # 120 MB libres antes de descargar


class TunnelError(Exception):
    def __init__(self, message: str, *, needs_install: bool = False, status: int = 400):
        super().__init__(message)
        self.needs_install = needs_install
        self.status = status


def _local_binary_name() -> str:
    return 'cloudflared.exe' if os.name == 'nt' else 'cloudflared'


def cloudflared_download_spec() -> tuple[str, str, bool]:
    """Devuelve (url_https, nombre_binario_local, es_tgz) para la plataforma actual."""
    mach = platform.machine().lower()
    if os.name == 'nt' or sys.platform.startswith('win'):
        if mach in ('x86', 'i386', 'i686'):
            asset = 'cloudflared-windows-386.exe'
        else:
            asset = 'cloudflared-windows-amd64.exe'
        return (
            f'https://github.com/cloudflare/cloudflared/releases/latest/download/{asset}',
            'cloudflared.exe',
            False,
        )

    if sys.platform.startswith('linux'):
        if mach in ('aarch64', 'arm64'):
            asset = 'cloudflared-linux-arm64'
        elif mach.startswith('arm'):
            asset = 'cloudflared-linux-arm'
        elif mach in ('i386', 'i686', 'x86'):
            asset = 'cloudflared-linux-386'
        else:
            asset = 'cloudflared-linux-amd64'
        return (
            f'https://github.com/cloudflare/cloudflared/releases/latest/download/{asset}',
            'cloudflared',
            False,
        )

    if sys.platform == 'darwin':
        asset = 'cloudflared-darwin-arm64.tgz' if mach in ('arm64', 'aarch64') else 'cloudflared-darwin-amd64.tgz'
        return (
            f'https://github.com/cloudflare/cloudflared/releases/latest/download/{asset}',
            'cloudflared',
            True,
        )

    raise TunnelError(f'Plataforma no soportada para descarga automatica de cloudflared: {sys.platform}/{mach}')


def find_cloudflared(data_dir: Path) -> Path | None:
    """Busca el binario de cloudflared en CLOUDFLARED_BIN, DATA_DIR/bin y PATH."""
    env_bin = (os.environ.get('CLOUDFLARED_BIN') or '').strip()
    if env_bin:
        p = Path(env_bin)
        if p.is_file():
            return p

    local_bin = data_dir / 'bin' / _local_binary_name()
    if local_bin.is_file() and local_bin.stat().st_size > 0:
        return local_bin

    in_path = shutil.which('cloudflared')
    if in_path:
        return Path(in_path)

    if os.name == 'nt':
        for candidate in (
            Path(r'C:\Program Files (x86)\cloudflared\cloudflared.exe'),
            Path(r'C:\Program Files\cloudflared\cloudflared.exe'),
        ):
            if candidate.is_file():
                return candidate

    return None


def _validate_download_url(url: str) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or '').lower()
    if parsed.scheme != 'https' or host not in ALLOWED_DOWNLOAD_HOSTS:
        raise TunnelError(f'Origen de descarga no autorizado: {url}', status=400)


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_download_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def install_cloudflared(data_dir: Path, timeout_s: int = 90) -> Path:
    """Descarga y verifica el binario oficial de Cloudflare dentro de DATA_DIR/bin/."""
    bin_dir = data_dir / 'bin'
    bin_dir.mkdir(parents=True, exist_ok=True)

    free_bytes = shutil.disk_usage(bin_dir).free
    if free_bytes < MIN_FREE_DISK_BYTES:
        mb = free_bytes / (1024 * 1024)
        raise TunnelError(
            f'Espacio insuficiente en disco ({mb:.1f} MB libres). Libera al menos 120 MB antes de instalar cloudflared.',
            status=507,
        )

    url, bin_name, is_tgz = cloudflared_download_spec()
    _validate_download_url(url)

    dest = bin_dir / bin_name
    tmp_dl = bin_dir / f'.{bin_name}.download.tmp'
    tmp_bin = bin_dir / f'.{bin_name}.verify.tmp'

    opener = urllib.request.build_opener(_SafeRedirectHandler())
    req = urllib.request.Request(url, headers={'User-Agent': 'SaleListo-TunnelInstaller/1.0'})

    try:
        total = 0
        with opener.open(req, timeout=timeout_s) as resp:
            final_url = resp.geturl()
            _validate_download_url(final_url)
            with tmp_dl.open('wb') as fh:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_BINARY_BYTES:
                        raise TunnelError('El binario descargado excede el tamano maximo esperado.', status=502)
                    fh.write(chunk)

        if total < MIN_BINARY_BYTES:
            raise TunnelError(
                f'Descarga incompleta de cloudflared ({total} bytes). Reintenta con mejor conexion.',
                status=502,
            )

        if is_tgz:
            extracted = False
            with tarfile.open(tmp_dl, 'r:gz') as tf:
                for member in tf.getmembers():
                    if member.isfile() and Path(member.name).name == 'cloudflared':
                        src = tf.extractfile(member)
                        if src is None:
                            continue
                        with tmp_bin.open('wb') as out:
                            shutil.copyfileobj(src, out)
                        extracted = True
                        break
            if not extracted:
                raise TunnelError('No se encontro el ejecutable cloudflared dentro del archivo .tgz', status=502)
            tmp_dl.unlink(missing_ok=True)
        else:
            tmp_dl.replace(tmp_bin)

        head = tmp_bin.read_bytes()[:4]
        if os.name == 'nt':
            if not head.startswith(b'MZ'):
                raise TunnelError('El archivo descargado no es un ejecutable valido de Windows.', status=502)
        elif sys.platform.startswith('linux'):
            if head != b'\x7fELF':
                raise TunnelError('El archivo descargado no es un ejecutable ELF valido de Linux.', status=502)

        if os.name != 'nt':
            tmp_bin.chmod(tmp_bin.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

        # Verificar que el binario realmente ejecuta --version
        creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        chk = subprocess.run(
            [str(tmp_bin), '--version'],
            capture_output=True,
            text=True,
            timeout=15,
            creationflags=creationflags,
        )
        ver_out = ((chk.stdout or '') + ' ' + (chk.stderr or '')).lower()
        if chk.returncode != 0 or 'cloudflared' not in ver_out:
            raise TunnelError('El binario descargado de cloudflared no paso la verificacion de ejecucion.', status=502)

        tmp_bin.replace(dest)
        return dest
    except TunnelError:
        tmp_dl.unlink(missing_ok=True)
        tmp_bin.unlink(missing_ok=True)
        raise
    except (urllib.error.URLError, OSError, subprocess.SubprocessError, tarfile.TarError) as err:
        tmp_dl.unlink(missing_ok=True)
        tmp_bin.unlink(missing_ok=True)
        raise TunnelError(f'No se pudo descargar cloudflared automaticamente: {err}', status=502) from err


class TunnelManager:
    """Administra el ciclo de vida de un proceso cloudflared en segundo plano."""

    def __init__(
        self,
        data_dir: Path,
        default_port: int = 8123,
        on_change: Callable[[], None] | None = None,
        process_factory: Callable[..., Any] | None = None,
    ):
        self.data_dir = Path(data_dir)
        self.default_port = int(default_port)
        self.on_change = on_change
        self._process_factory = process_factory
        self._lock = threading.RLock()

        self._proc: Any = None
        self._reader_thread: threading.Thread | None = None
        self._state: str = 'stopped'  # stopped | installing | starting | running | error
        self._mode: str = 'none'      # none | quick | token
        self._public_url: str = ''
        self._target_port: int = self.default_port
        self._started_at: int = 0
        self._last_error: str = ''
        self._binary_path: str = ''
        self._stopping: bool = False
        self._logs: collections.deque[str] = collections.deque(maxlen=25)

    def _notify_change(self) -> None:
        cb = self.on_change
        if cb:
            try:
                cb()
            except Exception:
                pass

    def _sync_liveness_locked(self) -> None:
        if self._proc is not None and self._proc.poll() is not None:
            if not self._stopping and self._state in ('starting', 'running'):
                self._state = 'error'
                if not self._last_error:
                    self._last_error = f'cloudflared finalizo (codigo {self._proc.returncode})'
            elif self._stopping:
                self._state = 'stopped'
            self._public_url = ''
            self._proc = None

    def active_url(self) -> str:
        with self._lock:
            self._sync_liveness_locked()
            if self._state == 'running' and self._public_url:
                return self._public_url
            return ''

    def status(self, include_details: bool = True) -> dict[str, Any]:
        with self._lock:
            self._sync_liveness_locked()
            found = find_cloudflared(self.data_dir)
            base: dict[str, Any] = {
                'state': self._state,
                'active': self._state == 'running',
                'mode': self._mode,
                'publicUrl': self._public_url,
                'startedAt': self._started_at,
                'targetUrl': f'http://127.0.0.1:{self._target_port}',
            }
            if include_details:
                base.update(
                    {
                        'binaryInstalled': bool(found),
                        'binaryName': found.name if found else '',
                        'tokenConfigured': bool((os.environ.get('CLOUDFLARE_TUNNEL_TOKEN') or '').strip()),
                        'lastError': self._last_error,
                        'pid': self._proc.pid if self._proc is not None else None,
                    }
                )
            return base

    def start(
        self,
        *,
        port: int | None = None,
        mode: str = 'auto',
        token: str = '',
        auto_install: bool = False,
        wait_seconds: float = 18.0,
    ) -> dict[str, Any]:
        use_port = int(port or self.default_port)
        env_token = (os.environ.get('CLOUDFLARE_TUNNEL_TOKEN') or '').strip()
        clean_token = str(token or '').strip()

        if mode == 'token' or clean_token:
            eff_mode = 'token'
            eff_token = clean_token or env_token
            if not eff_token:
                raise TunnelError('Falta CLOUDFLARE_TUNNEL_TOKEN para iniciar un tunel permanente.', status=400)
            if CTRL_CHARS_RE.search(eff_token):
                raise TunnelError('El token de tunel contiene caracteres de control invalidos.', status=400)
        elif mode == 'auto' and env_token:
            eff_mode = 'token'
            eff_token = env_token
            if CTRL_CHARS_RE.search(eff_token):
                raise TunnelError('CLOUDFLARE_TUNNEL_TOKEN contiene caracteres de control invalidos.', status=400)
        else:
            eff_mode = 'quick'
            eff_token = ''

        with self._lock:
            self._sync_liveness_locked()
            if self._state in ('running', 'starting') and self._proc is not None:
                return self.status(include_details=True)
            if self._state == 'installing':
                raise TunnelError('Ya hay una instalacion de cloudflared en curso. Espera unos segundos.', status=409)

            self._target_port = use_port
            self._last_error = ''
            self._public_url = ''
            self._mode = eff_mode
            self._stopping = False

            bin_path = find_cloudflared(self.data_dir)
            if bin_path is None and self._process_factory is None:
                if not auto_install:
                    self._state = 'stopped'
                    self._mode = 'none'
                    raise TunnelError(
                        'cloudflared no esta instalado en esta PC. Podes instalarlo en 1 clic desde el panel o descargarlo manualmente.',
                        needs_install=True,
                        status=400,
                    )
                self._state = 'installing'
                self._notify_change()

        # Instalacion fuera del lock para no bloquear lecturas de estado
        if bin_path is None and self._process_factory is None:
            try:
                bin_path = install_cloudflared(self.data_dir)
            except TunnelError as err:
                with self._lock:
                    self._state = 'error'
                    self._mode = 'none'
                    self._last_error = str(err)
                self._notify_change()
                raise

        bin_str = str(bin_path) if bin_path is not None else 'cloudflared'
        if eff_mode == 'token':
            cmd = [bin_str, 'tunnel', '--no-autoupdate', 'run']
        else:
            cmd = [bin_str, 'tunnel', '--no-autoupdate', '--url', f'http://127.0.0.1:{use_port}']

        proc_env = os.environ.copy()
        if eff_token:
            proc_env['TUNNEL_TOKEN'] = eff_token

        ready_evt = threading.Event()
        exited_evt = threading.Event()

        with self._lock:
            self._binary_path = bin_str
            self._state = 'starting'
            self._logs.clear()
            try:
                if self._process_factory is not None:
                    proc = self._process_factory(cmd, env=proc_env)
                else:
                    creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
                    proc = subprocess.Popen(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        encoding='utf-8',
                        errors='replace',
                        bufsize=1,
                        env=proc_env,
                        creationflags=creationflags,
                    )
            except (OSError, ValueError) as err:
                self._state = 'error'
                self._mode = 'none'
                self._last_error = f'No se pudo ejecutar cloudflared: {err}'
                self._notify_change()
                raise TunnelError(self._last_error, status=500) from err

            self._proc = proc
            self._started_at = int(time.time() * 1000)

            t = threading.Thread(
                target=self._watch_process,
                args=(proc, eff_mode, eff_token, ready_evt, exited_evt),
                name='salelisto-cloudflared',
                daemon=True,
            )
            self._reader_thread = t
            t.start()

        self._notify_change()

        deadline = time.monotonic() + max(0.5, float(wait_seconds))
        while time.monotonic() < deadline:
            if ready_evt.is_set() or exited_evt.is_set():
                break
            time.sleep(0.08)

        with self._lock:
            self._sync_liveness_locked()
            if self._state == 'error':
                err_msg = self._last_error or 'El tunel cloudflared se cerro antes de establecer conexion.'
                raise TunnelError(err_msg, status=502)
            # Para tunel por token, si sigue vivo tras el timeout sin error, marcarlo en ejecucion
            if eff_mode == 'token' and self._state == 'starting' and self._proc is not None and self._proc.poll() is None:
                self._state = 'running'
            st = self.status(include_details=True)

        if st['active']:
            self._notify_change()
        return st

    def _watch_process(
        self,
        proc: Any,
        mode: str,
        secret_token: str,
        ready_evt: threading.Event,
        exited_evt: threading.Event,
    ) -> None:
        stream = getattr(proc, 'stdout', None) or getattr(proc, 'stderr', None)
        last_nonempty = ''
        try:
            if stream is not None:
                for raw_line in iter(stream.readline, ''):
                    line = str(raw_line).strip()
                    if not line:
                        continue
                    if secret_token and secret_token in line:
                        line = line.replace(secret_token, '***')
                    last_nonempty = line[:240]
                    changed = False
                    with self._lock:
                        if self._proc is not proc:
                            return
                        self._logs.append(last_nonempty)
                        if mode == 'quick':
                            m = QUICK_TUNNEL_URL_RE.search(line)
                            if m:
                                url = m.group(0).rstrip('/')
                                if self._public_url != url or self._state != 'running':
                                    self._public_url = url
                                    self._state = 'running'
                                    self._last_error = ''
                                    changed = True
                                ready_evt.set()
                        elif mode == 'token' and TOKEN_READY_RE.search(line):
                            if self._state != 'running':
                                self._state = 'running'
                                self._last_error = ''
                                changed = True
                            ready_evt.set()
                    if changed:
                        self._notify_change()
        except Exception:
            pass
        finally:
            try:
                proc.wait(timeout=2)
            except Exception:
                pass
            changed = False
            with self._lock:
                if self._proc is proc:
                    rc = proc.poll()
                    was_stopping = self._stopping
                    self._proc = None
                    self._public_url = ''
                    if was_stopping:
                        self._state = 'stopped'
                        self._mode = 'none'
                    else:
                        self._state = 'error'
                        self._last_error = (
                            last_nonempty
                            if last_nonempty
                            else f'cloudflared finalizo inesperadamente (codigo {rc})'
                        )
                    changed = True
            exited_evt.set()
            if changed:
                self._notify_change()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            proc = self._proc
            self._stopping = True
            self._public_url = ''
            self._last_error = ''
            if proc is None:
                self._state = 'stopped'
                self._mode = 'none'
                return self.status(include_details=True)

        try:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
                try:
                    proc.wait(timeout=2)
                except Exception:
                    pass
        except Exception:
            pass

        with self._lock:
            self._proc = None
            self._state = 'stopped'
            self._mode = 'none'
            self._public_url = ''
            st = self.status(include_details=True)

        self._notify_change()
        return st
