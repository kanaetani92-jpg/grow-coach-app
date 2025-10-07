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
      <div className="rounded-full border border-transparent bg-[#2a3942] px-4 py-3 text-sm text-[#e9edef] focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/40">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-transparent text-[#e9edef] placeholder:text-[#8696a0] focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={sending || !email}
        className="w-full rounded-full bg-[#00a884] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/40 transition hover:bg-[#02926f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "送信中…" : "メールでサインインリンクを送る"}
      </button>
      {msg && <p className="text-xs text-[#8696a0]">{msg}</p>}
    </form>
  );
}
