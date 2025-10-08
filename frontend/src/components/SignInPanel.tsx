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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">アカウント</h2>
        <p className="mt-2 text-sm text-slate-700">{name}</p>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">サインイン</h2>
      <p className="mt-1 text-xs text-slate-500">
        Grow Coachと会話するには、メールアドレスを入力してサインインリンクを受け取ってください。
      </p>
      <div className="mt-4">
        <EmailLinkForm />
      </div>
    </div>
  );
}