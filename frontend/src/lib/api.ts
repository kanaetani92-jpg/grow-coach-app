+80
-62

// API 呼び出しの共通ラッパー（Authorization: Bearer <idToken> を付与）
const BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "").replace(/\/$/, "");
const API_PREFIX = "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message || `API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  idToken?: string;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = options.body ? "POST" : "GET", idToken, body } = options;
  const headers = new Headers();

  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }
  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  }

  const urlPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL}${API_PREFIX}${urlPath}`;

  const res = await fetch(url, {
    method,
    headers,
    body:
      body !== undefined && method !== "GET" && method !== "HEAD"
        ? JSON.stringify(body)
        : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    let message: string;
    try {
      message = await res.text();
    } catch {
      message = res.statusText;
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  return (await res.text()) as unknown as T;
}

type SessionResponse = { sessionId: string; stage: string };

type CoachResponse = {
  stage: string;
  message: string;
  next_fields: string[];
};

type HistoryResponse = {
  messages: Array<{ role: string; content: string; createdAt: number }>;
  stage?: string;
};

export async function createSession(idToken: string): Promise<SessionResponse> {
  return await request<SessionResponse>("/sessions", {
    method: "POST",
    idToken,
    body: {},
  });
}

export async function callCoach(
  payload: { sessionId: string; userText: string },
  idToken: string
): Promise<CoachResponse> {
  return await request<CoachResponse>("/coach", {
    method: "POST",
    idToken,
    body: payload,
  });
}

export async function fetchHistory(
  sessionId: string,
  idToken: string
): Promise<HistoryResponse> {
  const params = new URLSearchParams({ sessionId });
  return await request<HistoryResponse>(`/history?${params.toString()}`, {
    method: "GET",
    idToken,
  });
}