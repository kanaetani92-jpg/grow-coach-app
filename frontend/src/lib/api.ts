// frontend/src/lib/api.ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type CoachingStage =
  | "intro"
  | "inventory"
  | "goal"
  | "reality"
  | "options"
  | "will"
  | "closing";

export type CoachingState = {
  stage: CoachingStage;
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

export type HistoryMessage = {
  role: string;
  content: string;
  createdAt: number;
  stage?: string;
  state?: CoachingState;
  coachType?: CoachType;
};

export type CoachType = "akito" | "kanon" | "naruka";

export type SessionSummary = {
  sessionId: string;
  stage?: string;
  coachType?: CoachType;
  createdAt?: number;
  updatedAt?: number;
};

export type DialogueCategory = "anythingTalk" | "futureVision";

export type DialogueEntry = {
  id: string;
  category: DialogueCategory;
  content: string;
  createdAt: number;
};

export type FaceSheetResponse = {
  sessionId: string;
  stage: string | null;
  faceSheet: CoachingState | null;
  dialogues: Record<DialogueCategory, DialogueEntry[]>;
};

function getApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  const base = raw.replace(/\/+$/, "");
  if (!base) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_BACKEND_BASE_URL (or *_BACKEND_URL / NEXT_PUBLIC_API_BASE_URL)"
    );
  }
  return `${base}/api`;
}

const API_BASE = getApiBase();

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    console.error("API request failed", error);
    throw new ApiError(
      0,
      "サーバーに接続できませんでした。ネットワーク環境を確認して再試行してください。",
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || res.statusText;
    try {
      const parsed = text ? JSON.parse(text) : null;
      if (parsed && typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch (error) {
      console.warn("Failed to parse error response", error);
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export async function createSession(
  idToken: string,
  coachType: CoachType,
): Promise<{ sessionId: string; stage: string; coachType: CoachType }> {
  return apiFetch("/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ coachType }),
  });
}

export async function listSessions(
  idToken: string
): Promise<{ sessions: SessionSummary[] }> {
  return apiFetch("/sessions", {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

export async function callCoach(
  payload: { sessionId: string; userText: string; coachType?: CoachType },
  idToken: string
): Promise<{ stage: string; message: string; state: CoachingState; coachType: CoachType }> {
  return apiFetch("/coach", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
}

export async function fetchHistory(
  sessionId: string,
  idToken: string,
  options: { before?: number; limit?: number } = {},
): Promise<{
  stage?: string;
  coachType: CoachType;
  messages: HistoryMessage[];
  hasMore: boolean;
  cursor?: number;
}> {
  const params = new URLSearchParams({ sessionId });
  if (typeof options.before === "number") {
    params.set("before", String(options.before));
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  return apiFetch(`/history?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

export async function fetchFaceSheet(
  sessionId: string,
  idToken: string,
): Promise<FaceSheetResponse> {
  const params = new URLSearchParams({ sessionId });
  return apiFetch(`/face-sheet?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

export async function addDialogueEntry(
  payload: { sessionId: string; category: DialogueCategory; content: string },
  idToken: string,
): Promise<{ entry: DialogueEntry }> {
  return apiFetch("/face-sheet/dialogues", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
}