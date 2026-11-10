import asyncio
import socket
import urllib.request
import ssl

async def pipe(r, w):
    try:
        while True:
            chunk = await r.read(65536)
            if not chunk:
                break
            w.write(chunk)
            await w.drain()
    except Exception:
        pass
    finally:
        try:
            w.close()
        except Exception:
            pass

async def handle_client(c_reader, c_writer):
    try:
        first_byte = await c_reader.read(1)
        if not first_byte:
            c_writer.close()
            return

        is_tls = (first_byte == b'\x16')
        target_port = 18883 if is_tls else 18882

        b_reader, b_writer = await asyncio.open_connection("127.0.0.1", target_port)
        b_writer.write(first_byte)
        await b_writer.drain()

        await asyncio.gather(
            pipe(c_reader, b_writer),
            pipe(b_reader, c_writer),
            return_exceptions=True
        )
    except Exception as e:
        pass
    finally:
        try:
            c_writer.close()
        except Exception:
            pass

async def simple_http_server():
    async def echo_http(r, w):
        req = await r.read(1024)
        w.write(b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\n\r\nHello HTTP!\n")
        await w.drain()
        w.close()
    return await asyncio.start_server(echo_http, "127.0.0.1", 18882)

async def main():
    s_http = await simple_http_server()
    s_proxy = await asyncio.start_server(handle_client, "127.0.0.1", 18881)
    print("Dual proxy running on 18881. HTTP on 18882.")

    # Probe 18881 with HTTP
    req = urllib.request.Request("http://127.0.0.1:18881/test")
    with urllib.request.urlopen(req, timeout=3) as resp:
        body = resp.read().decode()
        print("HTTP probe response:", resp.status, body.strip())

    s_proxy.close()
    s_http.close()
    await s_proxy.wait_closed()
    await s_http.wait_closed()
    print("Test passed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
