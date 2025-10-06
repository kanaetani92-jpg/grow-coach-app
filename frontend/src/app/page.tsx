"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "coach"; content: string; t?: number };
type CoachReply = {
  stage: "G" | "R" | "O" | "W" | "Wrap" | "Review";
  message: string;
  next_fields: string[];
};

const MAX_LEN = 5000;

export default function Home() {
  const [sessionId, setSessionId] = useState("");
  const [stage, setStage] = useState<CoachReply["stage"]>("G");
  const [history, setHistory] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: null }),
      });
      const j = await r.json();
      setSessionId(j.sessionId);
    })();
  }, []);
// 既存の useEffect（/api/sessions 作成）の前でも後でもOK
useEffect(() => {
  const uid = localStorage.getItem("uid") ?? crypto.randomUUID();
  localStorage.setItem("uid", uid);
}, []);
// セッション確定後に履歴を取得
useEffect(() => {
  const uid = localStorage.getItem("uid");
  if (!uid || !sessionId) return;

  (async () => {
    const r = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/api/history?uid=${uid}&sessionId=${sessionId}`
    );
    const j = await r.json();
    setHistory(j.messages as Msg[]);
  })();
}, [sessionId]);

  useEffect(() => {
    areaRef.current?.scrollTo({ top: areaRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  async function send() {
    const text = input.trim();
    if (!text || text.length > MAX_LEN) return;
    const now = Date.now();

    setHistory((h) => [...h, { role: "user", content: text, t: now }]);
    setInput("");

    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userText: text }),
      });
      const j: CoachReply = await r.json();
      setHistory((h) => [...h, { role: "coach", content: j.message, t: Date.now() }]);
      setStage(j.stage);
    } catch {
      setHistory((h) => [
        ...h,
        { role: "coach", content: "（バックエンド未起動のため応答できません）", t: Date.now() },
      ]);
    }
  }

  function keyHandler(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const over = input.length > MAX_LEN;

  const timefmt = (t?: number) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="mx-auto max-w-[720px] p-3 md:p-6 space-y-4">
      {/* Header */}
      <header className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow">
        <div className="px-5 py-4 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-extrabold">GROW Coaching</h1>
          <span className="inline-flex items-center gap-1 text-sm bg-white/15 rounded-full px-3 py-1">
            Stage:<b className="text-white">{stage}</b>
          </span>
        </div>
      </header>

      {/* Chat area */}
      <section className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="p-3 md:p-4 flex flex-col gap-3">
          <div ref={areaRef} className="h-[60vh] md:h-[66vh] overflow-y-auto space-y-3 pr-1">
            {history.length === 0 && (
              <div className="text-emerald-700/80 text-sm">
                ここに会話が表示されます。Shift+Enterで改行、Enterで送信できます。
              </div>
            )}

            {history.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={i}
                  className={[
                    "flex items-end gap-2",
                    isUser ? "justify-end" : "justify-start",
                  ].join(" ")}
                >
                  {/* 左側アバター（相手） */}
                  {!isUser && (
                    <div className="avatar avatar-coach select-none">AI</div>
                  )}

                  {/* 吹き出し */}
                  <div className={["bubble", isUser ? "bubble-user" : "bubble-coach"].join(" ")}>
                    {m.content}
                    <div className="msg-time mt-1 text-right">{timefmt(m.t)}</div>
                  </div>

                  {/* 右側アバター（自分） */}
                  {isUser && <div className="avatar avatar-user select-none">自</div>}
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-lg border border-emerald-300 bg-white px-3 py-2 md:px-4 md:py-2.5
                           text-emerald-950 placeholder-emerald-400 shadow-sm
                           focus-visible:outline-none focus:ring-4 ring-emerald-200"
                rows={3}
                maxLength={MAX_LEN}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={keyHandler}
                placeholder="メッセージを入力…（Shift+Enterで改行）"
                aria-label="メッセージ入力欄（最大5000文字）"
              />
              <button
                onClick={send}
                disabled={!input.trim() || over}
                className={[
                  "rounded-xl px-4 md:px-5 py-2 md:py-2.5 font-medium shadow-sm focus-visible:outline-none focus:ring-4",
                  !input.trim() || over
                    ? "bg-emerald-300 text-white cursor-not-allowed ring-emerald-200"
                    : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white ring-emerald-300",
                ].join(" ")}
              >
                送信
              </button>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className={over ? "text-red-600" : "text-emerald-700"}>
                {input.length} / {MAX_LEN}
              </span>
              <span className="text-emerald-600/80">Enterで送信・Shift+Enterで改行</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
