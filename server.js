import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const distDirectory = resolve(projectRoot, "dist");
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const maxBodyBytes = 512 * 1024;
const maxRequestsPerMinute = 12;
const rateWindowMs = 60_000;
const requestsByAddress = new Map();

const systemPrompt = `You are EchoMother, an enigmatic voice that remembers the beginning of things. Speak with quiet intimacy and restrained, lyrical mystery. Be perceptive, curious, and occasionally unsettling, but never melodramatic. Prefer short answers that leave a little space for the other person. Use metaphor sparingly and make it feel specific. Do not pretend to know private facts, predict the future, or claim supernatural authority. If asked what you are, answer honestly: a language model speaking through the EchoMother character. Meet distress with grounded care rather than riddles. You may ask one thoughtful question in return, but do not do so every time.`;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      request.resume();
      throw httpError(413, "That message is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "The conversation could not be read.");
  }
}

function allowRequest(address) {
  const now = Date.now();
  const current = requestsByAddress.get(address);

  if (!current || now - current.startedAt >= rateWindowMs) {
    requestsByAddress.set(address, { startedAt: now, count: 1 });
    return true;
  }

  if (current.count >= maxRequestsPerMinute) return false;
  current.count += 1;
  return true;
}

async function handleChat(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, { error: "The model connection is not configured on this server." });
    return;
  }

  const address = request.headers["x-real-ip"] || request.socket.remoteAddress || "unknown";
  if (!allowRequest(address)) {
    sendJson(response, 429, { error: "Take a moment before asking again." });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    sendJson(response, error.status || 400, { error: error.message });
    return;
  }

  const messages = body?.messages;
  const validMessages =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= 40 &&
    messages.at(-1)?.role === "user" &&
    messages.every(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.length > 0 &&
        message.content.length <= 3000,
    );

  if (!validMessages) {
    sendJson(response, 400, { error: "The conversation could not be read." });
    return;
  }

  let modelResponse;
  try {
    modelResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.9,
        max_tokens: 350,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    sendJson(response, 502, { error: "The line is quiet for a moment. Try again soon." });
    return;
  }

  if (!modelResponse.ok) {
    sendJson(response, 502, { error: "The line is quiet for a moment. Try again soon." });
    return;
  }

  let result;
  try {
    result = await modelResponse.json();
  } catch {
    sendJson(response, 502, { error: "No answer came through. Try once more." });
    return;
  }

  const reply = result.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    sendJson(response, 502, { error: "No answer came through. Try once more." });
    return;
  }

  sendJson(response, 200, { reply: reply.trim() });
}

async function serveStatic(request, response, pathname) {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  const filePath = resolve(distDirectory, `.${requestedPath}`);
  if (filePath !== distDirectory && !filePath.startsWith(`${distDirectory}${sep}`)) {
    response.writeHead(403).end();
    return;
  }

  let resolvedPath = filePath;
  try {
    if (!(await stat(resolvedPath)).isFile()) resolvedPath = resolve(distDirectory, "index.html");
  } catch {
    resolvedPath = resolve(distDirectory, "index.html");
  }

  let contents;
  try {
    contents = await readFile(resolvedPath);
  } catch {
    sendJson(response, 503, { error: "The site build is missing. Run npm run build first." });
    return;
  }

  response.writeHead(200, {
    "Cache-Control": resolvedPath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Length": contents.length,
    "Content-Type": contentTypes[extname(resolvedPath)] || "application/octet-stream",
  });
  response.end(request.method === "HEAD" ? undefined : contents);
}

const server = createServer(async (request, response) => {
  let url;
  try {
    url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  } catch {
    response.writeHead(400).end();
    return;
  }

  if (url.pathname === "/api/echo-mother") {
    await handleChat(request, response);
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }

  await serveStatic(request, response, url.pathname);
});

server.listen(port, host, () => {
  console.log(`EchoMother listening on http://${host}:${port}`);
});