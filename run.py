import asyncio
import os
import socket
import sys
from pathlib import Path
import uvicorn
from app.main import app

# Domain & Certificate paths
CERTS_DIR = Path(__file__).resolve().parent / "certs"
CERT_FILE = CERTS_DIR / "cert.pem"
KEY_FILE = CERTS_DIR / "key.pem"
DOMAIN = "local.getzenbasket.com"
PRIMARY_IP = "172.17.0.38"

def can_bind(host: str, port: int) -> bool:
    """Test if a socket can be opened and bound on the specified port without permission errors."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((host, port))
            return True
    except Exception:
        return False

def setup_ssl():
    """Ensure SSL certificates exist. Auto-generates SAN certificate for local.getzenbasket.com if not present."""
    enable_ssl = os.environ.get("ENABLE_SSL", "true").lower() in ("true", "1", "yes")
    if not enable_ssl:
        return None, None

    if not (CERT_FILE.exists() and KEY_FILE.exists()):
        try:
            from generate_ssl import ensure_ssl_certificates
            ensure_ssl_certificates(domain=DOMAIN)
        except Exception as e:
            print(f"  [Notice] Could not initialize SSL: {e}. Running on standard HTTP.", flush=True)
            return None, None

    if CERT_FILE.exists() and KEY_FILE.exists():
        return str(CERT_FILE), str(KEY_FILE)
    return None, None

async def safe_serve(server: uvicorn.Server, port: int):
    try:
        await server.serve()
    except BaseException as e:
        print(f"  Note: Server on Port {port} exited: {e}", flush=True)

async def run_servers():
    cert_path, key_path = setup_ssl()
    is_https = cert_path is not None and key_path is not None
    proto = "https" if is_https else "http"

    print("=" * 75, flush=True)
    print("  Centizen eSSL Biometric Attendance Management System", flush=True)
    print(f"  Primary Domain     : {DOMAIN} (IP: {PRIMARY_IP})", flush=True)
    print(f"  Secure Portal URL  : {proto}://{DOMAIN}:8881", flush=True)
    print("  Alternative URLs   :", flush=True)
    print(f"    • Secure IP URL  : {proto}://{PRIMARY_IP}:8881", flush=True)
    print(f"    • Localhost      : {proto}://localhost:8881", flush=True)

    port_80_available = can_bind("0.0.0.0", 80)
    if port_80_available:
        if is_https:
            print(f"    • Standard Port 80: http://{PRIMARY_IP} (Redirects -> {proto}://{DOMAIN}:8881) [ACTIVE]", flush=True)
        else:
            print(f"    • Standard HTTP  : http://{PRIMARY_IP} (Port 80) [ACTIVE]", flush=True)
    else:
        print("    • Port 80        : Skipped (Linux requires sudo/root for ports < 1024)", flush=True)

    print("  Connecting to 4 eSSL Devices: 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44", flush=True)
    print("=" * 75, flush=True)

    # 1. Main Attendance Portal on Port 8881
    uvicorn_kwargs = {
        "host": "0.0.0.0",
        "port": 8881,
        "log_level": "info"
    }
    if is_https:
        uvicorn_kwargs["ssl_certfile"] = cert_path
        uvicorn_kwargs["ssl_keyfile"] = key_path

    c_8881 = uvicorn.Config(app, **uvicorn_kwargs)
    s_8881 = uvicorn.Server(c_8881)
    tasks = [asyncio.create_task(safe_serve(s_8881, 8881))]

    # 2. Port 80 Listener (Auto-redirect to HTTPS on port 8881, or serve HTTP)
    if port_80_available:
        try:
            if is_https:
                from starlette.applications import Starlette
                from starlette.responses import RedirectResponse
                from starlette.routing import Route

                async def redirect_to_https(request):
                    query = f"?{request.url.query}" if request.url.query else ""
                    return RedirectResponse(
                        url=f"https://{DOMAIN}:8881{request.url.path}{query}",
                        status_code=301
                    )

                port_80_app = Starlette(routes=[Route("/{path:path}", redirect_to_https)])
                c_80 = uvicorn.Config(port_80_app, host="0.0.0.0", port=80, log_level="warning")
            else:
                c_80 = uvicorn.Config(app, host="0.0.0.0", port=80, log_level="info")

            s_80 = uvicorn.Server(c_80)
            tasks.append(asyncio.create_task(safe_serve(s_80, 80)))
        except Exception as e:
            print(f"  Note on Port 80 setup: {e}", flush=True)

    await asyncio.gather(*tasks, return_exceptions=True)

if __name__ == "__main__":
    try:
        asyncio.run(run_servers())
    except KeyboardInterrupt:
        print("\nServer shut down cleanly by user.", flush=True)
