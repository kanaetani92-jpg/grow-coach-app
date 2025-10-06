"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createSession, callCoach } from "@/lib/api";


// ... 以降は今の実装でOK（onAuthStateChanged 内で idToken→createSession）


export default function ChatClient() {
  const [stage, setStage] = useState<"G" | "R" | "O" | "W">("G");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth(), async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        await createSession(idToken); // ← 引数の型と一致
      }
    });
    return () => unsub();
  }, []);

  // 送信時の例
  async function onSend(text: string) {
    const user = あuth().currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    await callCoach(idToken, { message: text });
  }

  return (/* 既存のUI */ null);
}
