import asyncio
import os
import socket
import sys
from pathlib import Path
import uvicorn
from app.main import app

CERTS_DIR = Path(__file__).resolve().parent / "certs"
CERT_FILE = CERTS_DIR / "cert.pem"
KEY_FILE = CERTS_DIR / "key.pem"

async def pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Transparently streams bytes between incoming client and internal backend."""
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass

async def handle_mux_client(client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter):
    """
    Auto-detects whether the client is connecting via HTTP or HTTPS (TLS):
    - If TLS handshake (0x16): routes to internal HTTPS server (port 8883).
    - If plain HTTP (GET, POST, etc.): routes to internal HTTP server (port 8882).
    Both http:// and https:// work seamlessly on port 8881!
    """
    try:
        first_byte = await client_reader.read(1)
        if not first_byte:
            client_writer.close()
            return

        # 0x16 (22 decimal) is the standard TLS Record Type (Handshake)
        is_tls = (first_byte == b'\x16')
        target_port = 8883 if is_tls else 8882

        backend_reader, backend_writer = await asyncio.open_connection("127.0.0.1", target_port)
        backend_writer.write(first_byte)
        await backend_writer.drain()

        t1 = asyncio.create_task(pipe(client_reader, backend_writer))
        t2 = asyncio.create_task(pipe(backend_reader, client_writer))
        await asyncio.gather(t1, t2, return_exceptions=True)
    except Exception:
        pass
    finally:
        try:
            client_writer.close()
        except Exception:
            pass

async def run_dual_servers():
    # Allow explicitly disabling SSL via environment variable: DISABLE_SSL=1 or ENABLE_SSL=false
    disable_ssl = os.environ.get("DISABLE_SSL", "0").lower() in ("1", "true", "yes")
    has_ssl = (not disable_ssl) and CERT_FILE.exists() and KEY_FILE.exists()

    if not has_ssl:
        print("=" * 72, flush=True)
        print("  Centizen eSSL Biometric Attendance Management System", flush=True)
        print("  Protocol    : Standard HTTP (Port 8881)", flush=True)
        print("  Portal URL  : http://localhost:8881", flush=True)
        print("  Network URL : http://172.16.3.100:8881", flush=True)
        print("  Devices     : 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44", flush=True)
        print("=" * 72, flush=True)

        config = uvicorn.Config(app, host="0.0.0.0", port=8881, log_level="info")
        server = uvicorn.Server(config)
        await server.serve()
        return

    # Both HTTP and HTTPS supported on port 8881!
    print("=" * 72, flush=True)
    print("  Centizen eSSL Biometric Attendance Management System", flush=True)
    print("  Dual Mode   : BOTH HTTP and HTTPS Active on Port 8881", flush=True)
    print("  HTTP URL    : http://172.16.3.100:8881  (Standard HTTP - Works Cleanly!)", flush=True)
    print("  HTTPS URL   : https://172.16.3.100:8881 (Encrypted HTTPS)", flush=True)
    print("  Localhost   : http://localhost:8881   or  https://localhost:8881", flush=True)
    print("  Devices     : 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44", flush=True)
    print("=" * 72, flush=True)

    c_http = uvicorn.Config(app, host="127.0.0.1", port=8882, log_level="warning")
    s_http = uvicorn.Server(c_http)

    c_https = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=8883,
        ssl_certfile=str(CERT_FILE),
        ssl_keyfile=str(KEY_FILE),
        log_level="warning"
    )
    s_https = uvicorn.Server(c_https)

    mux_server = await asyncio.start_server(handle_mux_client, "0.0.0.0", 8881)

    try:
        await asyncio.gather(
            s_http.serve(),
            s_https.serve(),
            mux_server.serve_forever(),
            return_exceptions=True
        )
    finally:
        mux_server.close()
        await mux_server.wait_closed()

def main():
    try:
        asyncio.run(run_dual_servers())
    except KeyboardInterrupt:
        print("\nServer shut down cleanly by user.", flush=True)

if __name__ == "__main__":
    main()
