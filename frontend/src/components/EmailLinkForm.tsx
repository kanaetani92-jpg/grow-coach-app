"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ActionCodeSettings, sendSignInLinkToEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getErrorMessage } from "@/lib/errors";

// 送信後の遷移先（/email-link-complete ページで完了処理）
const actionCodeSettings: ActionCodeSettings = {
  url: typeof window !== "undefined"
    ? `${window.location.origin}/email-link-complete`
    : "https://example.com/email-link-complete", // SSR保険（実行時にはwindow側が使われる）
  handleCodeInApp: true,
};

export default function EmailLinkForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMsg(null);
    setErr(null);
    setSending(true);
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
// 完了ページで取り出せるようにローカルに保持
      window.localStorage.setItem("emailForSignIn", email);
      setMsg("ログイン用リンクを送信しました。メールをご確認ください。");
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setErr(
        message || "メール送信に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <label className="text-sm font-medium">
        メールアドレス
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder="you@example.com"
        />
      </label>

      <button
        type="submit"
        disabled={sending || !email}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {sending ? "送信中..." : "ログインリンクを送信"}
      </button>

      {msg ? <p className="text-sm text-green-600">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </form>
  );
}