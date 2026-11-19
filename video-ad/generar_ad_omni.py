#!/usr/bin/env python3
"""
Pipeline open-ended hacia Gemini Omni 1.2 Flash (Google Flow Ultra) para SaleListo.

Envia unicamente la direccion creativa abierta y la narracion rioplatense completa,
dejando la puesta visual e interpretacion cinematografica a cargo de Omni 1.2 Flash.
Reutiliza omni_bridge.py cuando esta presente en la raiz local (ignorado en Git)
o conecta de forma autonoma por CDP leyendo DevToolsActivePort (puerto 9222).
"""

import sys

sys.dont_write_bytecode = True

import argparse
import base64
import importlib.util
import json
import os
import shutil
import time
import urllib.request
from pathlib import Path

VIDEO_AD_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = VIDEO_AD_DIR.parent
DEFAULT_OUTPUT = VIDEO_AD_DIR / "SaleListo_Ad_Omni.mp4"
STAGING_DIR = PROJECT_ROOT / "renders_omni"
LOGO_REF_IMAGE = PROJECT_ROOT / "app" / "public" / "icon-512.png"
OMNI_BRIDGE_PATH = PROJECT_ROOT / "omni_bridge.py"

DEFAULT_CDP_HTTP = "http://127.0.0.1:9222"
FLOW_URL = "https://labs.google/fx/tools/flow"

OPEN_ENDED_PROMPT = (
    "Comercial vertical (9:16) cálido y cinematográfico para SaleListo, "
    "plataforma para restaurantes y bares donde los clientes piden con 4G "
    "desde el QR de su mesa, la cocina y la barra reciben cada parte al "
    "instante y los mozos trabajan tranquilos sin celular en la mano "
    "(usando pantalla fija en el pase o pulsera vibradora), con 0% comisión "
    "y contacto WhatsApp (+54)1138436571 | ventas@salelisto.com. Interpretá "
    "visualmente con total libertad creativa esta narración en voz femenina "
    "rioplatense natural: \"¿Tus mozos corren a mil queriendo estar en todos "
    "lados? Bajales esa exigencia. Con SaleListo, el cliente escanea el QR "
    "con 4G, sin esperar carta ni wifi, y pide tranquilo. La comanda se "
    "separa sola entre cocina y barra, y el salón reparte bloques "
    "equilibrando al equipo en vivo. Sin celulares en el salón: miran la "
    "estación del pase, o les vibra la pulsera al salir. Simplificales la "
    "vida a ellos y al restaurante, con cero comisión. Escribinos por "
    "WhatsApp, y probalo.\""
)

PROMPT_SELECTORS = [
    "textarea",
    '[contenteditable="true"]',
    '[role="textbox"]',
]

SUBMIT_SELECTORS = [
    'button[aria-label*="Generate" i]',
    'button[aria-label*="Generar" i]',
    'button[aria-label*="Create" i]',
    'button[aria-label*="Crear" i]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Enviar" i]',
    'button[type="submit"]',
    'button:has-text("arrow_forward")',
]

DOWNLOAD_SELECTORS = [
    'button[aria-label*="Download" i]',
    'button[aria-label*="Descargar" i]',
    "a[download]",
    'button:has-text("download")',
]


def load_omni_bridge():
    """Carga omni_bridge.py desde la raiz local si existe, sin generar __pycache__."""
    if not OMNI_BRIDGE_PATH.is_file():
        return None
    try:
        spec = importlib.util.spec_from_file_location("omni_bridge", str(OMNI_BRIDGE_PATH))
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module
    except Exception:
        return None
    return None


