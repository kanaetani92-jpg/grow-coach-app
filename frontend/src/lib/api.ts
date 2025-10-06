// frontend/src/lib/api.ts
import { getAuth } from "firebase/auth";
import { auth } from "./firebase"; // 既存の firebase.ts が export しているはず

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!; // 例: https://grow-backend-...run.app

/** Firebase IDトークンを取得して Authorization ヘッダーを付ける共通fetch */
async function authedFetch(path: string, init: RequestInit = {}) {
  // 念のため auth を初期化済み想定（./firebase で initializeApp 済）
  const user = getAuth().currentUser;
  if (!user) throw new Error("not-signed-in"); // 未ログイン

  const idToken = await user.getIdToken(true);

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      // ←← これが「どこに何を付けるか」の答えです
      Authorization: `Bearer ${idToken}`,
    },
  });
}

export async function createSession() {
  const res = await authedFetch("/api/sessions", { method: "POST", body: "{}" });
  if (!res.ok) throw new Error("createSession failed");
  return res.json() as Promise<{ sessionId: string; stage: string }>;
}

export async function callCoach(sessionId: string, userText: string) {
  const res = await authedFetch("/api/coach", {
    method: "POST",
    body: JSON.stringify({ sessionId, userText }),
  });
  if (!res.ok) throw new Error("coach failed");
  return res.json() as Promise<{ stage: string; message: string; next_fields: string[] }>;
}
