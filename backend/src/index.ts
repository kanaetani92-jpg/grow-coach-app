import http from "http";
import { URL } from "url";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { verifyBearer, getUidFromAuthHeader } from "./auth.js";
import { db } from "./db.js";

type Msg = { role: "user" | "coach"; content: string; createdAt: number };

type RouteHandler = (context: RequestContext) => Promise<void> | void;

type RequestContext = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  method: string;
  url: URL;
  body: unknown;
  query: Record<string, string>;
  uid?: string;
};

type FetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

type FetchFn = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<FetchResponse>;

const globalFetch = (globalThis as { fetch?: FetchFn }).fetch;
if (!globalFetch) {
  throw new Error("global fetch is not available in this environment");
}
const fetchFn: FetchFn = globalFetch;

const memory: Record<string, Msg[]> = {};

loadEnvFile();

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in .env or environment variables");
  process.exit(1);
}

const systemPrompt = `
あなたはGROWモデル（Goal/Reality/Options/Will）に基づき、
傾聴（要約・感情の反映）と前進を促す質問で対話を進めるコーチです。
Wrap-up/Reviewまでが1サイクル。行動は「言い切り文＋測定＋ハードル対策」。
出力は JSON で {stage, message, next_fields} のみ。一度の質問は最大3つ。
`;

const routes: Record<string, RouteHandler> = {
  "GET /health": handleHealth,
  "POST /api/sessions": requireAuth(handleCreateSession),
  "POST /api/coach": requireAuth(handleCoach),
  "GET /api/history": requireAuth(handleHistory)
};

const server = http.createServer(async (req, res) => {
  try {
    applyCors(res, req);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    const method = req.method ?? "GET";
    const url = buildUrl(req);
    const routeKey = `${method.toUpperCase()} ${url.pathname}`;
    const handler = routes[routeKey];

    if (!handler) {
      sendJson(res, 404, { error: "not found" });
      return;
    }

    let body: unknown;
    try {
      body = await readRequestBody(req);
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "invalid JSON" });
      } else if (error instanceof Error && error.message === "payload too large") {
        sendJson(res, 413, { error: "payload too large" });
      } else {
        throw error;
      }
      return;
    }

    const query = Object.fromEntries(url.searchParams.entries());
    await handler({ req, res, method, url, body, query });
  } catch (error) {
    console.error("unhandled error", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "internal server error" });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`listening on ${PORT}`);
});

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    console.warn("failed to load .env file", error);
  }
}

function applyCors(res: http.ServerResponse, req: http.IncomingMessage) {
  const origin = req.headers.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function buildUrl(req: http.IncomingMessage): URL {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return new URL(req.url ?? "/", `${protocol}://${host}`);
}

async function readRequestBody(req: http.IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  const limit = 1_000_000; // 1MB

  return await new Promise((resolve, reject) => {
    req.on("data", chunk => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      const size = chunks.reduce((total, current) => total + current.length, 0);
      if (size > limit) {
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        if (!text) return resolve(undefined);
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  if (!res.headersSent) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(payload)
    });
  }
  res.end(payload);
}

function requireAuth(
  handler: (context: RequestContext & { uid: string }) => Promise<void> | void
): RouteHandler {
  return async context => {
    try {
      const uid = await getUidFromAuthHeader(context.req.headers.authorization);
      await handler({ ...context, uid });
    } catch (error) {
      if (error instanceof Error && error.message === "missing bearer token") {
        sendJson(context.res, 401, { error: "missing bearer token" });
      } else {
        sendJson(context.res, 401, { error: "invalid token" });
      }
    }
  };
}

function handleHealth({ res }: RequestContext) {
  if (!res.headersSent) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  }
  res.end("ok");
}

async function handleCreateSession({ uid, res }: RequestContext & { uid: string }) {
  const sessionId = Math.random().toString(36).slice(2);
  memory[sessionId] = [];

  const now = Date.now();

  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .set({ createdAt: now, stage: "G", updatedAt: now }, { merge: true });

    sendJson(res, 200, { sessionId, stage: "G" });
  } catch (error) {
    console.error("failed to create session", error);
    delete memory[sessionId];
    sendJson(res, 500, { error: "failed to create session" });
  }
}

