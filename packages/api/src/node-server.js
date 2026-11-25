import { createServer as createHttpServer } from "node:http";
import { createState, handleRequest, parseBody } from "./app.js";
import { ApiError } from "./errors.js";

// The local Node server and the API tests use this file. The Cloudflare Pages
// Function imports app.js directly and never touches node:http.

export function createServer(config) {
  const state = createState(config);
  return createHttpServer((req, res) => {
    route(req, res, state).catch((err) => {
      if (res.headersSent) return;
      if (err instanceof ApiError) {
        send(res, err.status, err.body());
        return;
      }
      send(res, 502, { error: "chain_unavailable" });
    });
  });
}

async function route(req, res, state) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const body = req.method === "POST" ? await readJson(req) : {};
  const result = await handleRequest(state, req.method, url.pathname, body);
  send(res, result.status, result.body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const ok = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 32_768) {
        fail(new ApiError(400, "bad_request"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        ok(parseBody(chunks.length ? Buffer.concat(chunks).toString("utf8") : ""));
      } catch (err) {
        fail(err);
      }
    });
    req.on("error", () => fail(new ApiError(400, "bad_request")));
  });
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}
