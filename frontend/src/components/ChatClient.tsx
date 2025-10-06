"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { createSession, callCoach } from "@/lib/api";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatClient() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  // サインイン状態監視 & セッション作成
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email ?? "(no email)");
        const idToken = await user.getIdToken();
        await createSession(idToken); // Authorization: Bearer <token> 付きでPOST
      } else {
        setUserEmail(null);
      }
    });
    return () => unsub();
  }, []);

  async function handleSignIn() {
    await signInWithPopup(auth, googleProvider);
  }

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const reply = await callCoach(input.trim()); // `/api/coach` 叩く
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* サインインしてなければボタン表示 */}
      {!userEmail ? (
        <button
          onClick={handleSignIn}
          className="rounded-xl px-4 py-2 border"
        >
          Googleでサインイン
        </button>
      ) : (
        <div className="text-sm text-gray-600">Signed in: {userEmail}</div>
      )}

      {/* 会話表示 */}
      <div className="border rounded-xl p-4 min-h-[200px] bg-white">
        {messages.length === 0 ? (
          <div className="text-gray-400">ここに会話が表示されます。</div>
        ) : (
          <ul className="space-y-2">
            {messages.map((m, i) => (
              <li key={i}>
                <span className="font-semibold">{m.role === "user" ? "自分" : "AI"}</span>
                ：{m.content}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 入力欄 */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="メッセージを入力…（Enterで送信）"
          className="flex-1 border rounded-xl px-3 py-2"
          disabled={!userEmail || loading}
        />
        <button
          onClick={handleSend}
          className="rounded-xl px-4 py-2 border"
          disabled={!userEmail || loading}
        >
          送信
        </button>
      </div>
      {loading && <div className="text-sm text-gray-500">AIが考え中…</div>}
    </div>
  );
}
