// frontend/src/lib/api.ts
const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://grow-backend-821934913153.asia-northeast1.run.app";

type Json = Record<string, unknown>;

async function jsonFetch<T = Json>(
  path: string,
  opts: RequestInit & { authToken?: string } = {}
): Promise<T> {
  const { authToken, headers, ...rest } = opts;
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(headers || {}),
    },
    ...rest,
  });
  if (!res.ok) {
    // レスポンス本文にエラーがあれば拾う
    let detail = "";
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) detail = ` (${j.error})`;
    } catch {}
    throw new Error(`${res.status} ${res.statusText}${detail}`);
  }
  // 成功時に JSON を返す（空なら {}）
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

/** セッション作成: 必ず Firebase の ID トークンを渡す */
export async function createSession(idToken: string) {
  return jsonFetch("/api/sessions", {
    method: "POST",
    body: JSON.stringify({}), // サーバーが本文不要なら空でOK
    authToken: idToken,
  });
}

/** コーチ呼び出し: こちらも Authorization を付与 */
export async function callCoach(idToken: string, payload: { message: string }) {
  return jsonFetch("/api/coach", {
    method: "POST",
    body: JSON.stringify(payload),
    authToken: idToken,
  });
}
