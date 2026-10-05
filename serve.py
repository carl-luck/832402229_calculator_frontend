"""前端仓库入口：静态页面服务 + 后端接口反向代理。

为什么需要这个文件
------------------
作业要求"前端不算结果"，所以前端页面必须通过 HTTP 调用后端接口。
但浏览器有两个限制：
    1. 跨域（CORS）：前端域名与后端域名不同时，请求会被拦截；
    2. 混合内容：如果页面是 HTTPS，就不能请求 HTTP 接口。

解决办法是在**同一个端口**上既提供静态页面，又把 `/api/*` 反向代理到后端：
浏览器只看到"一个同源地址"，跨域和混合内容问题都不存在。
这样前端仓库也可以独立部署到任意支持 Python 的平台，并自动连上后端仓库。

本地运行
--------
    # 1) 先启动后端仓库：cd ../calclab-backend && python server.py
    # 2) 再启动本文件：
    python serve.py --backend http://127.0.0.1:8000

    打开 http://127.0.0.1:8080 即可使用。

云端运行（Render 等）
--------------------
    启动命令：python serve.py --backend https://你的后端地址.onrender.com
    平台会注入 PORT，本文件会自动读取。

环境变量
--------
| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` / `SERVE_PORT` | `8080` | 本服务监听端口 |
| `CALCULATOR_API_BASE` | `http://127.0.0.1:8000` | 后端接口地址 |
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

API_PREFIX = "/api/"
ROOT = Path(__file__).resolve().parent
# 转发时不能透传的头部（长度与连接类头部由 urllib 重新计算）
SKIP_HEADERS = {
    "host", "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "content-length", "accept-encoding",
}


class FrontendHandler(SimpleHTTPRequestHandler):
    """静态文件 + /api 反向代理。"""

    backend = "http://127.0.0.1:8000"
    index_path = ROOT / "index.html"

    # ------------------------------------------------------------ 页面
    def _send_index(self) -> None:
        """返回 index.html，并在 app.js 之前注入前端要用的后端地址。"""
        try:
            html = self.index_path.read_text(encoding="utf-8")
        except OSError:
            self.send_error(404, "index.html not found")
            return

        config = (
            "<script>window.CALCULATOR_API_BASE = %s;</script>\n    "
            % json.dumps(self.backend)
        )
        html = html.replace('<script src="app.js" defer></script>',
                            config + '<script src="app.js" defer></script>', 1)

        payload = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    # ------------------------------------------------------------ 代理
    def _proxy(self, method: str) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None

        request = urllib.request.Request(self.backend + self.path, data=body, method=method)
        for key, value in self.headers.items():
            if key.lower() not in SKIP_HEADERS:
                request.add_header(key, value)

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload, status, headers = response.read(), response.status, response.headers
        except urllib.error.HTTPError as error:
            # 后端的 4xx/5xx 原样返回，前端才能显示后端给出的错误信息
            payload, status, headers = error.read(), error.code, error.headers
        except Exception as error:  # noqa: BLE001 - 需要把失败原因告诉前端
            payload = json.dumps(
                {"success": False, "error": {"message": f"无法连接后端服务（{self.backend}）：{error}"}},
                ensure_ascii=False,
            ).encode("utf-8")
            status, headers = 502, None

        self.send_response(status)
        if headers is not None:
            for key, value in headers.items():
                if key.lower() not in SKIP_HEADERS and key.lower() != "content-length":
                    self.send_header(key, value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    # ------------------------------------------------------------ 分发
    def _dispatch(self, method: str) -> None:
        if self.path.startswith(API_PREFIX):
            self._proxy(method)
        elif method in {"GET", "HEAD"} and self.path.split("?")[0] in {"/", "/index.html"}:
            self._send_index()
        elif method in {"GET", "HEAD"}:
            super().do_GET() if method == "GET" else super().do_HEAD()
        else:
            self.send_error(405, "Method Not Allowed")

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch("GET")

    def do_HEAD(self) -> None:  # noqa: N802
        self._dispatch("HEAD")

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch("POST")

    def do_DELETE(self) -> None:  # noqa: N802
        self._dispatch("DELETE")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def end_headers(self) -> None:
        if not self.path.startswith(API_PREFIX):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[frontend] {self.address_string()} {fmt % args}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="前端静态服务 + 后端接口代理")
    parser.add_argument("--port", type=int,
                        default=int(os.environ.get("SERVE_PORT") or os.environ.get("PORT") or 8080))
    parser.add_argument("--backend",
                        default=os.environ.get("CALCULATOR_API_BASE", "http://127.0.0.1:8000"))
    args = parser.parse_args()

    FrontendHandler.backend = args.backend.rstrip("/")
    server = ThreadingHTTPServer(("0.0.0.0", args.port), partial(FrontendHandler, directory=str(ROOT)))

    print(f"[frontend] 页面目录：{ROOT}")
    print(f"[frontend] 后端接口：{FrontendHandler.backend}")
    print(f"[frontend] 访问地址：http://127.0.0.1:{args.port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[frontend] 已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