def resolve_cdp_endpoint(explicit_cdp: str | None = None, bridge_mod=None) -> str:
    """Detecta el endpoint CDP activo (ws://127.0.0.1:9222/... o http://127.0.0.1:9222)."""
    if explicit_cdp:
        return explicit_cdp.strip()
    env_cdp = os.environ.get("OMNI_CDP_URL", "").strip()
    if env_cdp:
        return env_cdp

    if bridge_mod and hasattr(bridge_mod, "resolve_cdp_endpoint"):
        try:
            candidate = bridge_mod.resolve_cdp_endpoint()
            if candidate and candidate.startswith("ws://"):
                return candidate
        except Exception:
            pass

    search_roots = []
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        search_roots.append(Path(local_app_data))
    home = Path.home()
    for rel in (".config", "Library/Application Support"):
        cand_dir = home / rel
        if cand_dir.is_dir():
            search_roots.append(cand_dir)

    patterns = (
        "*/*/User Data/DevToolsActivePort",
        "*/User Data/DevToolsActivePort",
        "*/DevToolsActivePort",
    )
    for root in search_roots:
        for pattern in patterns:
            for port_file in root.glob(pattern):
                try:
                    lines = [
                        ln.strip()
                        for ln in port_file.read_text(encoding="utf-8", errors="ignore").splitlines()
                        if ln.strip()
                    ]
                    if len(lines) >= 2 and lines[0] == "9222":
                        return f"ws://127.0.0.1:9222{lines[1]}"
                except OSError:
                    continue

    try:
        with urllib.request.urlopen(f"{DEFAULT_CDP_HTTP}/json/version", timeout=1.5) as resp:
            meta = json.loads(resp.read().decode("utf-8", errors="ignore"))
            ws_url = meta.get("webSocketDebuggerUrl")
            if ws_url:
                return ws_url
    except Exception:
        pass

    return DEFAULT_CDP_HTTP


def print_brave_allow_guide(endpoint: str, cdp_timeout: int) -> None:
    """Muestra una guia amigable de 3 pasos sin traza rota cuando CDP espera aprobacion."""
    print(
        "\n========================================================================\n"
        "[SaleListo Omni] Conexion CDP en espera de aprobacion en el navegador\n"
        "========================================================================\n"
        f"Endpoint detectado: {endpoint} (timeout={cdp_timeout}s)\n"
        "El navegador recibio la solicitud de conexion, pero todavia espera clic\n"
        "en el cartel de seguridad de depuracion remota o no tiene puerto 9222.\n\n"
        "Segui estos 3 pasos para generar el spot:\n"
        "  1. Pasa a la ventana de Brave donde tenes abierto Google Flow\n"
        f"     ({FLOW_URL}) con tu cuenta iniciada.\n"
        "  2. En el cartel de seguridad de depuracion remota de Brave, hace clic\n"
        "     en [Allow] / [Permitir] (si no aparece, verifica que siga activo\n"
        "     chrome://inspect/#remote-debugging).\n"
        "  3. Ejecuta nuevamente en esta terminal:\n"
        "       python video-ad/generar_ad_omni.py\n"
        "     (Consejo: usa --cdp-timeout 25 si queres 25 s de margen para pasar\n"
        "     a Brave y pulsar [Allow] en vivo, o --with-logo para adjuntar el\n"
        "     isotipo app/public/icon-512.png).\n"
        "========================================================================"
    )


def get_flow_page(context, bridge_mod=None):
    """Obtiene la pestaña abierta de Google Flow o abre una nueva."""
    if bridge_mod and hasattr(bridge_mod, "get_flow_page"):
        page = bridge_mod.get_flow_page(context)
    else:
        page = None
        for existing in context.pages:
            if "labs.google" in existing.url:
                existing.bring_to_front()
                page = existing
                break
        if page is None:
            page = context.new_page()
            page.goto(FLOW_URL, wait_until="domcontentloaded")

    try:
        page.wait_for_load_state("domcontentloaded", timeout=10000)
    except Exception:
        pass
    return page


