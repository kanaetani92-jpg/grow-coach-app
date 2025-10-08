// frontend/src/lib/api.ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type HistoryMessage = {
  role: string;
  content: string;
  createdAt: number;
  stage?: string;
  next_fields?: string[];
};

export type SessionSummary = {
  sessionId: string;
  stage?: string;
  createdAt?: number;
  updatedAt?: number;
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
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

export async function createSession(
  idToken: string
): Promise<{ sessionId: string; stage: string }> {
  return apiFetch("/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({}),
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
  payload: { sessionId: string; userText: string },
  idToken: string
): Promise<{ stage: string; message: string; next_fields: string[] }> {
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
): Promise<{ stage?: string; messages: HistoryMessage[]; hasMore: boolean; cursor?: number }> {
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