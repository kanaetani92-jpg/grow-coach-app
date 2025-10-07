"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ApiError, callCoach, createSession, fetchHistory } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { logEvent } from "@/lib/logger";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatClient() {
  const [authed, setAuthed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const tokenRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ===== 認証＆初回セッション作成 =====
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

      // 既存セッションを再利用
      const storedSessionId = window.localStorage.getItem("currentSessionId");
      if (storedSessionId) {
        setSessionId(storedSessionId);
        const storedStage = window.localStorage.getItem("currentSessionStage");
        setStage(storedStage);
        return;
      }

      // 新規セッション作成
      try {
        let token = idToken;
        const createWithToken = (value: string) => createSession(value);

        const session = await createWithToken(token).catch(async (error) => {
          if (error instanceof ApiError && error.status === 401 && auth.currentUser) {
            token = await auth.currentUser.getIdToken(true);
            tokenRef.current = token;
            return await createWithToken(token);
          }
          throw error;
        });

        setSessionId(session.sessionId);
        setStage(session.stage);
        window.localStorage.setItem("currentSessionId", session.sessionId);
        window.localStorage.setItem("currentSessionStage", session.stage);
      } catch (error) {
        const message = getErrorMessage(error);
        pushAssistant(`セッションの作成に失敗しました: ${message}`);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== メッセージ追加時は最下部へスクロール =====
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // ===== 履歴復元 =====
  useEffect(() => {
    if (!authed || !sessionId) return;

    let canceled = false;

    const restore = async () => {
      setRestoring(true);
      const fetchWithToken = async (token: string) => await fetchHistory(sessionId, token);

      try {
        const user = auth.currentUser;
        if (!user) throw new Error("ログイン情報を取得できませんでした。");

        let token = tokenRef.current ?? (await user.getIdToken());
        tokenRef.current = token;

        if (!token) throw new Error("ログイン情報を取得できませんでした。");

        const history = await fetchWithToken(token).catch(async (error) => {
          if (error instanceof ApiError && error.status === 401 && auth.currentUser) {
            token = await auth.currentUser.getIdToken(true);
            tokenRef.current = token;
            return await fetchWithToken(token);
          }
          throw error;
        });

        if (canceled) return;

        const restored = history.messages
          .map((m) => normalizeHistoryMessage(m, history.stage ?? null))
          .filter((m): m is Msg => m !== null);

        setMessages(restored);

        if (history.stage) {
          setStage(history.stage);
          window.localStorage.setItem("currentSessionStage", history.stage);
        }
      } catch (error) {
        if (canceled) return;

        // 履歴が無いときは新規セッション
        if (error instanceof ApiError && error.status === 404) {
          try {
            const user = auth.currentUser;
            if (!user) throw new Error("ログイン情報を取得できませんでした。");

            let token = tokenRef.current ?? (await user.getIdToken());
            tokenRef.current = token;

            if (!token) throw new Error("ログイン情報を取得できませんでした。");

            const session = await createSession(token);
            if (canceled) return;

            setSessionId(session.sessionId);
            setStage(session.stage);
            window.localStorage.setItem("currentSessionId", session.sessionId);
            window.localStorage.setItem("currentSessionStage", session.stage);
            pushAssistant("前回のセッションが見つからなかったため、新しいセッションを開始しました。");

            logEvent("session_created", {
              from: "history_restore_recovery",
              sessionId: session.sessionId,
              stage: session.stage,
            });
          } catch (creationError) {
            if (canceled) return;
            const message = getErrorMessage(creationError);
            setMessages([
              { role: "assistant", content: `前回のセッションが見つかりませんでした。新しいセッションの作成にも失敗しました: ${message}` },
            ]);
            logEvent("history_restore_failed", { sessionId, message: `recreate_failed:${message}` });
          }
        } else {
          const message = getErrorMessage(error);
          setMessages([{ role: "assistant", content: `履歴の取得に失敗しました: ${message}` }]);
          logEvent("history_restore_failed", { sessionId, message });
        }
      } finally {
        if (!canceled) setRestoring(false);
      }
    };

    void restore();
    return () => {
      canceled = true;
    };
  }, [authed, sessionId]);

  function pushAssistant(text: string) {
    setMessages((m) => [...m, { role: "assistant", content: text }]);
  }

  // ===== 送信 =====
  const onSend = async () => {
    const msg = input.trim();
    if (!msg || restoring) return;

    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);

    try {
      const idToken = tokenRef.current;
      if (!idToken) throw new Error("ログイン情報を取得できませんでした。");

      const activeSessionId = sessionId;
      if (!activeSessionId) throw new Error("セッションが見つかりませんでした。");

      const reply = await callCoach({ sessionId: activeSessionId, userText: msg }, idToken);

      setStage(reply.stage);
      window.localStorage.setItem("currentSessionStage", reply.stage);

      const assistantMessage = formatAssistantMessage(reply.message, reply.next_fields, reply.stage);
      pushAssistant(assistantMessage);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      pushAssistant(`エラー: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return <p className="text-sm opacity-80">ログインリンクでサインインするとチャットが有効になります。</p>;
  }

  return (
    <div className="flex h-[34rem] flex-col overflow-hidden rounded-[32px] border border-[#d1d7db] bg-[#f0f2f5] shadow-2xl shadow-black/30">
      {/* ヘッダー（固定） */}
      <header className="sticky top-0 z-10 bg-[var(--accent-strong)] px-6 py-4 text-[var(--ink)] shadow">
        <div className="mx-auto flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Grow Coach</p>
            <p className="text-xs text-white/80">コーチと会話を続けましょう</p>
          </div>
          <button
            className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium tracking-wide text-white transition hover:bg-white/25"
            onClick={() => signOut(auth)}
          >
            サインアウト
          </button>
        </div>

        {/* ステータス・バッジ */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/85">
          <span className="rounded-full bg-white/10 px-3 py-1 uppercase tracking-[0.18em]">ログイン済み</span>
          {stage && <span className="rounded-full bg-white/10 px-3 py-1">ステージ: {stage}</span>}
          {sessionId && <span className="rounded-full bg-white/10 px-3 py-1">セッションID: {sessionId}</span>}
        </div>
      </header>

      {/* 本文 */}
      <div className="flex flex-1 flex-col bg-[#f0f2f5]">
        <div ref={scrollerRef} className="chat-pattern flex-1 space-y-3 overflow-y-auto px-4 py-5">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="rounded-full bg-white/80 px-4 py-2 text-sm text-[#54656f] shadow">
                {restoring ? "会話履歴を読み込んでいます..." : "コーチに聞きたいことを入力してみましょう。"}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((message, index) => (
                <li
                  key={`${message.role}-${index}-${message.content.slice(0, 8)}`}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <span
                    className={`relative inline-block max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                      message.role === "user"
                        ? "bg-[#d9fdd3] text-[#111b21]" // user（右・ライトグリーン）
                        : "bg-white text-[#111b21] border" // assistant（左・白）
                    }`}
                  >
                    <span className="chat-text">{message.content}</span>
                  </span>
                </li>
              ))}
              {loading && (
                <li className="flex justify-start text-[#54656f]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs shadow">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#99aab5]" />
                    考え中…
                  </span>
                </li>
              )}
              <div ref={bottomRef} />
            </ul>
          )}
        </div>

        {/* 入力欄（下固定 + セーフエリア） */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="safe-bottom sticky bottom-0 border-t border-[#d1d7db] bg-white/90 px-4 py-3 backdrop-blur"
        >
          <div className="mx-auto flex items-center gap-3">
            <div className="flex-1 rounded-full border border-transparent bg-white px-4 py-2 text-sm text-[#111b21] shadow focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/30">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                className="w-full bg-transparent placeholder:text-[#667781] focus:outline-none"
                placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
                disabled={loading || restoring}
                aria-label="メッセージを入力"
              />
            </div>
            <button
              type="submit"
              disabled={loading || restoring || input.trim().length === 0}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/40 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ====== 履歴正規化 / 表示整形 ====== */
type HistoryMessage = {
  role: string;
  content: string;
  createdAt: number;
  stage?: string;
  next_fields?: string[];
};

function normalizeHistoryMessage(message: HistoryMessage, fallbackStage: string | null): Msg | null {
  if (message.role === "user" && typeof message.content === "string") {
    return { role: "user", content: message.content };
  }
  if (message.role === "coach" && typeof message.content === "string") {
    const fields = Array.isArray(message.next_fields)
      ? message.next_fields.filter((x): x is string => typeof x === "string")
      : [];
    const stage = typeof message.stage === "string" && message.stage ? message.stage : fallbackStage ?? "G";
    return { role: "assistant", content: formatAssistantMessage(message.content, fields, stage) };
  }
  return null;
}

function formatAssistantMessage(message: string, nextFields: string[], stage: string): string {
  const lines: string[] = [];
  lines.push(`【ステージ: ${stage}】${message}`);
  if (nextFields.length > 0) {
    lines.push("次に確認したい項目:");
    lines.push(...nextFields.map((f) => `・${f}`));
  }
  return lines.join("\n");
}
