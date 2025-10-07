"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { callCoach, createSession } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatClient() {
  const [authed, setAuthed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthed(false);
        setSessionId(null);
        setStage(null);
        tokenRef.current = null;
        return;
      }
      setAuthed(true);
      const idToken = await user.getIdToken();
      tokenRef.current = idToken;

      const storedSessionId = window.localStorage.getItem("currentSessionId");
      if (storedSessionId) {
        setSessionId(storedSessionId);
        const storedStage = window.localStorage.getItem("currentSessionStage");
        setStage(storedStage);
        return;
      }

      try {
        const session = await createSession(idToken);
        setSessionId(session.sessionId);
        setStage(session.stage);
        window.localStorage.setItem("currentSessionId", session.sessionId);
        window.localStorage.setItem("currentSessionStage", session.stage);
      } catch (error) {
        const message = getErrorMessage(error);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `セッションの作成に失敗しました: ${message}`,
          },
        ]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onSend = async () => {
    const msg = input.trim();
    if (!msg) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    try {
      const idToken = tokenRef.current;
      if (!idToken) {
        throw new Error("ログイン情報を取得できませんでした。");
      }
      const activeSessionId = sessionId;
      if (!activeSessionId) {
        throw new Error("セッションが見つかりませんでした。");
      }
      const reply = await callCoach(
        { sessionId: activeSessionId, userText: msg },
        idToken
      );
      setStage(reply.stage);
      window.localStorage.setItem("currentSessionStage", reply.stage);
      const assistantMessage = formatAssistantMessage(reply.message, reply.next_fields, reply.stage);
      setMessages((m) => [...m, { role: "assistant", content: assistantMessage }]);
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
      <div className="flex items-center justify-between">
        <span className="font-semibold">ログイン済み</span>
        <button className="text-sm underline" onClick={() => signOut(auth)}>
          サインアウト
        </button>
      </div>
      <div className="text-xs text-gray-600 space-y-1">
        {sessionId && <p>セッションID: {sessionId}</p>}
        {stage && <p>現在のステージ: {stage}</p>}
      </div>

      <div
        ref={scrollRef}
        className="h-64 space-y-2 overflow-auto rounded border bg-white/60 p-3"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-gray-600">
            コーチに聞きたいことを入力してみましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((message, index) => (
              <li
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <span
                  className={
                  message.role === "user"
                    ? "inline-block max-w-[80%] rounded-lg bg-black px-3 py-2 text-sm text-white"
                    : "inline-block max-w-[80%] rounded-lg bg-white px-3 py-2 text-sm text-gray-800 shadow whitespace-pre-wrap"
              }
            >
              {message.content}
            </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="flex-1 rounded border px-3 py-2"
          placeholder="コーチへの質問を入力"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || input.trim().length === 0}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "送信中..." : "送信"}
        </button>
      </form>
    </div>
  );
}

function formatAssistantMessage(
  message: string,
  nextFields: string[],
  stage: string
): string {
  const lines: string[] = [];
  lines.push(`【ステージ: ${stage}】${message}`);
  if (nextFields.length > 0) {
    lines.push("次に確認したい項目:");
    lines.push(...nextFields.map((field) => `・${field}`));
  }
  return lines.join("\n");
}