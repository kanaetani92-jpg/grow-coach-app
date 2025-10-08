"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import type { ActionCodeSettings } from "firebase/auth";
import { sendSignInLinkToEmail } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { getErrorMessage } from "@/lib/errors";

type FeedbackState = { type: "success" | "error"; message: string } | null;

export default function EmailLinkForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSending(true);
    setFeedback(null);
    try {
      const actionCodeSettings: ActionCodeSettings = {
        url: `${window.location.origin}/email-link-complete`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setFeedback({
        type: "success",
        message: "サインイン用リンクを送信しました。メールをご確認ください。",
      });
    } catch (err) {
      setFeedback({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" aria-busy={sending}>
      <div className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
          aria-label="メールアドレス"
        />
      </div>
      <button
        type="submit"
        disabled={sending || !email}
        className="w-full rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="サインインリンクをメールで送信"
      >
        {sending ? "送信中…" : "メールでサインインリンクを送る"}
      </button>
      {feedback && (
        <p
          className={`text-xs ${
            feedback.type === "success" ? "text-teal-700" : "text-rose-600"
          }`}
          aria-live="polite"
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}