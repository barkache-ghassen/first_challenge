# from http.server import BaseHTTPRequestHandler, HTTPServer

# class OnlyContractHandler(BaseHTTPRequestHandler):
#     def do_GET(self):
#         # Always return contract.html no matter what the user requests
#         self.send_response(200)
#         self.send_header("Content-type", "text/html")
#         self.end_headers()

#         with open("contract.html", "rb") as file:
#             self.wfile.write(file.read())

# # Run server on port 8000
# HTTPServer(("", 8000), OnlyContractHandler).serve_forever()
#!/usr/bin/env python3
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

class ContractHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            with open("contract.html", "rb") as f:
                self.wfile.write(f.read())
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"contract.html not found!")

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))  # critical!
    print("Python static server starting on http://0.0.0.0:8000 ...")
    HTTPServer(("0.0.0.0", 8000), ContractHandler).serve_forever()