async function handleCoach(context: RequestContext & { uid: string }) {
  const { uid, res, body } = context;

  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid body" });
    return;
  }

  const sessionId = getStringField(body, "sessionId");
  const userText = getStringField(body, "userText");

  if (!sessionId || !userText) {
    sendJson(res, 400, { error: "invalid body" });
    return;
  }

  try {
    const history = await loadHistory(uid, sessionId);

    const parts = [
      { text: systemPrompt },
      ...history.map(m => ({ text: `${m.role.toUpperCase()}: ${m.content}` })),
      { text: `USER: ${userText}` },
      { text: 'JSONで {"stage":"G|R|O|W|Wrap|Review","message":"...","next_fields":["..."]} のみを返すこと。' }
    ];

    const text = await generateGeminiContent(parts);
    const payload = parseCoachPayload(text);

    const userTimestamp = Date.now();
    const coachTimestamp = userTimestamp + 1;

    history.push({ role: "user", content: userText, createdAt: userTimestamp });
    history.push({ role: "coach", content: payload.message, createdAt: coachTimestamp });
    memory[sessionId] = history;

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId);

    const batch = db.batch();
    const messages = ref.collection("messages");
    batch.set(messages.doc(), { role: "user", content: userText, createdAt: userTimestamp });
    batch.set(messages.doc(), { role: "coach", content: payload.message, createdAt: coachTimestamp });
    batch.set(ref, { stage: payload.stage, updatedAt: coachTimestamp }, { merge: true });
    await batch.commit();

    sendJson(res, 200, payload);
  } catch (error) {
    console.error("failed to process coach request", error);
    sendJson(res, 500, { error: "failed to generate response" });
  }
}

async function handleHistory(context: RequestContext & { uid: string }) {
  const { uid, res, query } = context;
  const sessionId = query["sessionId"];
  if (!sessionId) {
    sendJson(res, 400, { error: "sessionId is required" });
    return;
  }

  try {
    const messages = await loadHistory(uid, sessionId);
    sendJson(res, 200, { messages });
  } catch (error) {
    console.error("failed to fetch history", error);
    sendJson(res, 500, { error: "failed to fetch history" });
  }
}

async function loadHistory(uid: string, sessionId: string): Promise<Msg[]> {
  if (memory[sessionId]) return memory[sessionId];

  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("sessions")
    .doc(sessionId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();

  const items: Msg[] = snapshot.docs
    .map(doc => doc.data() as Record<string, unknown>)
    .map(data => ({
      role: data.role,
      content: data.content,
      createdAt: data.createdAt
    }))
    .filter((data): data is Msg => {
      return (
        (data.role === "user" || data.role === "coach") &&
        typeof data.content === "string" &&
        typeof data.createdAt === "number"
      );
    });

  memory[sessionId] = items;
  return items;
}

async function generateGeminiContent(parts: Array<{ text: string }>): Promise<string> {
  const response = await fetchFn(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY!
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const candidates = data["candidates"];
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini API returned no candidates");
  }

  const content = candidates[0]?.content as Record<string, unknown> | undefined;
  const partsData = (content?.parts as Array<Record<string, unknown>> | undefined) ?? [];
  const textPart = partsData.find(part => typeof part?.text === "string");

  const text = typeof textPart?.text === "string" ? textPart.text : undefined;
  if (!text) throw new Error("Gemini response missing text");
  return text;
}

function parseCoachPayload(text: string): { stage: string; message: string; next_fields: string[] } {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const stage = data["stage"];
    const message = data["message"];
    const nextFields = data["next_fields"];

    if (typeof stage === "string" && typeof message === "string") {
      const fields = Array.isArray(nextFields)
        ? nextFields.filter((item): item is string => typeof item === "string")
        : [];
      return { stage, message, next_fields: fields };
    }
  } catch {
    // ignore
  }

  return { stage: "R", message: text, next_fields: [] };
}

function getStringField(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}