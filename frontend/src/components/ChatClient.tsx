"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { createSession, callCoach } from "@/lib/api";

export default function ChatClient() {
  const [stage, setStage] = useState<"G" | "R" | "O" | "W">("G");

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        await createSession(idToken); // ← 引数の型と一致
      }
    });
    return () => unsub();
  }, []);

  // 送信時の例
  async function onSend(text: string) {
    const user = getAuth().currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    await callCoach(idToken, { message: text });
  }

  return (/* 既存のUI */ null);
}
