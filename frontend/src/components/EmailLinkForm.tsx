"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import type { ActionCodeSettings } from "firebase/auth";
import { sendSignInLinkToEmail } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { getErrorMessage } from "@/lib/errors";

export default function EmailLinkForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSending(true);
    setMsg(null);
    try {
      const actionCodeSettings: ActionCodeSettings = {
        url: `${window.location.origin}/email-link-complete`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setMsg("サインイン用リンクを送信しました。メールをご確認ください。");
    } catch (err) {
      setMsg(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={sending || !email}
        className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "送信中…" : "メールでサインインリンクを送る"}
      </button>
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </form>
  );
}
