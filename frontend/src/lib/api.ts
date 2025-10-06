const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export async function createSession(idToken: string) {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    credentials: "include",
    body: JSON.stringify({}), // サーバ側が空ボディでOKならそのまま
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`createSession failed: ${res.status} ${err}`);
  }
}

/** ← 第1引数を { message: string } にする */
export async function callCoach(
  body: { message: string },
  idToken: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/coach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error ? `callCoach failed: ${data.error}` : `callCoach failed: ${res.status}`
    );
  }

  // サーバの返却形に合わせて取り出すキーを調整
  return data.reply ?? data.message ?? "";
}
