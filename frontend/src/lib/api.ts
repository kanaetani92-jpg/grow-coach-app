// API 呼び出しの共通ラッパー（Authorization: Bearer <idToken> を付与）
const BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "").replace(/\/$/, "");

type SessionResponse = { sessionId: string; stage: string };

export async function createSession(idToken: string): Promise<SessionResponse> {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({}),
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createSession failed: ${res.status} ${text}`);
  }
  return (await res.json()) as SessionResponse;
}

export async function callCoach(
  payload: { sessionId: string; userText: string },
  idToken: string
): Promise<{ stage: string; message: string; next_fields: string[] }> {
  const res = await fetch(`${BASE_URL}/api/coach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`callCoach failed: ${res.status} ${text}`);
  }
  return (await res.json()) as {
    stage: string;
    message: string;
    next_fields: string[];
  };
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