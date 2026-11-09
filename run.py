import asyncio
import sys
import uvicorn
from app.main import app

async def safe_serve(server: uvicorn.Server, port: int):
    try:
        await server.serve()
    except Exception as e:
        print(f"  Note: Port {port} stopped/could not start: {e}", flush=True)

async def run_servers():
    print("=" * 75, flush=True)
    print("  Centizen eSSL Biometric Attendance Management System", flush=True)
    print("  Domain Name  : centizen.AttendancePortal.com (IP: 172.17.0.38)", flush=True)
    print("  Primary Portal URL : http://172.17.0.38:8881", flush=True)
    print("  Alternative URLs   :", flush=True)
    print("    • Standard HTTP  : http://172.17.0.38 (Port 80)", flush=True)
    print("    • Office Domain  : http://centizen.AttendancePortal.com:8881", flush=True)
    print("    • Domain Port 80 : http://centizen.AttendancePortal.com", flush=True)
    print("    • Localhost      : http://localhost:8881", flush=True)
    print("  Connecting to 4 eSSL Devices: 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44", flush=True)
    print("=" * 75, flush=True)

    c_8881 = uvicorn.Config(app, host="0.0.0.0", port=8881, log_level="info")
    s_8881 = uvicorn.Server(c_8881)
    tasks = [asyncio.create_task(safe_serve(s_8881, 8881))]

    try:
        c_80 = uvicorn.Config(app, host="0.0.0.0", port=80, log_level="info")
        s_80 = uvicorn.Server(c_80)
        tasks.append(asyncio.create_task(safe_serve(s_80, 80)))
    except Exception as e:
        print(f"  Note on Port 80 config: {e}", flush=True)

    await asyncio.gather(*tasks, return_exceptions=True)

if __name__ == "__main__":
    asyncio.run(run_servers())

