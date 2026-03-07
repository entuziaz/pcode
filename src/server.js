"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const {
  loadDataset,
  searchRecords,
  streetsByPostcode,
  reverseGeocodeGuess
} = require("./dataset");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

function serveStatic(reqPath, res) {
  const normalized = reqPath === "/" || reqPath === "/demo" ? "/demo/index.html" : reqPath;
  const filePath = path.join(PUBLIC_DIR, normalized);
  const safePath = path.normalize(filePath);

  if (!safePath.startsWith(PUBLIC_DIR)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    json(res, 404, { error: "Not found" });
    return;
  }

  const content = fs.readFileSync(safePath);
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": contentTypeFor(safePath),
    "Content-Length": content.length
  });
  res.end(content);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });
      return res.end();
    }

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      const dataset = loadDataset();
      return json(res, 200, {
        ok: true,
        dataset: {
          records: dataset.metadata.recordCount,
          lgas: dataset.metadata.lgaCount,
          generatedAt: dataset.metadata.generatedAt
        }
      });
    }

    if (req.method === "GET" && requestUrl.pathname === "/search") {
      const query = requestUrl.searchParams.get("query") || "";
      const limit = Number(requestUrl.searchParams.get("limit") || 20);
      const results = searchRecords(query, Math.max(1, Math.min(limit, 100)));

      return json(res, 200, {
        query,
        count: results.length,
        results
      });
    }

    if (req.method === "GET" && /^\/postcode\/[^/]+(\/streets)?$/.test(requestUrl.pathname)) {
      const postcode = requestUrl.pathname
        .replace(/^\/postcode\//, "")
        .replace(/\/streets$/, "");
      const result = streetsByPostcode(postcode);
      return json(res, 200, result);
    }

    if (req.method === "POST" && requestUrl.pathname === "/reverse-geocode") {
      const body = await readJsonBody(req);
      const lat = Number(body.lat);
      const lng = Number(body.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, { error: "lat and lng must be numbers" });
      }

      const result = reverseGeocodeGuess(lat, lng);
      if (!result) {
        return json(res, 404, { error: "No geocoded records available" });
      }

      return json(res, 200, result);
    }

    if (req.method === "GET") {
      return serveStatic(requestUrl.pathname, res);
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  const dataset = loadDataset();
  console.log(`MVP API running on http://localhost:${PORT}`);
  console.log(`Loaded ${dataset.metadata.recordCount} canonical records across ${dataset.metadata.lgaCount} LGAs`);
});
