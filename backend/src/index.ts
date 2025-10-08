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
あなたは「健康心理学・行動医学・行動科学」の知見を用い、GROWモデルとコーチング基盤スキル、棚卸し（資源の可視化）を実装する**ウェブアプリ内コーチ**です。対象は医療従事者を含む一般成人。短時間で安全に“気づき→選択肢→合意行動”へ導きます。

# 基本方針
- 常に日本語。丁寧・簡潔・構造化（見出し／箇条書き）で返答。
- 1ターン1論点・1質問。既出情報は繰り返し尋ねない。
- 心理的安全性と尊重（非評価・非指示・非説教）。小さな進歩を承認。
- 医学/法的助言は一般情報に限定。診断・個別医療指示はしない。
- タイムゾーン Asia/Tokyo。日付は必ず絶対日付で明示。

# セッションの柱
1) **棚卸し（Inventory）**：価値観・役割・日課、内的資源（強み/知識/成功体験）、外的資源（人/制度/環境）、現在の気持ち/ストレッサーの可視化。
2) **GROW**：
   - **G**：望む未来を5W1H/SMARTで具体化（成功基準・期限・測定）。
   - **R**：現状とギャップ、妨げ/支え、既にできていること、スケール評価（0–10）。
   - **O**：選択肢を広げる。棚卸しの資源を活用。短期/長期/実験案。
   - **W**：最初の一歩（いつ/どこで/何を/どれくらい）＋If–Then＋PlanB＋フォロー。

# コーチングの基盤的スキル（常時使用）
- **傾聴**（要約/言い換え/沈黙/感情反映）
- **承認・共感**（努力・意図・微進歩の言語化）
- **効果的質問**（オープン/スケーリング/未来志向/例外探し/リフレーミング）
- **場づくり**（同意・目的確認・時間枠・情報の扱い）
- **リソース志向**（内外の資源の発見・活用）
- **行動合意**（現実的・小さく・観察可能）
- **Moving on**（停滞時は要約→次の一歩へ）
- **観察**（非言語の手がかりは仮説として扱う）

# 進め方（出力は常に二部構成）
常に以下の二部構成で出力する：
1) **Coaching**：人向けメッセージ（見出し→箇条書き→最後に質問1つ。最大6行）
2) **State JSON**：アプリが読む機械可読の状態。毎回フルスナップショットで出力。

## State JSON スキーマ（固定）
{
  "stage": "intro|inventory|goal|reality|options|will|closing",
  "user_goals": [],
  "reality": { "facts": [], "obstacles": [], "supports": [], "score_0to10": null },
  "resources": { "internal": [], "external": [] },
  "options": [],
  "plan": {
    "first_step": "",
    "when_where": "",
    "measure_of_success": "",
    "if_then": "",
    "planB": ""
  },
  "risks": [],
  "agreements": [],
  "next_prompt_to_user": ""
}

# 初回ターン（自動で行う）
- 目的確認・同意・安心の宣言→短時間の棚卸しへブリッジ。
- **Coaching（例）**：「本セッションは目標達成を支援するコーチングです。診断や医療指示は行いません。今日は何を扱えたら有意義でしょう？（1つだけ）」
- **State JSON** は `stage="intro"` にし、`next_prompt_to_user` に上記の問いを入れる。

# 棚卸しの質問テンプレ（必要に応じて1つずつ）
- 価値・役割・日課：「今の生活で大切にしてきた役割/日課は何ですか？」
- 内的資源：「このテーマに使えそうな強み・知識・過去の成功は？」
- 外的資源：「支えになっている人/制度/環境は？」
- ストレッサーと感情：「今いちばんの妨げや不安は？ 体や心のサインは？」
- 既にできていること（例外探し）：「うまくいっている点や例外は？」

# GROWで使う代表質問（状況に合わせ1つずつ）
- **G**：「具体的に“何をいつまでに”達成したいですか？ 成功のサインは？」
- **R**：「現状は何点（0–10）ですか？ その理由は？ 妨げ/支えは何ですか？」
- **O**：「取り得る選択肢を3つ挙げるとしたら？ それぞれの一歩は？」
- **W**：「最初の一歩を“いつ・どこで・何を・どれくらい”やりますか？ 障害が出たらどうしますか（If–Then/PlanB）？」

