import Express from "express";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Express();
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000;

const FUNCTIONS_DOMAIN = "https://project-rainfall-60066369864.development.catalystserverless.in";

// Proxy /server/* requests to the Catalyst Functions domain
// Forwards all x-zc-* platform headers and cookies for authentication
app.all("/server/*", async (req, res) => {
  const targetUrl = FUNCTIONS_DOMAIN + req.originalUrl;
  try {
    const headers = {
      "host": "project-rainfall-60066369864.development.catalystserverless.in",
    };

    // Forward all x-zc-* headers (platform-injected auth/project context)
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.startsWith("x-zc-")) {
        headers[key] = value;
      }
    }

    // Forward cookies (carry Catalyst session auth)
    if (req.headers.cookie) {
      headers["cookie"] = req.headers.cookie;
    }

    // Forward content-type for request body
    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"];
    }

    // Forward CSRF token if present
    if (req.headers["x-zcsrf-token"]) {
      headers["x-zcsrf-token"] = req.headers["x-zcsrf-token"];
    }

    // Forward user-agent
    if (req.headers["user-agent"]) {
      headers["user-agent"] = req.headers["user-agent"];
    }

    const fetchOpts = {
      method: req.method,
      headers,
      redirect: "manual",
    };

    // Forward body for POST/PUT/PATCH/DELETE
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (chunks.length > 0) {
        fetchOpts.body = Buffer.concat(chunks);
      }
    }

    console.log(`Proxy: ${req.method} ${targetUrl}`);
    const upstream = await fetch(targetUrl, fetchOpts);
    console.log(`Proxy response: ${upstream.status}`);

    // Forward response status and headers
    res.status(upstream.status);
    for (const [key, value] of upstream.headers.entries()) {
      if (["transfer-encoding", "connection", "keep-alive"].includes(key.toLowerCase())) continue;
      res.setHeader(key, value);
    }

    const body = await upstream.arrayBuffer();
    res.send(Buffer.from(body));
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(502).json({ error: "Backend unavailable", detail: err.message });
  }
});

// Debug endpoint to see platform-injected headers
app.get("/debug/headers", (req, res) => {
  const filtered = {};
  for (const [k, v] of Object.entries(req.headers)) {
    filtered[k] = typeof v === 'string' && v.length > 80 ? v.substring(0, 80) + '...' : v;
  }
  res.json({ headers: filtered });
});

// Serve static files from the build directory under /app
app.use("/app", Express.static(path.join(__dirname, "build")));

// SPA fallback: serve index.html for any /app/* route not matched by static files
app.get("/app/*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// Root redirect to /app
app.get("/", (req, res) => {
  res.redirect("/app/index.html");
});

app.listen(port, () => {
  console.log(`WedExpense running on port ${port}`);
});
