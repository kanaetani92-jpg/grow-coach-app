// API 呼び出しの共通ラッパー（Authorization: Bearer <idToken> を付与）
// NOTE: 旧名称 `NEXT_PUBLIC_BACKEND_BASE_URL` との互換性を維持するため、
//       `NEXT_PUBLIC_BACKEND_URL` と両方の環境変数を参照する。
const rawBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "";

const trimmedBaseUrl = rawBaseUrl.replace(/\/$/, "");
const isFallbackApiBase = trimmedBaseUrl === "";
const apiBase = isFallbackApiBase
  ? "/api"
  : trimmedBaseUrl.endsWith("/api")
      ? trimmedBaseUrl
      : `${trimmedBaseUrl}/api`;

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
  const url = `${apiBase}${urlPath.startsWith("/") ? "" : "/"}${urlPath}`;

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

    if (isFallbackApiBase && (res.status === 404 || res.status === 405)) {
      message =
        "バックエンド API のベース URL が設定されていないため、Next.js の `/api` プレースホルダーにアクセスして 404/405 が返却されました。" +
        " `NEXT_PUBLIC_BACKEND_URL` (または `NEXT_PUBLIC_BACKEND_BASE_URL`) を設定して、正しいバックエンドにリクエストが送られるようにしてください。";
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

type HistoryMessage = {
  role: string;
@@ -99,30 +105,31 @@ type HistoryResponse = {
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
  const query = new URLSearchParams({ sessionId }).toString();
  return await request<HistoryResponse>(`/history?${query}`, {
    method: "GET",
    idToken,
  });
}