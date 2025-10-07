"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";

import { auth } from "@/lib/firebase";
import { ApiError, createSession } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { logEvent } from "@/lib/logger";

const ACTIVE_SESSION_KEY = "activeSessionId";

export default function EmailLinkComplete() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("リンクを確認しています...");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [canResend, setCanResend] = useState(false);

  const actionCodeSettings = useMemo<ActionCodeSettings>(() => {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://example.com";
    return {
      url: `${origin}/email-link-complete`,
      handleCodeInApp: true,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setStatus("このリンクは無効か、期限が切れています。");
      setError("サインインリンクが無効です。再送信してから再度お試しください。");
      setCanResend(true);
      return;
    }

    const storedEmail = window.localStorage.getItem("emailForSignIn") ?? "";
    if (!storedEmail) {
      setStatus("メールアドレスを入力してください。");
      setNeedsEmail(true);
      return;
    }

    setEmail(storedEmail);
    void completeSignIn(storedEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeSignIn = useCallback(
    async (targetEmail: string) => {
      try {
        setStatus("サインイン処理中です...");
        setError(null);
        await signInWithEmailLink(auth, targetEmail, window.location.href);
        window.localStorage.removeItem("emailForSignIn");
        setStatus("サインインに成功しました。セッションを準備しています...");

        const user = await waitForUser();
        if (!user) {
          throw new Error("サインイン後のユーザー情報を取得できませんでした。");
        }

        let token = await user.getIdToken();
        const session = await createSession(token).catch(async (error) => {
          if (error instanceof ApiError && error.status === 401) {
            token = await user.getIdToken(true);
            return await createSession(token);
          }
          throw error;
        });

        window.localStorage.setItem(ACTIVE_SESSION_KEY, session.sessionId);
        logEvent("session_created", {
          from: "email-link-complete",
          sessionId: session.sessionId,
          stage: session.stage,
        });

        setStatus("完了しました。トップページへ移動します...");
        setTimeout(() => {
          router.replace("/");
        }, 1200);
      } catch (err) {
        const message = interpretCompletionError(err);
        setError(message);
        setStatus("サインインを完了できませんでした。");
        setCanResend(true);
        logEvent("coach_failure", { kind: "complete_sign_in", message });
      }
    },
    [router]
  );

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("メールアドレスを入力してください。");
      return;
    }
    window.localStorage.setItem("emailForSignIn", trimmed);
    setNeedsEmail(false);
    await completeSignIn(trimmed);
  };

  const onResend = async () => {
    if (!email) {
      setNeedsEmail(true);
      setError("再送するメールアドレスを入力してください。");
      return;
    }
    setResending(true);
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      setStatus("新しいリンクを送信しました。メールをご確認ください。");
      logEvent("coach_request", { kind: "resend_link" });
    } catch (err) {
      const message = interpretSendError(err);
      setError(message);
      logEvent("coach_failure", { kind: "resend_link", message });
    } finally {
      setResending(false);
    }
  };

  const onResetEmail = () => {
    setEmail("");
    setNeedsEmail(true);
    window.localStorage.removeItem("emailForSignIn");
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">メール認証</h1>
      <p className="text-sm text-gray-700">{status}</p>

      {needsEmail ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="text-sm font-medium">
            メールアドレスを入力
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm font-semibold text-white"
          >
            続行
          </button>
        </form>
      ) : null}

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          {canResend ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={onResend}
                disabled={resending}
                className="rounded bg-red-600 px-3 py-1 font-semibold text-white disabled:opacity-60"
              >
                {resending ? "再送中..." : "リンクを再送"}
              </button>
              <button
                type="button"
                onClick={onResetEmail}
                className="text-red-700 underline"
              >
                別のメールでログイン
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
        <p>ログインリンクが届かない場合は、迷惑メールフォルダをご確認ください。</p>
        <p className="mt-2">
          それでも解決しない場合は、ネットワーク環境を確認のうえ再度リンクを送信してください。
        </p>
      </div>
    </main>
  );
}

async function waitForUser(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  return await new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      unsub();
      resolve(currentUser);
    });
  });
}

function interpretCompletionError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-action-code":
      case "auth/expired-action-code":
        return "リンクが無効、または期限切れです。新しいリンクを再送してください。";
      case "auth/user-disabled":
        return "このアカウントは現在ご利用いただけません。";
      default:
        break;
    }
  }
  return getErrorMessage(error) || "サインイン処理でエラーが発生しました。";
}

function interpretSendError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません。";
      case "auth/too-many-requests":
        return "短時間に多数のリクエストが行われました。しばらくお待ちください。";
      case "auth/network-request-failed":
        return "ネットワークエラーが発生しました。接続を確認してください。";
      default:
        break;
    }
  }
  return getErrorMessage(error) || "リンクの再送に失敗しました。";
}
