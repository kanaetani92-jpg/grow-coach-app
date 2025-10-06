"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { callCoach } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatClient() {
  const [authed, setAuthed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthed(false);
        tokenRef.current = null;
        return;
      }
      setAuthed(true);
      tokenRef.current = await user.getIdToken();
    });
    return () => unsub();
  }, []);

  const onSend = async () => {
    const msg = input.trim();
    if (!msg) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    try {
      const idToken = tokenRef.current!;
      const reply = await callCoach({ message: msg }, idToken);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `エラー: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <p className="text-sm opacity-80">
        ログインリンクでサインインするとチャットが有効になります。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold">ログイン済み</span>
        <button className="text-sm underline" onClick={() => signOut(auth)}>
          サインアウト
        </button>
      </div>

      <div className="h-64 overflow-auto border rounded p-3 bg-white/60">
        {messages.length === 0 ? (
          <p className="opacity-60">ここに会話が表示されます。</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="mb-2">
              <span className="font-semibold mr-2">
                {m.role === "user" ? "自分" : "AI"}
              </span>
              <span>{m.content}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="メッセージを入力…（Enterで送信）"
          className="border rounded px-3 py-2 flex-1"
        />
        <button onClick={onSend} disabled={loading} className="border px-3 py-2 rounded">
          {loading ? "送信中…" : "送信"}
        </button>
      </div>
    </div>
  );
}
