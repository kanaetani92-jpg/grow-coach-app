"use client";

import { useEffect, useState } from "react";

import EmailLinkForm from "@/components/EmailLinkForm";
import { auth } from "@/lib/firebase";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";

export default function SignInPanel() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
    });
    return () => unsub();
  }, []);

  if (user) {
    const name = user.displayName || user.email || "サインイン済み";
    return (
      <div className="rounded-2xl bg-[#111b21]/40 p-4 text-[#e9edef]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#00a884]">アカウント</h2>
        <p className="mt-2 text-sm">{name}</p>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[#00a884] px-4 py-2 text-sm font-semibold text-[#0b141a] transition hover:bg-[#00b894]"
        >
          ログアウト
        </button>
      </div>
    );
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