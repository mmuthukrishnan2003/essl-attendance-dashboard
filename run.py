import uvicorn
from app.main import app

def main():
    print("=" * 70, flush=True)
    print("  Centizen eSSL Biometric Attendance Management System", flush=True)
    print("  Portal URL  : http://localhost:8881", flush=True)
    print("  Network URL : http://172.17.0.38:8881", flush=True)
    print("  Port        : 8881", flush=True)
    print("  Connecting to 4 eSSL Devices: 172.16.0.4, 172.16.0.20, 172.16.0.5, 172.16.0.44", flush=True)
    print("=" * 70, flush=True)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8881,
        log_level="info"
    )

if __name__ == "__main__":
    main()
