// API 呼び出しの共通ラッパー（Authorization: Bearer <idToken> を付与）
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ""; // 例: https://<CloudRun>/api

if (!BASE_URL) {
  console.warn("NEXT_PUBLIC_BACKEND_URL is not set. API calls will fail.");
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = {
  method?: string;
  idToken: string;
  body?: unknown;
};

async function request<T>(
  path: string,
  { method = "GET", idToken, body }: FetchOptions
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(`${method} ${path} failed`, res.status, text);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function createSession(
  idToken: string
): Promise<{ sessionId: string; stage: string }> {
  return await request<{ sessionId: string; stage: string }>("/sessions", {
    method: "POST",
    idToken,
    body: {},
  });
}

export async function callCoach(
  payload: { sessionId: string; userText: string },
  idToken: string
): Promise<{ stage: string; message: string; next_fields: string[] }> {
  return await request<{ stage: string; message: string; next_fields: string[] }>(
    "/coach",
    {
      method: "POST",
      idToken,
      body: payload,
    }
  );
}

export async function fetchHistory(
  sessionId: string,
  idToken: string
): Promise<{
  messages: Array<{ role: string; content: string; createdAt: number }>;
  stage?: string;
}>
{
  const params = new URLSearchParams({ sessionId });
  return await request<{
    messages: Array<{ role: string; content: string; createdAt: number }>;
    stage?: string;
  }>(
    `/history?${params.toString()}`,
    {
      method: "GET",
      idToken,
    }
  );
}