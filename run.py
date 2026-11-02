import asyncio
import uvicorn
from app.main import app

async def run_servers():
    print("=" * 75)
    print("  Centizen eSSL Biometric Attendance Management System")
    print("  Domain Name  : centizen.AttendancePortal.com (IP: 172.17.0.38)")
    print("  Primary Portal URL : http://172.17.0.38:8881")
    print("  Alternative URLs   :")
    print("    • Standard HTTP  : http://172.17.0.38 (Port 80)")
    print("    • Office Domain  : http://centizen.AttendancePortal.com:8881")
    print("    • Domain Port 80 : http://centizen.AttendancePortal.com")
    print("    • Localhost      : http://localhost:8881")
    print("  Connecting to 4 eSSL Devices: 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44")
    print("=" * 75)

    c_8881 = uvicorn.Config(app, host="0.0.0.0", port=8881, log_level="info")
    s_8881 = uvicorn.Server(c_8881)
    tasks = [asyncio.create_task(s_8881.serve())]

    try:
        c_80 = uvicorn.Config(app, host="0.0.0.0", port=80, log_level="info")
        s_80 = uvicorn.Server(c_80)
        tasks.append(asyncio.create_task(s_80.serve()))
    except Exception as e:
        print(f"  Note on Port 80: {e}")

    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(run_servers())

