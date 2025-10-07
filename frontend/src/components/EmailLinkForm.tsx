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
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="border rounded px-3 py-2 w-full"
      />
      <button
        type="submit"
        disabled={sending || !email}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {sending ? "送信中…" : "メールでサインインリンクを送る"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}
