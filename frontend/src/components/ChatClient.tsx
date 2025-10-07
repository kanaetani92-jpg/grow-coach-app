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

  useEffect(() => {
    if (!authed || !sessionId) {
      return;
    }

    let canceled = false;

    const restore = async () => {
      setRestoring(true);

      const fetchWithToken = async (token: string) =>
        await fetchHistory(sessionId, token);

      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("ログイン情報を取得できませんでした。");
        }

        let initialToken = tokenRef.current;
        if (!initialToken) {
          initialToken = await user.getIdToken();
          tokenRef.current = initialToken;
        }

        if (!initialToken) {
          throw new Error("ログイン情報を取得できませんでした。");
        }

        let token = initialToken;
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
          .map((message) => normalizeHistoryMessage(message, history.stage ?? null))
          .filter((message): message is Msg => message !== null);

        setMessages(restored);

        if (history.stage) {
          setStage(history.stage);
          window.localStorage.setItem("currentSessionStage", history.stage);
        }
      } catch (error) {
        if (canceled) return;

        if (error instanceof ApiError && error.status === 404) {
          try {
            const user = auth.currentUser;
            if (!user) {
              throw new Error("ログイン情報を取得できませんでした。");
            }

            let token = tokenRef.current;
            if (!token) {
              token = await user.getIdToken();
              tokenRef.current = token;
            }

            if (!token) {
              throw new Error("ログイン情報を取得できませんでした。");
            }

            const createWithToken = async (value: string) => createSession(value);
            const session = await createWithToken(token).catch(async (creationError) => {
              if (
                creationError instanceof ApiError &&
                creationError.status === 401 &&
                auth.currentUser
              ) {
                token = await auth.currentUser.getIdToken(true);
                tokenRef.current = token;
                return await createWithToken(token);
              }
              throw creationError;
            });

            if (canceled) return;

            setSessionId(session.sessionId);
            setStage(session.stage);
            window.localStorage.setItem("currentSessionId", session.sessionId);
            window.localStorage.setItem("currentSessionStage", session.stage);
            setMessages([
              {
                role: "assistant",
                content: "前回のセッションが見つからなかったため、新しいセッションを開始しました。",
              },
            ]);
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
                role: "assistant",
                content: `前回のセッションが見つかりませんでした。新しいセッションの作成にも失敗しました: ${message}`,
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
              role: "assistant",
              content: `履歴の取得に失敗しました: ${message}`,
            },
          ]);
          logEvent("history_restore_failed", { sessionId, message });
        }
      } finally {
        if (!canceled) {
          setRestoring(false);
        }
      }
    };

    void restore();

    return () => {
      canceled = true;
    };
  }, [authed, sessionId]);

  const onSend = async () => {
    const msg = input.trim();
    if (!msg || restoring) return;
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
      const assistantMessage = formatAssistantMessage(
        reply.message,
        reply.next_fields,
        reply.stage
      );
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
    <div className="flex h-[34rem] flex-col overflow-hidden rounded-[32px] border border-[#d1d7db] bg-[#f0f2f5] shadow-2xl shadow-black/30">
      <header className="bg-[#075e54] px-6 py-4 text-white shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Grow Coach</p>
            <p className="text-xs text-white/70">コーチと会話を続けましょう</p>
          </div>
          <button
            className="rounded-full bg-white/15 px-4 py-2 text-xs font-medium tracking-wide text-white transition hover:bg-white/25"
            onClick={() => signOut(auth)}
          >
            サインアウト
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
          <span>ログイン済み</span>
          {stage && <span>Stage: {stage}</span>}
          {sessionId && <span>ID: {sessionId}</span>}
        </div>
      </header>

      <div className="flex flex-1 flex-col bg-[#f0f2f5]">
        <div
          ref={scrollRef}
          className="chat-pattern flex-1 space-y-3 overflow-y-auto px-4 py-5"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="rounded-full bg-white/80 px-4 py-2 text-sm text-[#54656f] shadow">
                {restoring
                  ? "会話履歴を読み込んでいます..."
                  : "コーチに聞きたいことを入力してみましょう。"}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
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
                    className={`relative inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm ${
                      message.role === "user"
                        ? "bg-[#d9fdd3] text-[#111b21]"
                        : "bg-white text-[#111b21]"
                    }`}
                  >
                    <span className="block whitespace-pre-wrap break-words">
                      {message.content}
                    </span>
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
          className="border-t border-[#d1d7db] bg-[#f0f2f5]/90 px-4 py-4 backdrop-blur"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full border border-transparent bg-white px-4 py-3 text-sm text-[#111b21] shadow focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/30">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="w-full bg-transparent placeholder:text-[#667781] focus:outline-none"
                placeholder="メッセージを入力"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || restoring || input.trim().length === 0}
              className="rounded-full bg-[#00a884] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/40 transition hover:bg-[#02926f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type HistoryMessage = {
  role: string;
  content: string;
  createdAt: number;
  stage?: string;
  next_fields?: string[];
};

function normalizeHistoryMessage(
  message: HistoryMessage,
  fallbackStage: string | null
): Msg | null {
  if (message.role === "user" && typeof message.content === "string") {
    return { role: "user", content: message.content };
  }

  if (message.role === "coach" && typeof message.content === "string") {
    const fields = Array.isArray(message.next_fields)
      ? message.next_fields.filter((item): item is string => typeof item === "string")
      : [];
    const stage =
      typeof message.stage === "string" && message.stage
        ? message.stage
        : fallbackStage ?? "G";
    return {
      role: "assistant",
      content: formatAssistantMessage(message.content, fields, stage),
    };
  }

  return null;
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
