import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || "src");
// const port = Number(process.argv[3] || 3197);
const port = Number(process.argv[3] || process.env.PORT || 3000);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      const pathname = decodeURIComponent(
        url.pathname === "/" ? "/index.html" : url.pathname,
      );
      const filePath = path.resolve(root, `.${pathname}`);
      if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end("forbidden");
        return;
      }
      const body = await fs.readFile(filePath);
      response.writeHead(200, {
        "Content-Type":
          mime[path.extname(filePath)] || "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  })
  .listen(port, "127.0.0.1");
