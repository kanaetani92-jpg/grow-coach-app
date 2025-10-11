"use client";

import { useEffect, useState } from "react";

import EmailLinkForm from "@/components/EmailLinkForm";
import { auth } from "@/lib/firebase";

import { onAuthStateChanged, type User } from "firebase/auth";

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
    const providerId = user.providerData[0]?.providerId ?? "password";
    const provider =
      providerId === "password"
        ? "メールリンク"
        : providerId === "google.com"
          ? "Google"
          : providerId;
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">アカウント</h2>
        <dl className="mt-4 space-y-3 text-sm text-slate-600">
          <div>
            <dt className="font-medium text-slate-700">メールアドレス</dt>
            <dd className="mt-1 break-all text-slate-900">{name}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">ログイン方法</dt>
            <dd className="mt-1 capitalize">{provider}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          ログアウトは画面右上のボタンから行えます。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">サインイン</h2>
      <p className="mt-2 text-sm text-slate-600">
        Grow Coach と会話するには、メールアドレスを入力してサインインリンクを受け取ってください。
      </p>
      <div className="mt-6">
        <EmailLinkForm />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        メールアドレスの誤りや迷惑メール（プロモーション／その他）を確認し、通信が安定していることを確かめてから
        「メールでサインインリンクを送る」をタップしてください。
      </p>
    </section>
  );
}