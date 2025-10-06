"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { sendSignInLinkToEmail } from "firebase/auth";

export default function EmailLinkForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSendLink = async () => {
    setMsg(null);
    if (!email) return setMsg("メールを入力してください");
    setSending(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/email-link-complete`, // ← 完了ページ
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      localStorage.setItem("emailForSignIn", email);
      setMsg("ログイン用リンクを送信しました。メールをご確認ください。");
    } catch (e: any) {
      setMsg(`送信に失敗しました: ${e.message ?? e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border px-3 py-2 rounded w-80"
        />
        <button
          onClick={onSendLink}
          disabled={sending}
          className="border px-3 py-2 rounded"
        >
          {sending ? "送信中..." : "ログインリンクを送る"}
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
