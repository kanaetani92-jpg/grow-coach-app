"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { createSession, callCoach } from "@/lib/api";

export default function ChatClient() {
  const [stage, setStage] = useState<"G"|"R"|"O"|"W">("G");
  const [input, setInput] = useState("");

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        await createSession(idToken); // ← Authorization ヘッダーでPOST
      }
    });
    return () => unsub();
  }, []);

  return (
    <div>
      {/* ここに既存のUI・送信処理(callCoachなど)を移植 */}
      {/* 例： */}
      <div>Stage:{stage}</div>
      <input value={input} onChange={(e)=>setInput(e.target.value)} />
    </div>
  );
}