def inspect_dom(page, bridge_mod=None) -> None:
    """Vuelca los elementos interactivos visibles de Flow y valida selectores."""
    if bridge_mod and hasattr(bridge_mod, "inspect_dom"):
        bridge_mod.inspect_dom(page)
    else:
        data = page.evaluate(
            """() => {
                const els = Array.from(document.querySelectorAll(
                    'textarea, input, button, [role="button"], [contenteditable="true"], [role="textbox"], video'
                ));
                return els.filter(el => el.offsetParent !== null || el.tagName === 'INPUT').map(el => ({
                    tag: el.tagName.toLowerCase(),
                    type: el.getAttribute('type') || '',
                    role: el.getAttribute('role') || '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    placeholder: el.getAttribute('placeholder') || '',
                    text: (el.innerText || '').trim().slice(0, 60)
                }));
            }"""
        )
        print(json.dumps(data, indent=2, ensure_ascii=False))

    summary = verify_flow_selectors(page)
    print("\n[SaleListo Omni] Resumen de verificacion de selectores en Flow:")
    print(json.dumps(summary, indent=2, ensure_ascii=False))


def first_visible_selector(page, selectors: list[str]) -> str | None:
    """Devuelve el primer selector con al menos un elemento visible en la pagina."""
    for sel in selectors:
        loc = page.locator(sel)
        count = loc.count()
        for idx in range(count):
            try:
                if loc.nth(idx).is_visible():
                    return sel
            except Exception:
                continue
    return None


def verify_flow_selectors(page) -> dict:
    """Verifica que selectores reales estan disponibles en la pestaña actual de Flow."""
    prompt_sel = first_visible_selector(page, PROMPT_SELECTORS)
    submit_sel = first_visible_selector(page, SUBMIT_SELECTORS)
    file_inputs = page.locator('input[type="file"]').count()
    videos = page.locator("video").count()
    return {
        "url": page.url,
        "prompt_selector": prompt_sel,
        "submit_selector": submit_sel,
        "file_input_count": file_inputs,
        "video_count": videos,
        "ready_for_prompt": bool(prompt_sel),
    }


def ensure_project_editor_open(page) -> dict:
    """Si Flow esta en la portada de proyectos, intenta abrir un proyecto nuevo."""
    deadline = time.time() + 8.0
    while time.time() < deadline:
        info = verify_flow_selectors(page)
        if info["ready_for_prompt"]:
            return info
        time.sleep(0.8)

    new_proj_selectors = [
        'button:has-text("New project")',
        'button:has-text("Nuevo proyecto")',
        'button:has-text("Create with Flow")',
        'a:has-text("Create with Flow")',
    ]
    btn_sel = first_visible_selector(page, new_proj_selectors)
    if btn_sel:
        print(f"[SaleListo Omni] Abriendo editor de proyecto en Flow ({btn_sel})...")
        page.locator(btn_sel).first.click()
        wait_until = time.time() + 12.0
        while time.time() < wait_until:
            info = verify_flow_selectors(page)
            if info["ready_for_prompt"]:
                return info
            time.sleep(1.0)

    return verify_flow_selectors(page)


def try_select_vertical_aspect(page) -> None:
    """Intenta seleccionar relacion de aspecto 9:16 si el control esta visible en UI."""
    try:
        ratio_btn = page.locator(
            'button:has-text("9:16"), [role="radio"]:has-text("9:16"), [role="option"]:has-text("9:16")'
        ).first
        if ratio_btn.count() > 0 and ratio_btn.is_visible():
            ratio_btn.click()
            time.sleep(0.4)
    except Exception:
        pass


def wait_for_new_mp4(out_dir: Path, before_files: set[Path], timeout_sec: int, bridge_mod=None) -> Path:
    """Espera a que finalice la descarga de un archivo .mp4 estable."""
    if bridge_mod and hasattr(bridge_mod, "wait_for_new_mp4"):
        return bridge_mod.wait_for_new_mp4(out_dir, before_files, timeout_sec=timeout_sec)

    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        current = set(out_dir.glob("*.mp4"))
        for candidate in current - before_files:
            if not Path(f"{candidate}.crdownload").exists() and candidate.stat().st_size > 0:
                size_1 = candidate.stat().st_size
                time.sleep(1.0)
                if candidate.exists() and candidate.stat().st_size == size_1:
                    return candidate
        time.sleep(1.5)
    raise TimeoutError("No se detecto la descarga del .mp4 dentro del tiempo limite.")


