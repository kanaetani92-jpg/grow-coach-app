// API 呼び出しの共通ラッパー（Authorization: Bearer <idToken> を付与）
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? ""; // 例: https://<CloudRun>/api

export async function createSession(idToken: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions`, {
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
}

export async function callCoach(
  payload: { message: string },
  idToken: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/coach`, {
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
  const data = (await res.json()) as { reply: string };
  return data.reply;
}
