import http from "http";
import { URL } from "url";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { randomBytes } from "crypto";

import { getUidFromAuthHeader } from "./auth.js";
import { db } from "./db.js";
import { coachPrompts } from "./coaches/index.js";
import { COACH_TYPES, type CoachType } from "./coaches/types.js";

loadEnvFile();
type Stage =
  | "intro"
  | "inventory"
  | "goal"
  | "reality"
  | "options"
  | "will"
  | "closing";

type CoachingState = {
  stage: Stage;
  user_goals: string[];
  reality: {
    facts: string[];
    obstacles: string[];
    supports: string[];
    score_0to10: number | null;
  };
  resources: {
    internal: string[];
    external: string[];
  };
  options: string[];
  plan: {
    first_step: string;
    when_where: string;
    measure_of_success: string;
    if_then: string;
    planB: string;
  };
  risks: string[];
  agreements: string[];
  next_prompt_to_user: string;
};

type Msg = {
  role: "user" | "coach";
  content: string;
  createdAt: number;
  stage?: Stage;
  state?: CoachingState;
  coachType?: CoachType;
};
type SessionCache = {
  messages: Msg[];
  stage?: Stage;
  coachType?: CoachType;
  faceSheetSummary?: string | null;
};
type CoachPayload = { stage: Stage; message: string; state: CoachingState };

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

const DEFAULT_COACH_TYPE: CoachType = "akito";
const VALID_COACH_TYPES: ReadonlySet<CoachType> = new Set(COACH_TYPES);

const HONORIFIC_OPTIONS = [
  "san",
  "kun",
  "chan",
  "noHonorific",
  "english",
  "other",
] as const;
type HonorificOption = (typeof HONORIFIC_OPTIONS)[number];

const GENDER_OPTIONS = [
  "female",
  "male",
  "nonBinary",
  "transWoman",
  "transMan",
  "xGender",
  "noAnswer",
  "other",
  "selfDescribe",
] as const;
type GenderOption = (typeof GENDER_OPTIONS)[number];

const EMPLOYMENT_TYPES = ["fullTime", "partTime", "dispatch", "student", "other"] as const;
type EmploymentTypeOption = (typeof EMPLOYMENT_TYPES)[number];

const WORK_PATTERNS = [
  "day",
  "twoShift",
  "threeShift",
  "nightOnly",
  "flexRemote",
  "other",
] as const;
type WorkPatternOption = (typeof WORK_PATTERNS)[number];

const LIVING_ARRANGEMENTS = ["alone", "withFamily", "withOthers", "noAnswer"] as const;
type LivingArrangementOption = (typeof LIVING_ARRANGEMENTS)[number];

const CARE_RESPONSIBILITIES = ["childcare", "caregiving", "pets", "none", "other"] as const;
type CareResponsibilityOption = (typeof CARE_RESPONSIBILITIES)[number];

const PERSONALITY_TRAITS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "emotionalStability",
  "openness",
] as const;
type PersonalityTraitKey = (typeof PERSONALITY_TRAITS)[number];

const PERSONALITY_TAGS = [
  "logical",
  "empathetic",
  "careful",
  "challenging",
  "planned",
  "flexible",
  "observant",
  "quickDecider",
  "other",
] as const;
type PersonalityTagOption = (typeof PERSONALITY_TAGS)[number];

const LIFE_AREAS = [
  "sleep",
  "nutrition",
  "activity",
  "work",
  "learning",
  "family",
  "friends",
  "hobby",
  "finance",
  "housing",
  "physicalHealth",
  "mental",
  "rest",
  "digital",
  "timeManagement",
] as const;
type LifeAreaKey = (typeof LIFE_AREAS)[number];

const COACHING_TOPICS = [
  "sleepFatigue",
  "stressCare",
  "timeManagement",
  "communication",
  "careerLearning",
  "healthHabits",
  "finance",
  "relationships",
  "selfCompassion",
  "selfEfficacy",
  "other",
] as const;
type CoachingTopicOption = (typeof COACHING_TOPICS)[number];

const SAFETY_CONCERNS = [
  "none",
  "insomnia",
  "selfHarm",
  "domesticViolence",
  "substance",
  "other",
] as const;
type SafetyConcernOption = (typeof SAFETY_CONCERNS)[number];

const HONORIFIC_LABELS: Record<HonorificOption, string> = {
  san: "さん",
  kun: "くん",
  chan: "ちゃん",
  noHonorific: "呼び捨て",
  english: "英名で",
  other: "その他",
};

const GENDER_LABELS: Record<GenderOption, string> = {
  female: "女性",
  male: "男性",
  nonBinary: "ノンバイナリー",
  transWoman: "トランス女性",
  transMan: "トランス男性",
  xGender: "Xジェンダー/その他",
  noAnswer: "回答しない",
  other: "その他",
  selfDescribe: "自由記述",
};

