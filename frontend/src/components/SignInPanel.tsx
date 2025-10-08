"use client";

import { useEffect, useState } from "react";

import EmailLinkForm from "@/components/EmailLinkForm";
import { auth } from "@/lib/firebase";

import { onAuthStateChanged } from "firebase/auth";

export default function SignInPanel() {
  const [authed, setAuthed] = useState(() => auth.currentUser !== null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(Boolean(user));
    });
    return () => unsub();
  }, []);

  if (authed) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-[#111b21]/40 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#00a884]">サインイン</h2>
      <p className="mt-1 text-xs text-[#8696a0]">
        Grow Coachと会話するには、メールアドレスを入力してサインインリンクを受け取ってください。
      </p>
      <div className="mt-4">
        <EmailLinkForm />
      </div>
    </div>
  );
}