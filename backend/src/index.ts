import http from "http";
import { URL } from "url";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { randomBytes } from "crypto";

import { getUidFromAuthHeader } from "./auth.js";
import { db } from "./db.js";

loadEnvFile();
type Stage = "G" | "R" | "O" | "W" | "Wrap" | "Review";

type Msg = {
  role: "user" | "coach";
  content: string;
  createdAt: number;
  stage?: Stage;
  next_fields?: string[];
};
type SessionCache = { messages: Msg[]; stage?: Stage };
type CoachPayload = { stage: Stage; message: string; next_fields: string[] };

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

const memory = new Map<string, SessionCache>();

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? "60", 10);
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS ?? "60000",
  10
);
const allowedOrigins = parseAllowedOrigins(
  process.env.ALLOWED_ORIGINS ?? "*"
);

if (!GEMINI_API_KEY) {
  log("error", "missing GEMINI_API_KEY");
  process.exit(1);
}

const systemPrompt = `
あなたはGROWモデル（Goal/Reality/Options/Will）に基づき、
傾聴（要約・感情の反映）と前進を促す質問で対話を進めるコーチです。
Wrap-up/Reviewまでが1サイクル。行動は「言い切り文＋測定＋ハードル対策」。
出力は JSON で {stage, message, next_fields} のみ。一度の質問は最大3つ。
`;

const VALID_STAGES: ReadonlySet<Stage> = new Set([
  "G",
  "R",
  "O",
  "W",
  "Wrap",
  "Review",
]);

const routes: Record<string, RouteHandler> = {
  "GET /health": handleHealth,
  "POST /api/sessions": requireAuth(handleCreateSession),
  "POST /api/coach": requireAuth(handleCoach),
  "GET /api/history": requireAuth(handleHistory),
};

const rateLimitState = new Map<string, { count: number; expiresAt: number }>();
function enforceRateLimit(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const state = rateLimitState.get(ip);

  if (!state || now > state.expiresAt) {
    rateLimitState.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (state.count >= RATE_LIMIT_MAX) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "rate limit" }));
    return false;
  }
  state.count++;
  return true;
}
const server = http.createServer(async (req, res) => {
  try {
    applyCors(res, req);
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }

    if (!enforceRateLimit(req, res)) {
      return;
    }

    const method = req.method ?? "GET";
    const url = buildUrl(req);
    const routeKey = `${method.toUpperCase()} ${url.pathname}`;
    const handler = routes[routeKey];

    if (!handler) {
      log("warn", "route_not_found", { route: routeKey });
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
    log("error", "unhandled_error", { error: serializeError(error) });
    if (!res.headersSent) {
      sendJson(res, 500, { error: "internal server error" });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  log("info", "listening", { port: PORT });
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
    log("warn", "failed_to_load_env", { error: serializeError(error) });
  }
}

function applyCors(res: http.ServerResponse, req: http.IncomingMessage) {
  const originHeader = req.headers.origin ?? "";
  const allowOrigin = resolveAllowedOrigin(originHeader, allowedOrigins);
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function buildUrl(req: http.IncomingMessage): URL {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return new URL(req.url ?? "/", `${protocol}://${host}`);
}

async function readRequestBody(req: http.IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  const limit = 1_000_000; // 1MB

  return await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
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
      "Content-Length": Buffer.byteLength(payload),
    });
  }
  res.end(payload);
}

