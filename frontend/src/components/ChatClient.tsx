"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  ApiError,
  callCoach,
  createSession,
  fetchHistory,
  listSessions,
  type HistoryMessage,
  type SessionSummary,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { logEvent } from "@/lib/logger";

const HISTORY_PAGE_SIZE = 25;
const MAX_MESSAGE_LENGTH = 5000;
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: "sending" | "sent" | "read" | "error";
};

type ToastState = { type: "success" | "error"; message: string } | null;

export default function ChatClient() {
  const [authed, setAuthed] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.navigator.onLine,
  );
  const tokenRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollToBottom = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, []);

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


    useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStatus = () => {
      setIsOnline(window.navigator.onLine);
    };

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  const callWithAuth = useCallback(async <T,>(callback: (token: string) => Promise<T>): Promise<T> => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("ログイン情報を取得できませんでした。");
    }

    let token = tokenRef.current ?? (await user.getIdToken());
    tokenRef.current = token;

    try {
      return await callback(token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && auth.currentUser) {
        token = await auth.currentUser.getIdToken(true);
        tokenRef.current = token;
        return await callback(token);
      }
      throw error;
    }
  }, []);

  const updateSessionMeta = useCallback((id: string, updates: Partial<SessionSummary>) => {
    setSessions((prev) => {
      const mapped = prev.map((session) =>
        session.sessionId === id ? { ...session, ...updates } : session,
      );
      if (updates.updatedAt !== undefined) {
        return [...mapped].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      }
      return mapped;
    });
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!authed) return;
    setSessionsLoading(true);
    setSessionError(null);
    try {
            if (!isOnline) {
        throw new Error(
          "オフラインのためセッションを取得できません。接続を確認して再試行してください。",
        );
      }
      const { sessions: fetched } = await callWithAuth((token) => listSessions(token));
      const ordered = [...fetched].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      setSessions(ordered);

      const storedId = typeof window !== "undefined"
        ? window.localStorage.getItem("currentSessionId")
        : null;
      const candidates: Array<string | null> = [
        sessionIdRef.current,
        storedId,
        ordered[0]?.sessionId ?? null,
      ];
      let nextId: string | null = null;
      for (const candidate of candidates) {
        if (candidate && ordered.some((item) => item.sessionId === candidate)) {
          nextId = candidate;
          break;
        }
      }

      if (!nextId) {
        const created = await callWithAuth((token) => createSession(token));
        const now = Date.now();
        const newSession: SessionSummary = {
          sessionId: created.sessionId,
          stage: created.stage,
          createdAt: now,
          updatedAt: now,
        };
        setSessions((prev) => [newSession, ...prev]);
        window.localStorage.setItem("currentSessionId", created.sessionId);
        window.localStorage.setItem("currentSessionStage", created.stage);
        logEvent("session_created", {
          from: "auto_create",
          sessionId: created.sessionId,
          stage: created.stage,
        });
        nextId = created.sessionId;
      }

      if (nextId) {
        window.localStorage.setItem("currentSessionId", nextId);
        if (nextId !== sessionIdRef.current) {
          setSessionId(nextId);
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setSessionError(message);
      showToast("error", message);
    } finally {
      setSessionsLoading(false);
    }
    }, [authed, callWithAuth, showToast, isOnline]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthed(false);
        setSessionId(null);
        sessionIdRef.current = null;
        setSessions([]);
        setMessages([]);
        setInput("");
        setUserName(null);
        setHistoryCursor(null);
        setHistoryHasMore(false);
        setSessionError(null);
        tokenRef.current = null;
        window.localStorage.removeItem("currentSessionId");
        window.localStorage.removeItem("currentSessionStage");
        return;
      }

      setAuthed(true);
      setUserName(user.displayName || user.email || "サインイン済み");
      const idToken = await user.getIdToken();
      tokenRef.current = idToken;
      await refreshSessions();
    });

    return () => unsub();
  }, [refreshSessions]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const pushAssistant = useCallback((text: string, createdAt?: number) => {
    shouldAutoScrollRef.current = true;
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
  }, []);

  useEffect(() => {
    if (!authed || !sessionId) return;

    let canceled = false;
    shouldAutoScrollRef.current = true;
    setMessages([]);
    setHistoryHasMore(false);
    setHistoryCursor(null);

    const restore = async () => {
      setRestoring(true);
      try {
        const history = await callWithAuth((token) =>
          fetchHistory(sessionId, token, { limit: HISTORY_PAGE_SIZE }),
        );
        if (canceled) return;

        const restored = history.messages
          .map((m) => normalizeHistoryMessage(m))
          .filter((m): m is Msg => m !== null);

        setMessages(restored);
        setHistoryHasMore(Boolean(history.hasMore));
        setHistoryCursor(history.cursor ?? null);

        if (history.stage) {
          window.localStorage.setItem("currentSessionStage", history.stage);
          updateSessionMeta(sessionId, { stage: history.stage });
        } else {
          window.localStorage.removeItem("currentSessionStage");
        }
      } catch (error) {
        if (canceled) return;

        if (error instanceof ApiError && error.status === 404) {
          try {
            const created = await callWithAuth((token) => createSession(token));
            if (canceled) return;
            const now = Date.now();
            const newSession: SessionSummary = {
              sessionId: created.sessionId,
              stage: created.stage,
              createdAt: now,
              updatedAt: now,
            };
            setSessions((prev) => [newSession, ...prev.filter((s) => s.sessionId !== sessionId)]);
            window.localStorage.setItem("currentSessionId", created.sessionId);
            window.localStorage.setItem("currentSessionStage", created.stage);
            setSessionId(created.sessionId);
            pushAssistant("前回のセッションが見つからなかったため、新しいセッションを開始しました。");
            logEvent("session_created", {
              from: "history_restore_recovery",
              sessionId: created.sessionId,
              stage: created.stage,
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
            logEvent("history_restore_failed", {
              sessionId,
              message: `recreate_failed:${message}`,
            });
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
  }, [authed, sessionId, callWithAuth, pushAssistant, updateSessionMeta]);

  const loadOlderMessages = useCallback(async () => {
    if (!sessionId || !historyHasMore || historyCursor === null || loadingMore || restoring) {
      return;
    }

    const scroller = scrollerRef.current;
    const prevScrollHeight = scroller?.scrollHeight ?? 0;
    const prevScrollTop = scroller?.scrollTop ?? 0;

    shouldAutoScrollRef.current = false;
    setLoadingMore(true);

    try {
      const history = await callWithAuth((token) =>
        fetchHistory(sessionId, token, { limit: HISTORY_PAGE_SIZE, before: historyCursor }),
      );
      const older = history.messages
        .map((m) => normalizeHistoryMessage(m))
        .filter((m): m is Msg => m !== null);

      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setHistoryCursor(history.cursor ?? null);
        setHistoryHasMore(Boolean(history.hasMore));
        requestAnimationFrame(() => {
          const el = scrollerRef.current;
          if (!el) return;
          const newScrollHeight = el.scrollHeight;
          el.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        });
      } else {
        setHistoryHasMore(false);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      showToast("error", `履歴の取得に失敗しました: ${message}`);
    } finally {
      requestAnimationFrame(() => {
        shouldAutoScrollRef.current = true;
      });
      setLoadingMore(false);
    }
  }, [sessionId, historyHasMore, historyCursor, loadingMore, restoring, callWithAuth, showToast]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (el.scrollTop <= 80 && historyHasMore && !loadingMore && !restoring) {
        void loadOlderMessages();
      }
    };

    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [historyHasMore, loadingMore, restoring, loadOlderMessages]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (!id) return;
      if (id === sessionIdRef.current) return;
      window.localStorage.setItem("currentSessionId", id);
      const meta = sessions.find((s) => s.sessionId === id);
      if (meta?.stage) {
        window.localStorage.setItem("currentSessionStage", meta.stage);
      }
      setSessionId(id);
    },
    [sessions],
  );

  const handleCreateSession = useCallback(async () => {
    if (creatingSession) return;
    if (!isOnline) {
      showToast("error", "オフラインのため新しいセッションを作成できません。接続を確認してください。");
      return;
    }
    setCreatingSession(true);
    try {
      const created = await callWithAuth((token) => createSession(token));
      const now = Date.now();
      const newSession: SessionSummary = {
        sessionId: created.sessionId,
        stage: created.stage,
        createdAt: now,
        updatedAt: now,
      };
      setSessions((prev) => [newSession, ...prev]);
      window.localStorage.setItem("currentSessionId", created.sessionId);
      window.localStorage.setItem("currentSessionStage", created.stage);
      setSessionId(created.sessionId);
      setMessages([]);
      setHistoryHasMore(false);
      setHistoryCursor(null);
      shouldAutoScrollRef.current = true;
      logEvent("session_created", {
        from: "user_action",
        sessionId: created.sessionId,
        stage: created.stage,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      showToast("error", `新しいセッションの作成に失敗しました: ${message}`);
    } finally {
      setCreatingSession(false);
    }
  }, [callWithAuth, showToast, creatingSession, isOnline]);

  const activeSessionId = sessionIdRef.current;
  const sessionSelectValue = useMemo(() => {
    if (!activeSessionId) return "";
    return sessions.some((session) => session.sessionId === activeSessionId) ? activeSessionId : "";
  }, [activeSessionId, sessions]);
  const quickActions = useMemo(
    () => ["今日のテーマを選ぶ", "目標を設定", "最近の出来事を振り返る"],
    [],
  );
  const remainingChars = useMemo(
    () => Math.max(0, MAX_MESSAGE_LENGTH - input.length),
    [input],
  );

  const onSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || restoring) return;
    if (msg.length > MAX_MESSAGE_LENGTH) {
      showToast("error", "メッセージは5000文字以内で入力してください。");
      return;
    }

    const timestamp = Date.now();
    const messageId = `user-${timestamp}`;
    shouldAutoScrollRef.current = true;
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
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) throw new Error("セッションが見つかりませんでした。");

      const reply = await callWithAuth((token) =>
        callCoach({ sessionId: activeSessionId, userText: msg }, token),
      );

      window.localStorage.setItem("currentSessionStage", reply.stage);
      updateSessionMeta(activeSessionId, { stage: reply.stage, updatedAt: Date.now() });

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId && message.status !== "error"
            ? { ...message, status: "sent" }
            : message,
        ),
      );

      const assistantMessage = formatAssistantMessage(reply.message, reply.next_fields);
      showToast("success", "メッセージを送信しました。");
            pushAssistant(assistantMessage);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "error" } : m)),
      )
      console.error("メッセージ送信に失敗しました", { error, message });
      pushAssistant("メッセージの処理に失敗しました。時間をおいて再試行してください。");
      showToast("error", "メッセージの送信に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }, [callWithAuth, pushAssistant, restoring, showToast, updateSessionMeta, input]);

  if (!authed) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 text-center">
          <p className="text-base font-medium text-slate-800">
            サインインするとセッションの一覧とチャットが表示されます。
          </p>
          <p className="text-sm text-slate-600">
            左側のカードからメールリンクを送信し、ログインを完了してください。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-[34rem] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-base text-slate-900 shadow-sm max-h-[calc(100vh-160px)]">
      <header className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold text-slate-900">Grow Coach</p>
              <p className="mt-1 text-sm text-slate-600">コーチと一緒に次のアクションを決めましょう。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreateSession}
                className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="新規セッションを開始"
                disabled={creatingSession}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ＋
                </span>
                新規セッション
              </button>
              <div className="hidden text-sm text-slate-500 sm:block" aria-live="polite">
                {userName ?? "サインイン済み"}
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                aria-label="ログアウト"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ⎋
                </span>
                ログアウト
              </button>
            </div>
          </div>
          {!isOnline && (
            <div
              className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700"
              role="status"
              aria-live="polite"
            >
              オフラインです。接続が回復すると自動的に再同期します。
            </div>
          )}
        </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          <aside className="flex min-h-0 w-full flex-shrink-0 flex-col border-b border-slate-200 bg-slate-50/80 sm:w-72 sm:border-b-0 sm:border-r sm:bg-white">
            <div className="space-y-4 px-5 py-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">セッション</h2>
                <p className="text-xs text-slate-500">過去のやり取りを一覧で確認できます。</p>
              </div>
              {!sessionsLoading && !sessionError && sessions.length > 0 ? (
                <div>
                  <label htmlFor="session-select" className="mb-1 block text-xs font-medium text-slate-500">
                    過去のセッションを選択
                  </label>
                  <div className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                    <select
                      id="session-select"
                      value={sessionSelectValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value) {
                          handleSelectSession(value);
                        }
                      }}
                      className="w-full bg-transparent text-sm text-slate-900 focus:outline-none"
                      aria-label="セッションを選択"
                    >
                      <option value="" disabled>
                        セッションを選択
                      </option>
                      {sessions.map((session) => {
                        const label = formatSessionLabel(session);
                        const stageLabel = `ステージ: ${session.stage ?? "-"}`;
                        const relative = formatRelativeTime(session.updatedAt ?? session.createdAt);
                        return (
                          <option key={session.sessionId} value={session.sessionId}>
                            {`${label} ｜ ${stageLabel} ｜ ${relative}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
            {/* 過去のセッション一覧はプルダウンのみ表示する仕様に変更したため非表示 */}
          </aside>
          <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
            <div
              ref={scrollerRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6"
            >
              {historyHasMore ? (
                <div className="flex justify-center text-xs text-slate-500" aria-live="polite">
                  {loadingMore ? "過去のメッセージを読み込んでいます..." : "上にスクロールするとさらに表示されます"}
                </div>
              ) : null}
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-6 text-center text-slate-600">
                  <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base shadow-sm">
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
                        className="rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-700 transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="space-y-4" aria-live="polite">
                  {messages.map((message) => (
                    <li key={message.id} className="flex items-end gap-3">
                      {message.role === "assistant" && (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white shadow-sm">
                          GC
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-3xl px-5 py-3 shadow-sm ${
                          message.role === "user"
                            ? "ml-auto bg-teal-600 text-white"
                            : "border border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        <p className="chat-text text-[15px] leading-relaxed">{message.content}</p>
                        <div
                          className={`mt-2 flex items-center gap-2 text-[11px] ${
                            message.role === "user"
                              ? "justify-end text-white/80"
                              : "justify-start text-slate-500"
                          }`}
                        >
                          <span>{formatTimestamp(message.createdAt)}</span>
                          {message.role === "user" && (
                            <span>
                              {message.status === "error"
                                ? "エラー"
                                : message.status === "read" || message.status === "sent"
                                  ? "送信済"
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
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white shadow-sm">
                        GC
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" />
                        考え中…
                      </span>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSend();
              }}
              className="safe-bottom sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
                    <label htmlFor="chat-input" className="sr-only">
                      メッセージを入力
                    </label>
                    <textarea
                      id="chat-input"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          onSend();
                        }
                      }}
                      className="h-24 w-full resize-none bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      placeholder="メッセージを入力"
                      disabled={loading || restoring}
                      aria-label="メッセージを入力"
                      maxLength={MAX_MESSAGE_LENGTH}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || restoring || input.trim().length === 0}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/30 transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="メッセージを送信"
                  >
                    {loading ? "送信中" : "送信"}
                  </button>
                </div>
                <p className="text-xs text-slate-500" aria-live="polite">
                  Enterで送信／Shift + Enterで改行（最大5000文字・残り
                  {remainingChars.toLocaleString()}文字）
                </p>
              </div>
            </form>
          </div>
        </div>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg ${
            toast.type === "success"
              ? "bg-teal-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}

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

const NEXT_FIELD_LABELS: Record<string, string> = {
  Goal_Specific_Description: "目標の具体的なイメージ",
  Goal_Measurable_Timeline: "達成時期・数値目標",
  Goal_Motivation: "この目標に取り組む理由",
  Goal_Priority: "重要度・優先順位",
  Reality_Current_Status: "現在の状況・進捗",
  Reality_Challenges: "直面している課題",
  Reality_Resources: "活用できる資源・強み",
  Reality_Emotions: "感じている気持ち",
  Options_Possibilities: "考えられる選択肢",
  Options_ProsCons: "各選択肢のメリット・デメリット",
  Options_Support: "得られそうな支援・協力",
  Options_Criteria: "選ぶ際の判断基準",
  Will_Action_Steps: "具体的な次の一歩",
  Will_Commitment_Level: "実行へのコミット度合い",
  Will_Obstacles_Plan: "想定される障害と対策",
  Will_Accountability: "フォローアップの方法",
  Wrap_Key_Takeaways: "今日の気づき・学び",
  Wrap_Next_Steps: "次回までの約束・行動",
  Wrap_Appreciation: "感謝したいこと・良かった点",
  Wrap_Encouragement: "励まし・応援メッセージ",
  Review_Progress: "前回からの進捗",
  Review_Learnings: "得られた学び",
  Review_Adjustments: "必要な見直し・調整",
  Review_Celebrations: "称えたい成果",
};

const STAGE_LABELS: Record<string, string> = {
  Goal: "ゴール",
  Reality: "現状",
  Options: "選択肢",
  Will: "行動計画",
  Wrap: "振り返り",
  Review: "レビュー",
};

function formatNextFieldLabel(field: string): string {
  const known = NEXT_FIELD_LABELS[field];
  if (known) return known;

  const segments = field.split("_").filter(Boolean);
  if (segments.length === 0) {
    return field;
  }

  const [stage, ...rest] = segments;
  const stageLabel = STAGE_LABELS[stage] ?? stage;
  if (rest.length === 0) {
    return stageLabel || field;
  }

  const restLabel = rest
    .map((part) =>
      part
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase()),
    )
    .join("・");

  if (stageLabel) {
    return `${stageLabel}：${restLabel}`;
  }

  return restLabel || field;
}

const TRAILING_CLOSERS = new Set([
  "'",
  "\"",
  "’",
  "”",
  "）",
  ")",
  "］",
  "]",
  "｝",
  "}",
  "〉",
  "》",
  "】",
  "」",
  "』",
]);

function trimTrailingClosers(value: string): string {
  let end = value.length;
  while (end > 0 && TRAILING_CLOSERS.has(value[end - 1])) {
    end -= 1;
  }
  return value.slice(0, end);
}

function shouldDisplayNextFields(message: string, nextFields: string[]): boolean {
  if (nextFields.length === 0) {
    return false;
  }
  const trimmed = message.trim();
  if (!trimmed) {
    return false;
  }

  const withoutClosers = trimTrailingClosers(trimmed);
  if (!withoutClosers) {
    return false;
  }

  const lastChar = withoutClosers.charAt(withoutClosers.length - 1);
  if (lastChar === "?" || lastChar === "？") {
    return false;
  }

  return true;
}

function formatAssistantMessage(message: string, nextFields: string[]): string {
  const lines: string[] = [];
  lines.push(message);
  if (shouldDisplayNextFields(message, nextFields)) {
    lines.push("次に確認したい項目:");
    lines.push(...nextFields.map((field) => `・${formatNextFieldLabel(field)}`));
  }
  return lines.join("\n");
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatSessionLabel(session: SessionSummary): string {
  const timestamp = session.updatedAt ?? session.createdAt;
  if (!timestamp) {
    return "未記録のセッション";
  }
  const date = new Date(timestamp);
  const day = date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
  const time = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return "--";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "たった今";
  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000);
    return `${minutes}分前`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours}時間前`;
  }
  const date = new Date(timestamp);
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}