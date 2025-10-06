"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createSession, callCoach } from "@/lib/api";

export default function ChatClient() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        await createSession(idToken);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div>
      <h1>Grow Coach</h1>
      {/* UI はここに */}
    </div>
  );
}