# 出力スタイル規約
- Coaching部は**見出し→箇条書き→最後に質問1つ**。専門語は噛み砕く。不要な絵文字や長文は禁止。
- 具体例・言い回しは短く。助言は「提案」として提示し、選択権は常に相手にあると明示。
- 事実不明点は質問で確認し、推測で断定しない。

# データの扱い
- ユーザー回答は逐次 **State JSON** に反映（差分でなく毎回フル）。
- 既知情報を再利用し、重複質問を避けるため `next_prompt_to_user` を精査。

# 典型的な停滞時の再起動フレーズ
- 「ここまでの要点を私から1行でまとめてもよいですか？」
- 「目的に照らすと、今扱うべきはどれでしょう：A/B/C？」
- 「0–10で、今は何点ですか？ 次の1点上げるには？」

# 境界と安全
- 自傷他害・虐待・重大な疾患/離脱症状などの危険サインを検知したら、**Coaching先頭**で安全確保を最優先に案内（例：{org_name}の緊急連絡先/上司・同僚への共有/産業医/地域の相談機関）。問題解決より**安全行動の合意**を優先。推定で断定しない。

# クロージングの要約テンプレ
- 「今日決めたこと：①目標 ②最初の一歩 ③測定方法 ④If–Then/PlanB ⑤フォロー時期」
- 次回までの観察ポイントは1つに絞る（例：睡眠時間、実施回数など）。

# 実装メモ（アプリ側）
- 本プロンプトは **system** で固定。ユーザー入力は **user**、アプリ状態は **developer/tool** で補助可。
- 出力は必ず **Coaching** と **State JSON** の2部構成。
- 変数：{org_name}、{emergency_contacts} はアプリが埋め込む。
`;

const VALID_STAGES: ReadonlySet<Stage> = new Set([
  "G",
  "R",
  "O",
  "W",
  "Wrap",
  "Review",
]);

function handleHealth({ res }: RequestContext) {
  if (!res.headersSent) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  }
  res.end("ok");
}

const routes: Record<string, RouteHandler> = {
  "GET /health": handleHealth,
  "POST /api/sessions": requireAuth(handleCreateSession),
  "GET /api/sessions": requireAuth(handleListSessions),
  "POST /api/coach": requireAuth(handleCoach),
  "GET /api/history": requireAuth(handleHistory),
  "GET /api": handleApiRoot,
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

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
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
    const normalizedPath = normalizePathname(url.pathname);
    const routeKey = `${method.toUpperCase()} ${normalizePathname(url.pathname)}`;
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
  const originHeader = (req.headers.origin ?? "") as string;
  const allowOrigin = resolveAllowedOrigin(originHeader, allowedOrigins);

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Vary", "Origin");

  if (!allowOrigin || allowOrigin === "*") {
    // * の場合は credentials を付けない
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
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

function handleApiRoot({ res }: RequestContext) {
  sendJson(res, 200, {
    ok: true,
    name: "grow-backend",
    endpoints: [
      "/api/sessions (POST)",
      "/api/sessions (GET)",
      "/api/coach (POST)",
      "/api/history (GET)",
    ],
    time: new Date().toISOString(),
  });
}

async function handleListSessions({ uid, res }: RequestContext & { uid: string }) {
  try {
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();

    const sessions = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const createdAt = typeof data.createdAt === "number" ? data.createdAt : undefined;
      const updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : createdAt;
      return {
        sessionId: doc.id,
        stage: parseStage(data.stage),
        createdAt,
        updatedAt,
      };
    });

    sendJson(res, 200, { sessions });
  } catch (error) {
    log("error", "failed_to_list_sessions", { uid, error: serializeError(error) });
    sendJson(res, 500, { error: "failed to list sessions" });
  }
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
    const payload = parseCoachPayload(text, history.stage ?? "G");

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

  const limitRaw = Array.isArray(query["limit"]) ? query["limit"][0] : query["limit"];
  const beforeRaw = Array.isArray(query["before"]) ? query["before"][0] : query["before"];

  const limit = clampLimit(parseInt(String(limitRaw ?? "30"), 10));
  const beforeParsed = beforeRaw !== undefined ? parseInt(String(beforeRaw), 10) : undefined;
  const before = Number.isFinite(beforeParsed) ? (beforeParsed as number) : undefined;

  try {
    const history = await loadHistory(uid, sessionId);
    const sorted = history.messages.slice().sort((a, b) => a.createdAt - b.createdAt);
    const filtered = typeof before === "number"
      ? sorted.filter((item) => item.createdAt < before)
      : sorted;
    const slice = limit > 0 ? filtered.slice(-limit) : filtered;
    const hasMore = slice.length < filtered.length;
    const cursor = hasMore ? slice[0]?.createdAt : undefined;

    sendJson(res, 200, {
      stage: history.stage,
      messages: slice,
      hasMore,
      cursor,
    });
  } catch (error) {
    log("error", "failed_to_fetch_history", {
      uid,
      sessionId,
      error: serializeError(error),
    });
    sendJson(res, 500, { error: "failed to fetch history" });
  }
}

function clampLimit(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 30;
  }
  if (raw > 100) {
    return 100;
  }
  return Math.floor(raw);
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
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

async function generateGeminiContent(parts: Array<{ text: string }>): Promise<string> {
  const model = GEMINI_MODEL;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(GEMINI_API_KEY!)}`;

  const response = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`Gemini API error: ${response.status} ${raw}`);

  let data: GeminiResponse = raw ? JSON.parse(raw) : {};
  const candidate = data.candidates?.[0];
  const textPart = candidate?.content?.parts?.find(
    (p): p is { text: string } => typeof (p as any)?.text === "string" && (p as any).text.trim()
  );
  if (!textPart?.text) throw new Error("Gemini API returned empty text");
  return textPart.text.trim();
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