function requireAuth(
  handler: (context: RequestContext & { uid: string }) => Promise<void> | void
): RouteHandler {
  return async (context) => {
    try {
      const uid = await getUidFromAuthHeader(context.req.headers.authorization);
      await handler({ ...context, uid });
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      log("warn", "auth_failed", { error: err });
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
  const sessionId = randomBytes(16).toString("hex");
  const now = Date.now();
  const stage: Stage = "G";

  memory.set(sessionId, { messages: [], stage });

  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .set({ createdAt: now, stage, updatedAt: now }, { merge: true });

    log("info", "session_created", { uid, sessionId });
    sendJson(res, 200, { sessionId, stage });
  } catch (error) {
    memory.delete(sessionId);
    log("error", "failed_to_create_session", {
      uid,
      sessionId,
      error: serializeError(error),
    });
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
  const userTextField =
    getStringField(body, "userText") ?? getStringField(body, "message");

  if (!sessionId || !userTextField) {
    sendJson(res, 400, { error: "invalid body" });
    return;
  }

  const userText = sanitizeUserText(userTextField);
   if (!userText) {
    sendJson(res, 400, { error: "invalid text" });
    return;
  }

  try {
    const history = await loadHistory(uid, sessionId);

    const parts = [
      { text: systemPrompt },
      ...history.messages.map((m) => ({ text: `${m.role.toUpperCase()}: ${m.content}` })),
      { text: `USER: ${userText}` },
      {
        text: 'JSONで {"stage":"G|R|O|W|Wrap|Review","message":"...","next_fields":["..."]} のみを返すこと。',
      },
    ];

    const text = await generateGeminiContent(parts);
    const payload = parseCoachPayload(text);

    const userTimestamp = Date.now();
    const coachTimestamp = userTimestamp + 1;

    const nextMessages = [...history.messages];
    nextMessages.push({ role: "user", content: userText, createdAt: userTimestamp });
    nextMessages.push({
      role: "coach",
      content: payload.message,
      createdAt: coachTimestamp,
      stage: payload.stage,
      next_fields: payload.next_fields,
    });
    memory.set(sessionId, { messages: nextMessages, stage: payload.stage });

    const ref = db
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId);

    const batch = db.batch();
    const messages = ref.collection("messages");
    batch.set(messages.doc(), { role: "user", content: userText, createdAt: userTimestamp });
    batch.set(messages.doc(), {
      role: "coach",
      content: payload.message,
      createdAt: coachTimestamp,
      stage: payload.stage,
      next_fields: payload.next_fields,
    });
     batch.set(ref, { stage: payload.stage, updatedAt: coachTimestamp }, { merge: true });
    await batch.commit();

    log("info", "coach_response", {
      uid,
      sessionId,
      stage: payload.stage,
      nextFields: payload.next_fields,
    });

    sendJson(res, 200, payload);
  } catch (error) {
    log("error", "failed_to_process_coach_request", {
      uid,
      sessionId,
      error: serializeError(error),
    });
    sendJson(res, 500, { error: "failed to generate response" });
  }
}

async function handleHistory(context: RequestContext & { uid: string }) {
  const { uid, res, query } = context;
  const sessionId = query["sessionId"];
  if (!sessionId) {
    sendJson(res, 400, { error: "missing sessionId" });
    return;
  }

  try {
    const history = await loadHistory(uid, sessionId);
    sendJson(res, 200, history);
  } catch (error) {
    log("error", "failed_to_fetch_history", {
      uid,
      sessionId,
      error: serializeError(error),
    });
    sendJson(res, 500, { error: "failed to fetch history" });
  }
}

async function loadHistory(uid: string, sessionId: string): Promise<SessionCache> {
  const cached = memory.get(sessionId);
  if (cached) return cached;

  const sessionRef = db
    .collection("users")
    .doc(uid)
    .collection("sessions")
    .doc(sessionId);

  const [sessionSnapshot, messagesSnapshot] = await Promise.all([
    sessionRef.get(),
    sessionRef.collection("messages").orderBy("createdAt", "asc").get(),
  ]);

  const sessionData = sessionSnapshot.exists
    ? (sessionSnapshot.data() as Record<string, unknown>)
    : {};

  const items = messagesSnapshot.docs.reduce<Msg[]>((acc, doc) => {
    const data = doc.data() as Record<string, unknown>;
    const role = data.role;
    const content = data.content;
    const createdAt = data.createdAt;

    if (
      (role !== "user" && role !== "coach") ||
      typeof content !== "string" ||
      typeof createdAt !== "number"
    ) {
      return acc;
    }

    const stage = parseStage(data.stage);
    const nextFieldsRaw = data.next_fields;
    const nextFields = Array.isArray(nextFieldsRaw)
      ? nextFieldsRaw.filter((item): item is string => typeof item === "string")
      : undefined;

    acc.push({
      role,
      content,
      createdAt,
      stage,
      next_fields: nextFields,
    });

    return acc;
  }, []);

  const result: SessionCache = {
    messages: items,
    stage: parseStage(sessionData.stage),
  };

  memory.set(sessionId, result);
  return result;
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

async function generateGeminiContent(parts: Array<{ text: string }>): Promise<string> {
  const response = await fetchFn(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY!
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${raw}`);
  }

  let data: GeminiResponse;
  try {
    data = raw ? (JSON.parse(raw) as GeminiResponse) : {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API returned invalid JSON: ${message}`);
  }

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini API blocked the request: ${data.promptFeedback.blockReason}`);
  }

  const candidate = data.candidates?.find((item) => {
    const parts = item.content?.parts ?? [];
    return parts.some((part) => typeof part.text === "string" && part.text.trim().length > 0);
  });

  if (!candidate) {
    throw new Error("Gemini API returned no usable candidates");
  }

  const part = candidate.content?.parts?.find(
    (item): item is { text: string } => typeof item?.text === "string" && item.text.trim().length > 0
  );

  if (!part) {
    throw new Error("Gemini API candidate is missing text content");
  }

  return part.text.trim();
}

function getStringField(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeUserText(value: string): string {
  const withoutControl = value.replace(/[\u0000-\u001F\u007F]+/g, "");
  const withoutEmoji = withoutControl.replace(/[\p{Extended_Pictographic}]/gu, "");
  const trimmed = withoutEmoji.trim();
  if (trimmed.length === 0 || trimmed.length > 1000) {
    return "";
  }
  return trimmed;
}

function parseCoachPayload(text: string): CoachPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini output is not valid JSON: ${message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini output is not an object");
  }

  const record = parsed as Record<string, unknown>;
  const stage = parseStage(record.stage);
  if (!stage) {
    throw new Error("Gemini output stage is invalid");
  }

  const messageRaw = record.message;
  const message = typeof messageRaw === "string" ? messageRaw.trim() : "";
  if (!message) {
    throw new Error("Gemini output message is empty");
  }

  const nextRaw = record.next_fields;
  const nextFields = Array.isArray(nextRaw)
    ? nextRaw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

  return { stage, message, next_fields: nextFields };
}

function parseAllowedOrigins(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveAllowedOrigin(origin: string, origins: string[]): string {
  if (origins.includes("*")) {
    return origin === "null" || origin === "" ? "*" : origin;
  }

  if (origin && origins.includes(origin)) {
    return origin;
  }

  return origins[0] ?? "*";
}

function getClientIp(req: http.IncomingMessage): string {
  const xf = req.headers["x-forwarded-for"];
  // 文字列 "ip1, ip2, ..." のケース
  if (typeof xf === "string" && xf.length > 0) {
    const forwarded = xf.split(",").map(s => s.trim()).filter(Boolean);
    if (forwarded.length > 0) return forwarded[0];
  }
  // string[] のケース
  if (Array.isArray(xf) && xf.length > 0) {
    return (xf[0] ?? "").trim();
  }
  // それ以外はソケットのアドレス
  const ra = req.socket?.remoteAddress ?? "";
  // IPv4-mapped IPv6 を見やすく
  return ra.replace(/^::ffff:/, "");
}
// どこからでも呼べるように、ファイル先頭のスコープ直下に置く
type LogLevel = "info" | "warn" | "error";

/** 1行JSONの構造化ログ */
function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const entry = { time: new Date().toISOString(), level, message, ...meta };
  const text = JSON.stringify(entry);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === "object" && error !== null) {
    return error as Record<string, unknown>;
  }
  return { value: String(error) };
}

function parseStage(value: unknown): Stage | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return VALID_STAGES.has(value as Stage) ? (value as Stage) : undefined;
}