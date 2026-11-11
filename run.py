import asyncio
import os
import sys
from pathlib import Path
import uvicorn
from app.main import app

CERTS_DIR = Path(__file__).resolve().parent / "certs"
CERT_FILE = CERTS_DIR / "cert.pem"
KEY_FILE = CERTS_DIR / "key.pem"

async def bridge(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Transparently stream data between client and backend."""
    try:
        while True:
            chunk = await reader.read(65536)
            if not chunk:
                break
            writer.write(chunk)
            await writer.drain()
    except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError):
        pass
    except Exception:
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass

async def handle_mux_client(c_reader: asyncio.StreamReader, c_writer: asyncio.StreamWriter):
    """
    Protocol multiplexer for Port 8881:
    - Byte 0x16 (TLS ClientHello): route to HTTPS backend (port 8883)
    - Any other byte (e.g. GET / POST / HEAD): route to HTTP backend (port 8882)
    Both http:// and https:// work seamlessly on port 8881 without ERR_EMPTY_RESPONSE!
    """
    b_writer = None
    try:
        first_byte = await c_reader.read(1)
        if not first_byte:
            c_writer.close()
            return

        is_tls = (first_byte == b'\x16')
        target_port = 8883 if is_tls else 8882

        b_reader, b_writer = await asyncio.open_connection("127.0.0.1", target_port)
        b_writer.write(first_byte)
        await b_writer.drain()

        t1 = asyncio.create_task(bridge(c_reader, b_writer))
        t2 = asyncio.create_task(bridge(b_reader, c_writer))

        done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
        for p in pending:
            p.cancel()
    except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError):
        pass
    except Exception:
        pass
    finally:
        try:
            c_writer.close()
        except Exception:
            pass
        if b_writer:
            try:
                b_writer.close()
            except Exception:
                pass

async def run_server():
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

    print("=" * 72, flush=True)
    print("  Centizen eSSL Biometric Attendance Management System", flush=True)
    print("  Port 8881   : DUAL MODE (BOTH http:// AND https:// Work Seamlessly)", flush=True)
    print("  HTTP URL    : http://172.16.3.100:8881  (Standard HTTP)", flush=True)
    print("  HTTPS URL   : https://172.16.3.100:8881 (Encrypted HTTPS)", flush=True)
    print("  Localhost   : http://localhost:8881  or  https://localhost:8881", flush=True)
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
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("\nServer shut down cleanly by user.", flush=True)

if __name__ == "__main__":
    main()