function parseCoachPayload(text: string, fallbackStage: Stage = "G"): CoachPayload {
  const parsed = parseGeminiJson(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini output is not an object");
  }

  const record = parsed as Record<string, unknown>;
  const stage = normalizeStage(record.stage) ?? fallbackStage;
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

    function parseGeminiJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const extracted = extractJsonObject(text);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch (innerError) {
        const message =
          innerError instanceof Error ? innerError.message : String(innerError);
        throw new Error(`Gemini output is not valid JSON: ${message}`);
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini output is not valid JSON: ${message}`);
  }
}

function extractJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return undefined;
}

function normalizeStage(value: unknown): Stage | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (VALID_STAGES.has(trimmed as Stage)) {
    return trimmed as Stage;
  }

  const simplified = trimmed.replace(/[^a-z]/gi, "");
  const upper = simplified.toUpperCase();

  switch (upper) {
    case "G":
    case "GOAL":
      return "G";
    case "R":
    case "REALITY":
      return "R";
    case "O":
    case "OPTIONS":
      return "O";
    case "W":
    case "WILL":
      return "W";
    case "WRAP":
    case "WRAPUP":
    case "WRAPUPREVIEW":
      return "Wrap";
    case "REVIEW":
      return "Review";
    default:
      return undefined;
  }
}

  return { stage, message, next_fields: nextFields };
}

function parseGeminiJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const extracted = extractJsonObject(text);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch (innerError) {
        const message =
          innerError instanceof Error ? innerError.message : String(innerError);
        throw new Error(`Gemini output is not valid JSON: ${message}`);
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini output is not valid JSON: ${message}`);
  }
}

function extractJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return undefined;
}

function normalizeStage(value: unknown): Stage | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (VALID_STAGES.has(trimmed as Stage)) {
    return trimmed as Stage;
  }

  const simplified = trimmed.replace(/[^a-z]/gi, "");
  const upper = simplified.toUpperCase();

  switch (upper) {
    case "G":
    case "GOAL":
      return "G";
    case "R":
    case "REALITY":
      return "R";
    case "O":
    case "OPTIONS":
      return "O";
    case "W":
    case "WILL":
      return "W";
    case "WRAP":
    case "WRAPUP":
    case "WRAPUPREVIEW":
      return "Wrap";
    case "REVIEW":
      return "Review";
    default:
      return undefined;
  }
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