const EMPLOYMENT_LABELS: Record<EmploymentTypeOption, string> = {
  fullTime: "常勤",
  partTime: "非常勤",
  dispatch: "派遣",
  student: "学生",
  other: "その他",
};

const WORK_PATTERN_LABELS: Record<WorkPatternOption, string> = {
  day: "日勤のみ",
  twoShift: "2交代",
  threeShift: "3交代",
  nightOnly: "夜勤専従",
  flexRemote: "フレックス/リモート",
  other: "その他",
};

const LIVING_ARRANGEMENT_LABELS: Record<LivingArrangementOption, string> = {
  alone: "ひとり暮らし",
  withFamily: "家族と同居",
  withOthers: "同居者あり（家族以外）",
  noAnswer: "未回答",
};

const CARE_RESPONSIBILITY_LABELS: Record<CareResponsibilityOption, string> = {
  childcare: "育児",
  caregiving: "介護",
  pets: "ペット",
  none: "なし",
  other: "その他",
};

const PERSONALITY_TAG_LABELS: Record<PersonalityTagOption, string> = {
  logical: "論理的",
  empathetic: "共感的",
  careful: "慎重",
  challenging: "挑戦的",
  planned: "計画的",
  flexible: "柔軟",
  observant: "観察的",
  quickDecider: "即断型",
  other: "その他",
};

const COACHING_TOPIC_LABELS: Record<CoachingTopicOption, string> = {
  sleepFatigue: "睡眠/疲労",
  stressCare: "ストレス/感情整理",
  timeManagement: "時間管理/先延ばし",
  communication: "コミュニケーション",
  careerLearning: "キャリア/学習",
  healthHabits: "健康習慣（食/運動）",
  finance: "金銭/家計",
  relationships: "対人関係",
  selfCompassion: "セルフコンパッション",
  selfEfficacy: "自己効力感",
  other: "その他",
};

const SAFETY_CONCERN_LABELS: Record<SafetyConcernOption, string> = {
  none: "特になし",
  insomnia: "強い不眠の持続",
  selfHarm: "自傷他害の衝動",
  domesticViolence: "家庭内暴力の懸念",
  substance: "薬物/アルコールの問題",
  other: "その他",
};

const LIFE_AREA_LABELS: Record<LifeAreaKey, string> = {
  sleep: "睡眠",
  nutrition: "食事",
  activity: "運動/身体活動",
  work: "仕事",
  learning: "学習/自己研鑽",
  family: "家族",
  friends: "友人/同僚",
  hobby: "趣味/余暇",
  finance: "経済/家計",
  housing: "住環境",
  physicalHealth: "健康（身体）",
  mental: "メンタル/感情",
  rest: "休息/回復",
  digital: "デジタル/スマホ",
  timeManagement: "時間管理",
};

const PERSONALITY_TRAIT_LABELS: Record<PersonalityTraitKey, string> = {
  extraversion: "外向性",
  agreeableness: "協調性",
  conscientiousness: "誠実性",
  emotionalStability: "情緒安定性",
  openness: "開放性",
};

type FaceSheetArea = {
  satisfaction: number | null;
  note: string;
};

type FaceSheetTopicSelection = {
  id: CoachingTopicOption;
  starred: boolean;
};

type FaceSheet = {
  basic: {
    nickname: string;
    honorifics: HonorificOption[];
    honorificOther: string;
    gender: GenderOption[];
    genderOther: string;
    genderFreeText: string;
    age: string;
  };
  work: {
    role: string;
    organization: string;
    employmentTypes: EmploymentTypeOption[];
    employmentOther: string;
    workPatterns: WorkPatternOption[];
    workPatternOther: string;
    weeklyHours: string;
    stressors: string;
    supportResources: string;
  };
  family: {
    livingArrangement: LivingArrangementOption;
    household: string;
    careResponsibilities: CareResponsibilityOption[];
    careOther: string;
    careTime: string;
  };
  personality: {
    traits: Record<PersonalityTraitKey, number | null>;
    tags: PersonalityTagOption[];
    tagOther: string;
    strengths: string;
    cautions: string;
  };
  lifeInventory: {
    areas: Record<LifeAreaKey, FaceSheetArea>;
    dailyRoutine: string;
  };
  coaching: {
    topics: FaceSheetTopicSelection[];
    topicOther: string;
    challenge: string;
    kpi: string;
  };
  safety: {
    concerns: SafetyConcernOption[];
    concernOther: string;
    consent: boolean;
  };
};

type FaceSheetDocument = FaceSheet & { createdAt: number; updatedAt: number };

