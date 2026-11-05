#!/usr/bin/env python3
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

class ContractHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            with open("contract.html", "rb") as handle:
                self.wfile.write(handle.read())
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"contract.html not found!")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(os.environ.get("PAGE_PORT", "8000"))
    print(f"Python static server starting on http://0.0.0.0:{port} ...")
    HTTPServer(("0.0.0.0", port), ContractHandler).serve_forever()
