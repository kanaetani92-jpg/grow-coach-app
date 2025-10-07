"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
} from "firebase/auth";
import { createSession } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export default function EmailLinkComplete() {
  const [status, setStatus] = useState("処理中...");

  useEffect(() => {
    const run = async () => {
      try {
        // メールリンクかチェック
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setStatus("このURLは無効です。");
          return;
        }

        // 送信時に保存したメール or 入力プロンプト
        let email = localStorage.getItem("emailForSignIn") || "";
        if (!email) {
          email = window.prompt("メールアドレスを入力してください") || "";
        }
        if (!email) {
          setStatus("メールアドレスが入力されませんでした。");
          return;
        }

        // サインイン
        await signInWithEmailLink(auth, email, window.location.href);
        localStorage.removeItem("emailForSignIn");
        setStatus("サインインに成功。セッションを作成しています...");

        // IDトークン→セッション作成
        const unsub = onAuthStateChanged(auth, async (user) => {
          if (!user) return;
          const idToken = await user.getIdToken();
          await createSession(idToken);
          setStatus("完了！トップへ戻ります...");
          unsub();
          window.location.replace("/");
        });
      } catch (error: unknown) {
        setStatus(`エラー: ${getErrorMessage(error)}`);
      }
    };
    run();
  }, []);

  return <p className="p-4">{status}</p>;
}