const VALID_STAGES: ReadonlySet<Stage> = new Set([
  "intro",
  "inventory",
  "goal",
  "reality",
  "options",
  "will",
  "closing",
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
  "GET /api/face-sheet": requireAuth(handleFaceSheet),
  "PUT /api/face-sheet": requireAuth(handleUpdateFaceSheet),
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
      "/api/face-sheet (GET)",
      "/api/face-sheet (PUT)",
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
        coachType: normalizeCoachType(data.coachType) ?? DEFAULT_COACH_TYPE,
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

async function handleCreateSession({ uid, res, body }: RequestContext & { uid: string }) {
  const requestedCoachType =
    body && typeof body === "object"
      ? normalizeCoachType((body as Record<string, unknown>).coachType)
      : undefined;
  const coachType = requestedCoachType ?? DEFAULT_COACH_TYPE;
  const sessionId = randomBytes(16).toString("hex");
  const now = Date.now();
  const stage: Stage = "intro";

  const faceSheetSummary = await loadFaceSheetSummary(uid);
  memory.set(sessionId, { messages: [], stage, coachType, faceSheetSummary });

  try {
    await db
      .collection("users")
      .doc(uid)
      .collection("sessions")
      .doc(sessionId)
      .set({ createdAt: now, stage, coachType, updatedAt: now }, { merge: true });

    log("info", "session_created", { uid, sessionId, coachType });
    sendJson(res, 200, { sessionId, stage, coachType });
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
  const requestedCoachType = normalizeCoachType(
    (body as Record<string, unknown>).coachType,
  );

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
    const coachType = requestedCoachType ?? history.coachType ?? DEFAULT_COACH_TYPE;
    const prompt = coachPrompts[coachType] ?? coachPrompts[DEFAULT_COACH_TYPE];

    const parts = [{ text: prompt }];
    if (history.faceSheetSummary) {
      parts.push({ text: history.faceSheetSummary });
    }
    parts.push(
      ...history.messages.map((m) => ({ text: `${m.role.toUpperCase()}: ${m.content}` })),
      { text: `USER: ${userText}` },
      {
        text:
          "指示を厳守し、出力は必ず1) 'Coaching' セクション 2) 'State JSON' セクション（指定スキーマの完全なJSONオブジェクト）の順で示すこと。",
      },
    );

    const text = await generateGeminiContent(parts);
    const payload = parseCoachPayload(text, history.stage ?? "intro");

    const userTimestamp = Date.now();
    const coachTimestamp = userTimestamp + 1;

    const nextMessages = [...history.messages];
    nextMessages.push({ role: "user", content: userText, createdAt: userTimestamp });
    nextMessages.push({
      role: "coach",
      content: payload.message,
      createdAt: coachTimestamp,
      stage: payload.stage,
      state: payload.state,
      coachType,
    });
    memory.set(sessionId, {
      messages: nextMessages,
      stage: payload.stage,
      coachType,
      faceSheetSummary: history.faceSheetSummary,
    });

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
      state: payload.state,
      coachType,
    });
    batch.set(
      ref,
      { stage: payload.stage, coachType, updatedAt: coachTimestamp },
      { merge: true },
    );
    await batch.commit();

    log("info", "coach_response", {
      uid,
      sessionId,
      stage: payload.stage,
      nextPrompt: payload.state.next_prompt_to_user,
      coachType,
    });

    sendJson(res, 200, { ...payload, coachType });
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
      coachType: history.coachType ?? DEFAULT_COACH_TYPE,
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

async function handleFaceSheet(context: RequestContext & { uid: string }) {
  const { uid, res } = context;

  try {
    const faceSheetRef = db
      .collection("users")
      .doc(uid)
      .collection("meta")
      .doc("faceSheet");
    const snapshot = await faceSheetRef.get();
    if (!snapshot.exists) {
      sendJson(res, 200, { faceSheet: null });
      return;
    }

    const data = snapshot.data() as Record<string, unknown> | undefined;
    if (!data) {
      sendJson(res, 200, { faceSheet: null });
      return;
    }

    const faceSheet = sanitizeFaceSheetPayload(data);
    const createdAt = typeof data.createdAt === "number" ? data.createdAt : undefined;
    const updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : undefined;

    sendJson(res, 200, {
      faceSheet,
      createdAt,
      updatedAt,
    });
  } catch (error) {
    log("error", "failed_to_fetch_face_sheet", {
      uid,
      error: serializeError(error),
    });
    sendJson(res, 500, { error: "failed to fetch face sheet" });
  }
}

async function handleUpdateFaceSheet(context: RequestContext & { uid: string }) {
  const { uid, res, body } = context;

  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid body" });
    return;
  }

  const payload = (body as Record<string, unknown>).faceSheet ?? body;
  const faceSheet = sanitizeFaceSheetPayload(payload);

  if (!faceSheet) {
    sendJson(res, 400, { error: "invalid face sheet" });
    return;
  }

  try {
    const faceSheetRef = db
      .collection("users")
      .doc(uid)
      .collection("meta")
      .doc("faceSheet");

    const now = Date.now();
    const snapshot = await faceSheetRef.get();
    const existing = snapshot.exists ? (snapshot.data() as Record<string, unknown>) : undefined;
    const createdAt =
      existing && typeof existing.createdAt === "number" ? (existing.createdAt as number) : now;

    const document: FaceSheetDocument = { ...faceSheet, createdAt, updatedAt: now };

    await faceSheetRef.set(document, { merge: false });

    log("info", "face_sheet_saved", { uid, updatedAt: now });
    sendJson(res, 200, { faceSheet, createdAt, updatedAt: now });
  } catch (error) {
    log("error", "failed_to_save_face_sheet", {
      uid,
      error: serializeError(error),
    });
    sendJson(res, 500, { error: "failed to save face sheet" });
  }
}

async function loadFaceSheetSummary(uid: string): Promise<string | null> {
  try {
    const faceSheetRef = db
      .collection("users")
      .doc(uid)
      .collection("meta")
      .doc("faceSheet");
    const snapshot = await faceSheetRef.get();
    if (!snapshot.exists) {
      return null;
    }
    const data = snapshot.data() as Record<string, unknown> | undefined;
    if (!data) {
      return null;
    }
    const faceSheet = sanitizeFaceSheetPayload(data);
    if (!faceSheet) {
      return null;
    }
    const summary = formatFaceSheetSummary(faceSheet);
    return summary ? summary : null;
  } catch (error) {
    log("warn", "failed_to_load_face_sheet_summary", {
      uid,
      error: serializeError(error),
    });
    return null;
  }
}

function formatFaceSheetSummary(faceSheet: FaceSheet): string {
  const lines: string[] = ["【フェイスシート情報】"];

  const basicLines: string[] = [];
  if (faceSheet.basic.nickname) {
    basicLines.push(`呼び名: ${faceSheet.basic.nickname}`);
  }
  if (faceSheet.basic.honorifics.length > 0) {
    const labels = faceSheet.basic.honorifics.map((item) => HONORIFIC_LABELS[item] ?? item);
    basicLines.push(`敬称: ${labels.join(" / ")}`);
  }
  if (faceSheet.basic.honorificOther) {
    basicLines.push(`敬称（その他）: ${faceSheet.basic.honorificOther}`);
  }
  if (faceSheet.basic.gender.length > 0) {
    const labels = faceSheet.basic.gender.map((item) => GENDER_LABELS[item] ?? item);
    basicLines.push(`性別・ジェンダー: ${labels.join(" / ")}`);
  }
  if (faceSheet.basic.genderOther) {
    basicLines.push(`ジェンダー（その他）: ${faceSheet.basic.genderOther}`);
  }
  if (faceSheet.basic.genderFreeText) {
    basicLines.push(`ジェンダー補足: ${faceSheet.basic.genderFreeText}`);
  }
  if (faceSheet.basic.age) {
    basicLines.push(`年齢: ${faceSheet.basic.age}`);
  }
  if (basicLines.length > 0) {
    lines.push("〈基本情報〉");
    for (const line of basicLines) {
      lines.push(`- ${line}`);
    }
  }

  const workLines: string[] = [];
  if (faceSheet.work.role) {
    workLines.push(`職種・役割: ${faceSheet.work.role}`);
  }
  if (faceSheet.work.organization) {
    workLines.push(`所属: ${faceSheet.work.organization}`);
  }
  if (faceSheet.work.employmentTypes.length > 0) {
    const labels = faceSheet.work.employmentTypes.map((item) => EMPLOYMENT_LABELS[item] ?? item);
    workLines.push(`雇用形態: ${labels.join(" / ")}`);
  }
  if (faceSheet.work.employmentOther) {
    workLines.push(`雇用形態（その他）: ${faceSheet.work.employmentOther}`);
  }
  if (faceSheet.work.workPatterns.length > 0) {
    const labels = faceSheet.work.workPatterns.map((item) => WORK_PATTERN_LABELS[item] ?? item);
    workLines.push(`勤務形態: ${labels.join(" / ")}`);
  }
  if (faceSheet.work.workPatternOther) {
    workLines.push(`勤務形態（その他）: ${faceSheet.work.workPatternOther}`);
  }
  if (faceSheet.work.weeklyHours) {
    workLines.push(`週あたり勤務時間: ${faceSheet.work.weeklyHours}`);
  }
  if (faceSheet.work.stressors) {
    workLines.push(`主なストレス要因: ${faceSheet.work.stressors}`);
  }
  if (faceSheet.work.supportResources) {
    workLines.push(`頼れる支援資源: ${faceSheet.work.supportResources}`);
  }
  if (workLines.length > 0) {
    lines.push("〈仕事〉");
    for (const line of workLines) {
      lines.push(`- ${line}`);
    }
  }

  const familyLines: string[] = [];
  if (faceSheet.family.livingArrangement) {
    const label = LIVING_ARRANGEMENT_LABELS[faceSheet.family.livingArrangement];
    familyLines.push(`同居状況: ${label ?? faceSheet.family.livingArrangement}`);
  }
  if (faceSheet.family.household) {
    familyLines.push(`世帯構成メモ: ${faceSheet.family.household}`);
  }
  if (faceSheet.family.careResponsibilities.length > 0) {
    const labels = faceSheet.family.careResponsibilities.map(
      (item) => CARE_RESPONSIBILITY_LABELS[item] ?? item,
    );
    familyLines.push(`ケア責任: ${labels.join(" / ")}`);
  }
  if (faceSheet.family.careOther) {
    familyLines.push(`ケア責任（その他）: ${faceSheet.family.careOther}`);
  }
  if (faceSheet.family.careTime) {
    familyLines.push(`ケアにかける時間: ${faceSheet.family.careTime}`);
  }
  if (familyLines.length > 0) {
    lines.push("〈家族・暮らし〉");
    for (const line of familyLines) {
      lines.push(`- ${line}`);
    }
  }

  const personalityLines: string[] = [];
  const traitEntries = Object.entries(faceSheet.personality.traits).filter(
    (entry): entry is [PersonalityTraitKey, number] => entry[1] !== null && Number.isFinite(entry[1]),
  );
  if (traitEntries.length > 0) {
    const traitTexts = traitEntries.map(([key, value]) => {
      const label = PERSONALITY_TRAIT_LABELS[key] ?? key;
      return `${label}:${value}`;
    });
    personalityLines.push(`特性スコア: ${traitTexts.join(" / ")}`);
  }
  if (faceSheet.personality.tags.length > 0) {
    const labels = faceSheet.personality.tags.map((item) => PERSONALITY_TAG_LABELS[item] ?? item);
    personalityLines.push(`傾向タグ: ${labels.join(" / ")}`);
  }
  if (faceSheet.personality.tagOther) {
    personalityLines.push(`傾向タグ（その他）: ${faceSheet.personality.tagOther}`);
  }
  if (faceSheet.personality.strengths) {
    personalityLines.push(`強み: ${faceSheet.personality.strengths}`);
  }
  if (faceSheet.personality.cautions) {
    personalityLines.push(`気をつけたいこと: ${faceSheet.personality.cautions}`);
  }
  if (personalityLines.length > 0) {
    lines.push("〈性格・資質〉");
    for (const line of personalityLines) {
      lines.push(`- ${line}`);
    }
  }

  const lifeLines: string[] = [];
  const areaEntries = Object.entries(faceSheet.lifeInventory.areas) as Array<[
    LifeAreaKey,
    FaceSheetArea,
  ]>;
  for (const [key, area] of areaEntries) {
    const hasContent = (area.satisfaction ?? null) !== null || Boolean(area.note);
    if (!hasContent) {
      continue;
    }
    const label = LIFE_AREA_LABELS[key] ?? key;
    const parts: string[] = [];
    if (area.satisfaction !== null) {
      parts.push(`満足度:${area.satisfaction}`);
    }
    if (area.note) {
      parts.push(`メモ:${area.note}`);
    }
    lifeLines.push(`${label}: ${parts.join(" / ")}`);
  }
  if (faceSheet.lifeInventory.dailyRoutine) {
    lifeLines.push(`1日の流れ: ${faceSheet.lifeInventory.dailyRoutine}`);
  }
  if (lifeLines.length > 0) {
    lines.push("〈生活の棚卸し〉");
    for (const line of lifeLines) {
      lines.push(`- ${line}`);
    }
  }

  const coachingLines: string[] = [];
  if (faceSheet.coaching.topics.length > 0) {
    const topicTexts = faceSheet.coaching.topics.map((topic) => {
      const label = COACHING_TOPIC_LABELS[topic.id] ?? topic.id;
      return topic.starred ? `★${label}` : label;
    });
    coachingLines.push(`関心トピック: ${topicTexts.join(" / ")}`);
  }
  if (faceSheet.coaching.topicOther) {
    coachingLines.push(`トピック（その他）: ${faceSheet.coaching.topicOther}`);
  }
  if (faceSheet.coaching.challenge) {
    coachingLines.push(`現在の課題: ${faceSheet.coaching.challenge}`);
  }
  if (faceSheet.coaching.kpi) {
    coachingLines.push(`大切にしたい指標: ${faceSheet.coaching.kpi}`);
  }
  if (coachingLines.length > 0) {
    lines.push("〈コーチングの希望〉");
    for (const line of coachingLines) {
      lines.push(`- ${line}`);
    }
  }

  const safetyLines: string[] = [];
  const meaningfulConcerns = faceSheet.safety.concerns.filter((item) => item !== "none");
  if (meaningfulConcerns.length > 0) {
    const labels = meaningfulConcerns.map((item) => SAFETY_CONCERN_LABELS[item] ?? item);
    safetyLines.push(`安全面の懸念: ${labels.join(" / ")}`);
  } else if (faceSheet.safety.concerns.includes("none")) {
    safetyLines.push(`安全面の懸念: ${SAFETY_CONCERN_LABELS.none}`);
  }
  if (faceSheet.safety.concernOther) {
    safetyLines.push(`安全面の補足: ${faceSheet.safety.concernOther}`);
  }
  safetyLines.push(`情報共有への同意: ${faceSheet.safety.consent ? "はい" : "いいえ"}`);
  if (safetyLines.length > 0) {
    lines.push("〈安全面〉");
    for (const line of safetyLines) {
      lines.push(`- ${line}`);
    }
  }

  const summary = lines.join("\n").trim();
  return summary === "【フェイスシート情報】" ? "" : summary;
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
  if (cached) {
    const normalizedCoachType =
      normalizeCoachType(cached.coachType) ?? DEFAULT_COACH_TYPE;
    if (cached.coachType !== normalizedCoachType) {
      const normalized = { ...cached, coachType: normalizedCoachType };
      memory.set(sessionId, normalized);
      return normalized;
    }
    return cached;
  }

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

  const sessionStage = parseStage(sessionData.stage) ?? "intro";
  const normalizedCoachType = normalizeCoachType(sessionData.coachType);
  const coachType = normalizedCoachType ?? DEFAULT_COACH_TYPE;

  if (!normalizedCoachType) {
    void sessionRef
      .set({ coachType }, { merge: true })
      .catch((error) =>
        log("warn", "session_coach_type_backfill_failed", {
          uid,
          sessionId,
          error: serializeError(error),
        }),
      );
  }

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
    const fallbackStage = stage ?? sessionStage;
    const state = data.state !== undefined
      ? tryParseCoachingState(data.state, fallbackStage)
      : undefined;
    const coachType = normalizeCoachType(data.coachType);

    acc.push({
      role,
      content,
      createdAt,
      stage,
      state,
      coachType,
    });

    return acc;
  }, []);

  const faceSheetSummary = await loadFaceSheetSummary(uid);

  const result: SessionCache = {
    messages: items,
    stage: parseStage(sessionData.stage),
    coachType,
    faceSheetSummary,
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

function parseCoachPayload(text: string, fallbackStage: Stage = "intro"): CoachPayload {
  const jsonSegment = extractJsonObject(text);
  if (!jsonSegment) {
    throw new Error("Gemini output is missing State JSON");
  }

  let rawState: unknown;
  try {
    rawState = JSON.parse(jsonSegment);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini output state JSON is invalid: ${message}`);
  }

    const state = parseCoachingState(rawState, fallbackStage);
  const stage = state.stage;

  const jsonIndex = text.indexOf(jsonSegment);
  const coachingPart = jsonIndex >= 0 ? text.slice(0, jsonIndex) : text;
  const message = extractCoachingMessage(coachingPart);
  if (!message) {
    throw new Error("Gemini output message is empty");
  }

    return { stage, message, state };
}

function extractCoachingMessage(raw: string): string {
  if (!raw) {
    return "";
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/[\u0000-\u001F\u007F]+/g, ""));

  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }

  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    const normalized = last.replace(/[：:]/g, ":").toLowerCase();
    if (!last) {
      lines.pop();
      continue;
    }
    if (normalized === "state json" || normalized === "state json:") {
      lines.pop();
      continue;
    }
    if (/^[-*_]{3,}$/.test(normalized)) {
      lines.pop();
      continue;
    }
    break;
  }

  const joined = lines.join("\n").trim();
  return stripMarkdownStrong(joined);
}

function stripMarkdownStrong(value: string): string {
  if (!value) {
    return "";
  }

  const withoutDelimited = value
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/__(.*?)__/gs, "$1");

  return withoutDelimited.replace(/\*\*/g, "").replace(/__/g, "");
}

function parseCoachingState(value: unknown, fallbackStage: Stage): CoachingState {
  if (!isRecord(value)) {
    throw new Error("Gemini output state JSON is not an object");
  }

  const stage = normalizeStage(value.stage) ?? fallbackStage;
  const userGoals = toStringArray(value.user_goals);

  const realityRecord = isRecord(value.reality) ? value.reality : {};
  const reality: CoachingState["reality"] = {
    facts: toStringArray(realityRecord.facts),
    obstacles: toStringArray(realityRecord.obstacles),
    supports: toStringArray(realityRecord.supports),
    score_0to10: toScore(realityRecord.score_0to10),
  };

  const resourcesRecord = isRecord(value.resources) ? value.resources : {};
  const resources: CoachingState["resources"] = {
    internal: toStringArray(resourcesRecord.internal),
    external: toStringArray(resourcesRecord.external),
  };

  const planRecord = isRecord(value.plan) ? value.plan : {};
  const plan: CoachingState["plan"] = {
    first_step: toStringValue(planRecord.first_step),
    when_where: toStringValue(planRecord.when_where),
    measure_of_success: toStringValue(planRecord.measure_of_success),
    if_then: toStringValue(planRecord.if_then),
    planB: toStringValue(planRecord.planB),
  };

  return {
    stage,
    user_goals: userGoals,
    reality,
    resources,
    options: toStringArray(value.options),
    plan,
    risks: toStringArray(value.risks),
    agreements: toStringArray(value.agreements),
    next_prompt_to_user: toStringValue(value.next_prompt_to_user),
  };
}

function tryParseCoachingState(
  value: unknown,
  fallbackStage: Stage,
): CoachingState | undefined {
  try {
    return parseCoachingState(value, fallbackStage);
  } catch (error) {
    log("warn", "failed_to_parse_coaching_state", {
      fallbackStage,
      error: serializeError(error),
    });
    return undefined;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toScore(value: unknown): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(num)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(10, num));
  return Number.isFinite(clamped) ? clamped : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  const lower = trimmed.toLowerCase();
  if (VALID_STAGES.has(lower as Stage)) {
    return lower as Stage;
  }

  const simplified = lower.replace(/[^a-z]/g, "");
  switch (simplified) {
    case "intro":
    case "introduction":
    case "start":
      return "intro";
    case "inventory":
    case "inventry":
    case "discover":
      return "inventory";
    case "g":
    case "goal":
      return "goal";
    case "r":
    case "reality":
      return "reality";
    case "o":
    case "options":
      return "options";
    case "w":
    case "will":
      return "will";
    case "wrap":
    case "wrapup":
    case "wrapreview":
    case "review":
    case "close":
    case "closing":
      return "closing";
    default:
      return undefined;    
  }
}

function normalizeCoachType(value: unknown): CoachType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  return VALID_COACH_TYPES.has(trimmed as CoachType)
    ? (trimmed as CoachType)
    : undefined;
}

const HONORIFIC_SET = new Set<HonorificOption>(HONORIFIC_OPTIONS);
const GENDER_SET = new Set<GenderOption>(GENDER_OPTIONS);
const EMPLOYMENT_TYPE_SET = new Set<EmploymentTypeOption>(EMPLOYMENT_TYPES);
const WORK_PATTERN_SET = new Set<WorkPatternOption>(WORK_PATTERNS);
const LIVING_ARRANGEMENT_SET = new Set<LivingArrangementOption>(LIVING_ARRANGEMENTS);
const CARE_RESPONSIBILITY_SET = new Set<CareResponsibilityOption>(CARE_RESPONSIBILITIES);
const PERSONALITY_TAG_SET = new Set<PersonalityTagOption>(PERSONALITY_TAGS);
const COACHING_TOPIC_SET = new Set<CoachingTopicOption>(COACHING_TOPICS);
const SAFETY_CONCERN_SET = new Set<SafetyConcernOption>(SAFETY_CONCERNS);

function sanitizeFaceSheetPayload(value: unknown): FaceSheet | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    basic: sanitizeBasicSection(value.basic),
    work: sanitizeWorkSection(value.work),
    family: sanitizeFamilySection(value.family),
    personality: sanitizePersonalitySection(value.personality),
    lifeInventory: sanitizeLifeInventorySection(value.lifeInventory),
    coaching: sanitizeCoachingSection(value.coaching),
    safety: sanitizeSafetySection(value.safety),
  };
}

function sanitizeBasicSection(input: unknown): FaceSheet["basic"] {
  const record = isRecord(input) ? input : {};
  return {
    nickname: sanitizeText(record.nickname, 120),
    honorifics: sanitizeSelectionArray(record.honorifics, HONORIFIC_SET),
    honorificOther: sanitizeText(record.honorificOther, 120),
    gender: sanitizeSelectionArray(record.gender, GENDER_SET),
    genderOther: sanitizeText(record.genderOther, 120),
    genderFreeText: sanitizeText(record.genderFreeText, 1000),
    age: sanitizeText(record.age, 32),
  };
}

function sanitizeWorkSection(input: unknown): FaceSheet["work"] {
  const record = isRecord(input) ? input : {};
  return {
    role: sanitizeText(record.role, 200),
    organization: sanitizeText(record.organization, 200),
    employmentTypes: sanitizeSelectionArray(record.employmentTypes, EMPLOYMENT_TYPE_SET),
    employmentOther: sanitizeText(record.employmentOther, 120),
    workPatterns: sanitizeSelectionArray(record.workPatterns, WORK_PATTERN_SET),
    workPatternOther: sanitizeText(record.workPatternOther, 120),
    weeklyHours: sanitizeText(record.weeklyHours, 40),
    stressors: sanitizeText(record.stressors, 1200),
    supportResources: sanitizeText(record.supportResources, 1200),
  };
}

function sanitizeFamilySection(input: unknown): FaceSheet["family"] {
  const record = isRecord(input) ? input : {};
  const living = sanitizeSingleSelection(
    record.livingArrangement,
    LIVING_ARRANGEMENT_SET,
    "noAnswer",
  );
  const responsibilities = sanitizeSelectionArray(record.careResponsibilities, CARE_RESPONSIBILITY_SET);
  return {
    livingArrangement: living,
    household: sanitizeText(record.household, 1200),
    careResponsibilities: responsibilities,
    careOther: sanitizeText(record.careOther, 120),
    careTime: sanitizeText(record.careTime, 600),
  };
}

function sanitizePersonalitySection(input: unknown): FaceSheet["personality"] {
  const record = isRecord(input) ? input : {};
  return {
    traits: sanitizeTraitScores(record.traits),
    tags: sanitizeSelectionArray(record.tags, PERSONALITY_TAG_SET),
    tagOther: sanitizeText(record.tagOther, 120),
    strengths: sanitizeText(record.strengths, 1200),
    cautions: sanitizeText(record.cautions, 1200),
  };
}

function sanitizeLifeInventorySection(input: unknown): FaceSheet["lifeInventory"] {
  const record = isRecord(input) ? input : {};
  return {
    areas: sanitizeLifeAreas(record.areas),
    dailyRoutine: sanitizeText(record.dailyRoutine, 2000),
  };
}

function sanitizeCoachingSection(input: unknown): FaceSheet["coaching"] {
  const record = isRecord(input) ? input : {};
  const topics = sanitizeTopicSelections(record.topics);
  return {
    topics,
    topicOther: sanitizeText(record.topicOther, 600),
    challenge: sanitizeText(record.challenge, 1200),
    kpi: sanitizeText(record.kpi, 1200),
  };
}

function sanitizeSafetySection(input: unknown): FaceSheet["safety"] {
  const record = isRecord(input) ? input : {};
  const concerns = sanitizeSelectionArray(record.concerns, SAFETY_CONCERN_SET);
  const normalizedConcerns =
    concerns.includes("none") && concerns.length > 1
      ? concerns.filter((item) => item !== "none")
      : concerns;
  return {
    concerns: normalizedConcerns,
    concernOther: sanitizeText(record.concernOther, 600),
    consent: sanitizeBoolean(record.consent),
  };
}

function sanitizeSelectionArray<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: T[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim() as T;
    if (!trimmed) {
      continue;
    }
    if (allowed.has(trimmed) && !result.includes(trimmed)) {
      result.push(trimmed);
    }
  }
  return result;
}

function sanitizeSingleSelection<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  fallback: T,
): T {
  if (typeof value === "string") {
    const trimmed = value.trim() as T;
    if (trimmed && allowed.has(trimmed)) {
      return trimmed;
    }
  }
  return fallback;
}

function sanitizeTraitScores(value: unknown): Record<PersonalityTraitKey, number | null> {
  const record = isRecord(value) ? value : {};
  const traits: Record<PersonalityTraitKey, number | null> = {
    extraversion: null,
    agreeableness: null,
    conscientiousness: null,
    emotionalStability: null,
    openness: null,
  };
  for (const key of PERSONALITY_TRAITS) {
    traits[key] = sanitizeTraitScore(record[key]);
  }
  return traits;
}

function sanitizeTraitScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampScore(Math.round(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return clampScore(parsed);
    }
  }
  return null;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value < 1) {
    return 1;
  }
  if (value > 5) {
    return 5;
  }
  return value;
}

function sanitizeLifeAreas(value: unknown): Record<LifeAreaKey, FaceSheetArea> {
  const record = isRecord(value) ? value : {};
  const result: Record<LifeAreaKey, FaceSheetArea> = {} as Record<LifeAreaKey, FaceSheetArea>;
  for (const key of LIFE_AREAS) {
    const areaValue = isRecord(record[key]) ? (record[key] as Record<string, unknown>) : {};
    const satisfaction = sanitizeSatisfaction(areaValue.satisfaction ?? areaValue.score);
    const memoSource =
      areaValue.note ?? areaValue.memo ?? areaValue.comment ?? areaValue.text ?? "";
    result[key] = {
      satisfaction,
      note: sanitizeText(memoSource, 600),
    };
  }
  return result;
}

function sanitizeSatisfaction(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampSatisfaction(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed)) {
      return clampSatisfaction(parsed);
    }
  }
  return null;
}

function clampSatisfaction(value: number): number {
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 10) {
    return 10;
  }
  return rounded;
}

function sanitizeTopicSelections(value: unknown): FaceSheetTopicSelection[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: FaceSheetTopicSelection[] = [];
  const seen = new Set<CoachingTopicOption>();
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const idValue = item.id;
    if (typeof idValue !== "string") {
      continue;
    }
    const trimmed = idValue.trim() as CoachingTopicOption;
    if (!trimmed || !COACHING_TOPIC_SET.has(trimmed) || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    const starred = sanitizeBoolean(item.starred);
    result.push({ id: trimmed, starred });
  }

  let starCount = 0;
  return result.map((topic) => {
    if (topic.starred) {
      if (starCount >= 3) {
        return { ...topic, starred: false };
      }
      starCount += 1;
    }
    return topic;
  });
}

function sanitizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return Boolean(value);
}

function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalizedNewline = value.replace(/\r\n?/g, "\n");
  const withoutControl = normalizedNewline.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  const trimmed = withoutControl.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
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

const parseStage = normalizeStage;