def fallback_fetch_video_bytes(page, video_src: str, dest_path: Path) -> bool:
    """Descarga directa del stream de video desde el contexto del navegador como respaldo."""
    if not video_src:
        return False
    try:
        b64_payload = page.evaluate(
            """async (src) => {
                const resp = await fetch(src);
                if (!resp.ok) return null;
                const buf = await resp.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
                }
                return btoa(binary);
            }""",
            video_src,
        )
        if b64_payload:
            raw = base64.b64decode(b64_payload)
            if len(raw) > 1024:
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                dest_path.write_bytes(raw)
                return True
    except Exception:
        return False
    return False


def run_pipeline(args: argparse.Namespace) -> int:
    if args.print_prompt:
        print(args.prompt)
        return 0

    try:
        from playwright.sync_api import (
            Error as PlaywrightError,
            TimeoutError as PlaywrightTimeoutError,
            sync_playwright,
        )
    except ImportError:
        print(
            "[SaleListo Omni] Falta instalar Playwright en Python.\n"
            "Ejecuta: pip install playwright"
        )
        return 1

    images: list[Path] = []
    if args.with_logo:
        if not LOGO_REF_IMAGE.is_file():
            print(f"[SaleListo Omni] No se encontro el isotipo de referencia: {LOGO_REF_IMAGE.name}")
            return 1
        images.append(LOGO_REF_IMAGE)
    for img_arg in args.image:
        img_path = Path(img_arg).resolve()
        if not img_path.is_file():
            print(f"[SaleListo Omni] No se encontro la imagen indicada en --image: {img_arg}")
            return 1
        images.append(img_path)

    bridge_mod = load_omni_bridge()
    endpoint = resolve_cdp_endpoint(args.cdp, bridge_mod=bridge_mod)
    bridge_label = "omni_bridge.py local + CDP" if bridge_mod else "CDP directo"
    print(f"[SaleListo Omni] Conectando ({bridge_label}) -> {endpoint} (timeout={args.cdp_timeout}s)...")

    out_path = Path(args.out).resolve()
    staging_created = False

    try:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.connect_over_cdp(
                    endpoint,
                    timeout=max(1, int(args.cdp_timeout * 1000)),
                )
            except (PlaywrightTimeoutError, TimeoutError):
                print_brave_allow_guide(endpoint, args.cdp_timeout)
                return 2
            except PlaywrightError as exc:
                msg = str(exc)
                if "Timeout" in msg or "ECONNREFUSED" in msg or "404" in msg or "WebSocket" in msg:
                    print_brave_allow_guide(endpoint, args.cdp_timeout)
                    return 2
                print(f"[SaleListo Omni] Error al conectar por CDP: {msg}")
                return 1

            context = browser.contexts[0] if browser.contexts else browser.new_context()
            page = get_flow_page(context, bridge_mod=bridge_mod)

            if args.inspect:
                inspect_dom(page, bridge_mod=bridge_mod)
                return 0

            selectors_info = ensure_project_editor_open(page)
            if not selectors_info["ready_for_prompt"]:
                print(
                    "[SaleListo Omni] Conectado a Brave, pero no se encontro la caja de prompt en Google Flow.\n"
                    f"URL actual de la pestaña: {selectors_info['url']}\n"
                    "Verifica que tu sesion de Google Labs Flow este iniciada y dentro de un proyecto,\n"
                    "o ejecuta `python video-ad/generar_ad_omni.py --inspect` para diagnosticar el DOM."
                )
                return 1

            print(
                f"[SaleListo Omni] Selectores verificados en Flow: "
                f"prompt={selectors_info['prompt_selector']}, "
                f"submit={selectors_info['submit_selector'] or 'Enter'}, "
                f"videos_previos={selectors_info['video_count']}"
            )

            staging_existed = STAGING_DIR.exists()
            STAGING_DIR.mkdir(parents=True, exist_ok=True)
            staging_created = not staging_existed
            before_files = set(STAGING_DIR.glob("*.mp4"))

            cdp_session = context.new_cdp_session(page)
            cdp_session.send(
                "Browser.setDownloadBehavior",
                {"behavior": "allow", "downloadPath": str(STAGING_DIR.resolve())},
            )

            if images:
                file_input = page.locator('input[type="file"]').first
                if file_input.count() == 0:
                    attach_sel = first_visible_selector(
                        page,
                        [
                            'button[aria-label*="Add" i]',
                            'button[aria-label*="Agregar" i]',
                            'button[aria-label*="Upload" i]',
                            'button[aria-label*="Image" i]',
                        ],
                    )
                    if attach_sel:
                        page.locator(attach_sel).first.click()
                        time.sleep(0.8)
                if page.locator('input[type="file"]').count() > 0:
                    page.locator('input[type="file"]').first.set_input_files(
                        [str(p.resolve()) for p in images]
                    )
                    print(f"[SaleListo Omni] Imagenes de referencia cargadas ({len(images)}).")
                    time.sleep(2.0)
                else:
                    print("[SaleListo Omni] Aviso: Flow no expuso input[type=file]; se continua solo con texto.")

            try_select_vertical_aspect(page)

            prev_state = page.evaluate(
                """() => {
                    const vids = Array.from(document.querySelectorAll('video'));
                    return {
                        count: vids.length,
                        srcs: vids.map(v => v.currentSrc || v.src || '').filter(Boolean)
                    };
                }"""
            )
            prev_count = int(prev_state["count"])
            prev_srcs = set(prev_state["srcs"])

            prompt_sel = selectors_info["prompt_selector"]
            prompt_loc = page.locator(prompt_sel)
            target_box = prompt_loc.first
            for idx in range(prompt_loc.count()):
                if prompt_loc.nth(idx).is_visible():
                    target_box = prompt_loc.nth(idx)
                    break

            target_box.click()
            try:
                target_box.fill(args.prompt)
            except Exception:
                page.keyboard.press("Control+A")
                page.keyboard.insert_text(args.prompt)
            time.sleep(0.6)

            submit_sel = first_visible_selector(page, SUBMIT_SELECTORS)
            if submit_sel:
                submit_loc = page.locator(submit_sel)
                clicked = False
                for idx in range(submit_loc.count()):
                    cand = submit_loc.nth(idx)
                    if cand.is_visible() and cand.is_enabled():
                        cand.click()
                        clicked = True
                        break
                if not clicked:
                    target_box.press("Enter")
            else:
                target_box.press("Enter")

            print(
                f"[SaleListo Omni] Prompt open-ended enviado a Omni 1.2 Flash. "
                f"Esperando generacion (hasta {args.timeout}s)..."
            )

            deadline = time.time() + args.timeout
            new_video_src = ""
            new_video_ready = False
            while time.time() < deadline:
                cur_state = page.evaluate(
                    """() => {
                        const vids = Array.from(document.querySelectorAll('video'));
                        return vids.map((v, idx) => ({
                            idx,
                            src: v.currentSrc || v.src || '',
                            readyState: v.readyState
                        }));
                    }"""
                )
                for item in cur_state:
                    src = item["src"]
                    if src and (src not in prev_srcs or len(cur_state) > prev_count):
                        new_video_src = src
                        new_video_ready = True
                        break
                if new_video_ready:
                    break
                time.sleep(3.0)

            if not new_video_ready:
                print(
                    "[SaleListo Omni] El render en Google Flow supero el tiempo de espera "
                    f"({args.timeout}s). Revisa la pestaña activa de Flow y reintenta con --timeout 360."
                )
                return 1

            time.sleep(1.5)
            try:
                page.locator("video").first.hover()
                time.sleep(0.5)
            except Exception:
                pass

            downloaded_mp4: Path | None = None
            dl_sel = first_visible_selector(page, DOWNLOAD_SELECTORS)
            if dl_sel:
                page.locator(dl_sel).first.click()
                time.sleep(1.2)
                menu_opt = first_visible_selector(
                    page,
                    [
                        '[role="menuitem"]:has-text("1080")',
                        '[role="menuitem"]:has-text("720")',
                        '[role="menuitem"]:has-text("Original")',
                        '[role="menuitem"]:has-text("MP4")',
                    ],
                )
                if menu_opt:
                    page.locator(menu_opt).first.click()

                try:
                    downloaded_mp4 = wait_for_new_mp4(
                        STAGING_DIR, before_files, timeout_sec=45, bridge_mod=bridge_mod
                    )
                except TimeoutError:
                    downloaded_mp4 = None

            out_path.parent.mkdir(parents=True, exist_ok=True)
            if downloaded_mp4 and downloaded_mp4.is_file():
                shutil.move(str(downloaded_mp4), str(out_path))
            elif fallback_fetch_video_bytes(page, new_video_src, out_path):
                pass
            else:
                print(
                    "[SaleListo Omni] El clip termino de renderizarse en Google Flow, pero no se pudo "
                    "automatizar el boton de descarga. Descargalo desde la pestaña de Flow como "
                    f"`{out_path.name}`."
                )
                return 1

            size_mb = round(out_path.stat().st_size / (1024 * 1024), 2)
            result_payload = {
                "status": "ok",
                "output": str(out_path.relative_to(PROJECT_ROOT))
                if out_path.is_relative_to(PROJECT_ROOT)
                else out_path.name,
                "size_mb": size_mb,
            }
            print(json.dumps(result_payload, ensure_ascii=False))
            return 0
    finally:
        if staging_created and STAGING_DIR.is_dir():
            try:
                if not any(STAGING_DIR.iterdir()):
                    STAGING_DIR.rmdir()
            except OSError:
                pass


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Genera SaleListo_Ad_Omni.mp4 en Google Flow (Gemini Omni 1.2 Flash) via CDP."
    )
    parser.add_argument(
        "--inspect",
        action="store_true",
        help="Inspecciona el DOM real de Google Flow y verifica los selectores activos.",
    )
    parser.add_argument(
        "--with-logo",
        action="store_true",
        help="Adjunta app/public/icon-512.png como imagen de referencia en Omni 1.2 Flash.",
    )
    parser.add_argument(
        "--image",
        action="append",
        default=[],
        help="Ruta de imagen de referencia adicional (repetible).",
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default=OPEN_ENDED_PROMPT,
        help="Prompt open-ended (por defecto usa la direccion creativa + locucion oficial v5).",
    )
    parser.add_argument(
        "--print-prompt",
        action="store_true",
        help="Imprime el prompt open-ended oficial en consola y finaliza.",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(DEFAULT_OUTPUT),
        help="Archivo MP4 de salida (por defecto video-ad/SaleListo_Ad_Omni.mp4).",
    )
    parser.add_argument(
        "--cdp",
        type=str,
        default=None,
        help="Endpoint CDP explicito (ws://127.0.0.1:9222/... o http://127.0.0.1:9222).",
    )
    parser.add_argument(
        "--cdp-timeout",
        type=int,
        default=8,
        help="Segundos maximos para conectar por CDP al navegador (por defecto 8).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=240,
        help="Segundos maximos de espera para el render de video en Google Flow (por defecto 240).",
    )
    return parser


if __name__ == "__main__":
    raise SystemExit(run_pipeline(build_arg_parser().parse_args()))
