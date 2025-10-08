"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ApiError, callCoach, createSession, fetchHistory, type HistoryMessage } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { logEvent } from "@/lib/logger";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: "sending" | "sent" | "read" | "error";
};

export default function ChatClient() {
  const [authed, setAuthed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const tokenRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userInitial = useMemo(() => {
    if (!userName) return "U";
    const firstChar = userName.trim()[0];
    if (!firstChar) return "U";
    return firstChar.toUpperCase();
  }, [userName]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // ===== 認証＆初回セッション作成 =====
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthed(false);
        setSessionId(null);
        tokenRef.current = null;
        setUserName(null);
        window.localStorage.removeItem("currentSessionId");
        window.localStorage.removeItem("currentSessionStage");
        return;
      }

      setAuthed(true);
      setUserName(user.displayName || user.email || "サインイン済み");
      const idToken = await user.getIdToken();
      tokenRef.current = idToken;

      // 既存セッションを再利用
      const storedSessionId = window.localStorage.getItem("currentSessionId");
      if (storedSessionId) {
        setSessionId(storedSessionId);
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
        window.localStorage.setItem("currentSessionId", session.sessionId);
        window.localStorage.setItem("currentSessionStage", session.stage);
      } catch (error) {
        const message = getErrorMessage(error);
        pushAssistant(`セッションの作成に失敗しました: ${message}`);
      }
    });
    return () => unsub();
    
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
          .map((m) => normalizeHistoryMessage(m))
          .filter((m): m is Msg => m !== null);

        setMessages(restored);

        if (history.stage) {
          window.localStorage.setItem("currentSessionStage", history.stage);
        } else {
          window.localStorage.removeItem("currentSessionStage");
        }
      } catch (error) {
        if (canceled) return;

        // 履歴が無いときは新規セッション
        if (error instanceof ApiError && error.status === 404) {
          try {
            const user = auth.currentUser;
            if (!user) throw new Error("ログイン情報を取得できませんでした。");

            const token = tokenRef.current ?? (await user.getIdToken());
            tokenRef.current = token;

            if (!token) throw new Error("ログイン情報を取得できませんでした。");

            const session = await createSession(token);
            if (canceled) return;

            setSessionId(session.sessionId);
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
              {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: `前回のセッションが見つかりませんでした。新しいセッションの作成にも失敗しました: ${message}`,
                createdAt: Date.now(),
              },
            ]);
            logEvent("history_restore_failed", { sessionId, message: `recreate_failed:${message}` });
          }
        } else {
          const message = getErrorMessage(error);
          setMessages([
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: `履歴の取得に失敗しました: ${message}`,
              createdAt: Date.now(),
            },
          ]);
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

  const quickActions = useMemo(
    () => ["今日のテーマを選ぶ", "目標を設定", "最近の出来事を振り返る"],
    [],
  );

  function pushAssistant(text: string, createdAt?: number) {
    setMessages((prev) => {
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      if (lastIndex >= 0 && updated[lastIndex]?.role === "user" && updated[lastIndex].status !== "error") {
        updated[lastIndex] = { ...updated[lastIndex], status: "read" };
      }
      return [
        ...updated,
        {
          id: `assistant-${createdAt ?? Date.now()}`,
          role: "assistant",
          content: text,
          createdAt: createdAt ?? Date.now(),
        },
      ];
    });
  }

  // ===== 送信 =====
  const onSend = async () => {
    const msg = input.trim();
    if (!msg || restoring) return;

    const timestamp = Date.now();
    const messageId = `user-${timestamp}`;
    setMessages((m) => [
      ...m,
      {
        id: messageId,
        role: "user",
        content: msg,
        createdAt: timestamp,
        status: "sending",
      },
    ]);
    setInput("");
    setLoading(true);

    try {
      const idToken = tokenRef.current;
      if (!idToken) throw new Error("ログイン情報を取得できませんでした。");

      const activeSessionId = sessionId;
      if (!activeSessionId) throw new Error("セッションが見つかりませんでした。");

      const reply = await callCoach({ sessionId: activeSessionId, userText: msg }, idToken);

      window.localStorage.setItem("currentSessionStage", reply.stage);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId && message.status !== "error"
            ? { ...message, status: "sent" }
            : message,
        ),
      );

      const assistantMessage = formatAssistantMessage(reply.message, reply.next_fields);
      pushAssistant(assistantMessage);
      showToast("success", "メッセージを送信しました。");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "error" } : m)),
      );
      pushAssistant(`エラー: ${message}`);
      showToast("error", "メッセージの送信に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return <p className="text-sm opacity-80">ログインリンクでサインインするとチャットが有効になります。</p>;
  }

  return (
    <div className="relative flex h-[34rem] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white text-base text-slate-900 shadow-2xl shadow-slate-900/20">
      {/* ヘッダー（固定） */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-8 py-5 backdrop-blur">
        <div>
          <p className="text-xl font-semibold tracking-tight text-slate-900">Grow Coach</p>
          <p className="text-sm text-slate-500">コーチと一緒に次のアクションを決めましょう</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-sm text-slate-500 sm:block">{userName ?? "サインイン済み"}</div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="text-lg leading-none">⎋</span>
            ログアウト
          </button>
        </div>
      </header>

      {/* 本文 */}
      <div className="flex flex-1 flex-col bg-slate-50/80">
        <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center text-slate-600">
              <p className="rounded-2xl bg-white px-5 py-3 text-base shadow-sm">
                {restoring ? "会話履歴を読み込んでいます..." : "コーチに相談したい内容を入力して会話を始めましょう。"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      setInput(action);
                      showToast("success", `${action} を入力欄にセットしました。`);
                    }}
                    className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((message) => (
                <li key={message.id} className="flex items-end gap-3">
                  {message.role === "assistant" && (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white shadow-sm">
                      GC
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] rounded-3xl px-5 py-3 shadow-sm ${
                      message.role === "user"
                        ? "ml-auto bg-emerald-50 text-emerald-900"
                        : "bg-white text-slate-900 border border-slate-200"
                    }`}
                  >
                    <p className="chat-text text-[15px] leading-relaxed">{message.content}</p>
                    <div
                      className={`mt-2 flex items-center gap-2 text-[11px] ${
                        message.role === "user" ? "justify-end text-emerald-900/70" : "justify-start text-slate-500"
                      }`}
                    >
                      <span>{formatTimestamp(message.createdAt)}</span>
                      {message.role === "user" && (
                        <span>
                          {message.status === "error"
                            ? "エラー"
                            : message.status === "read"
                              ? "既読"
                              : message.status === "sent"
                                ? "送信済み"
                                : "送信中"}
                        </span>
                      )}
                    </div>
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white shadow-sm">
                      {userInitial}
                    </div>
                  )}
                </li>
              ))}
              {loading && (
                <li className="flex items-center gap-3 text-slate-500">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white shadow-sm">
                    GC
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm shadow-sm">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
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
          className="safe-bottom sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  className="w-full bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  placeholder="メッセージを入力"
                  disabled={loading || restoring}
                  aria-label="メッセージを入力"
                />
              </div>
              <button
                type="submit"
                disabled={loading || restoring || input.trim().length === 0}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "送信中" : "送信"}
              </button>
            </div>
            <p className="text-xs text-slate-500">Enterで送信／Shift + Enterで改行</p>
          </div>
        </form>
      </div>

      {toast && (
        <div
          role="status"
          className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ====== 履歴正規化 / 表示整形 ====== */
function normalizeHistoryMessage(message: HistoryMessage): Msg | null {
  if (message.role === "user" && typeof message.content === "string") {
    return {
      id: `user-${message.createdAt}`,
      role: "user",
      content: message.content,
      createdAt: message.createdAt,
      status: "read",
    };
  }
  if (message.role === "coach" && typeof message.content === "string") {
    const fields = Array.isArray(message.next_fields)
      ? message.next_fields.filter((x): x is string => typeof x === "string")
      : [];
    return {
      id: `assistant-${message.createdAt}`,
      role: "assistant",
      content: formatAssistantMessage(message.content, fields),
      createdAt: message.createdAt,
    };
  }
  return null;
}

function formatAssistantMessage(message: string, nextFields: string[]): string {
  const lines: string[] = [];
  lines.push(message);
  if (nextFields.length > 0) {
    lines.push("次に確認したい項目:");
    lines.push(...nextFields.map((f) => `・${f}`));
  }
  return lines.join("\n");
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}