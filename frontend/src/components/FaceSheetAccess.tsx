"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchFaceSheet } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

type FaceSheetStatus = "unknown" | "loading" | "missing" | "exists" | "error";

export default function FaceSheetAccess() {
  const [authed, setAuthed] = useState(() => Boolean(auth.currentUser));
  const [status, setStatus] = useState<FaceSheetStatus>(() =>
    auth.currentUser ? "loading" : "unknown",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadStatus = async (user: User) => {
      setStatus("loading");
      setError(null);
      try {
        const token = await user.getIdToken();
        if (!active) return;
        const response = await fetchFaceSheet(token);
        if (!active) return;
        setStatus(response.faceSheet ? "exists" : "missing");
      } catch (loadError) {
        if (!active) return;
        setError(getErrorMessage(loadError));
        setStatus("error");
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(Boolean(user));
      if (!user) {
        setStatus("unknown");
        setError(null);
        return;
      }
      void loadStatus(user);
    });

    if (auth.currentUser) {
      void loadStatus(auth.currentUser);
    }

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const linkLabel = useMemo(() => {
    if (status === "missing") {
      return "フェイスシートを登録";
    }
    return "フェイスシートを管理";
  }, [status]);

  const linkClasses = useMemo(() => {
    const base =
      "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
    if (status === "missing") {
      return `${base} border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500`;
    }
    return `${base} border-teal-300 bg-white text-teal-700 hover:bg-teal-50 focus-visible:ring-teal-500`;
  }, [status]);

  const helperMessage = useMemo(() => {
    if (status === "loading") {
      return "フェイスシートの登録状況を確認しています…";
    }
    if (status === "missing") {
      return "初回登録がまだ完了していません。こちらから登録してください。";
    }
    if (status === "exists") {
      return "初回登録後もここから更新できます。";
    }
    if (status === "error" && error) {
      return `登録状況の取得に失敗しました: ${error}`;
    }
    return null;
  }, [status, error]);

  if (!authed) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <Link href="/face-sheet" className={linkClasses} aria-busy={status === "loading"}>
        {linkLabel}
      </Link>
      {helperMessage ? (
        <span
          className={`text-xs ${
            status === "missing" || status === "error" ? "text-rose-600" : "text-slate-500"
          }`}
        >
          {helperMessage}
        </span>
      ) : null}
    </div>
  );
}
