import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { createSession, callCoach } from "@/lib/api";

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("G");
  const [input, setInput] = useState("");

  // ログインが確認できたら最初にセッション作成
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return; // まだ未ログイン
      if (sessionId) return; // 作成済み

      try {
        const s = await createSession(); // ← Authorization 付きで呼ばれる
        setSessionId(s.sessionId);
        setStage(s.stage);
      } catch (e) {
        console.error(e);
        alert("セッション作成に失敗しました");
      }
    });
    return () => unsub();
  }, [sessionId]);

  const send = async () => {
    if (!sessionId) {
      alert("セッション未作成（ログイン後に自動作成されます）");
      return;
    }
    const text = input.trim();
    if (!text) return;

    try {
      const res = await callCoach(sessionId, text); // ← Authorization 付き
      setStage(res.stage);
      // res.message をメッセージ一覧に追加するなど
    } catch (e) {
      console.error(e);
      alert("送信に失敗しました");
    } finally {
      setInput("");
    }
  };

  return (
    <>
      <div>Stage: {stage}</div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={send}>送信</button>
    </>
  );
}
