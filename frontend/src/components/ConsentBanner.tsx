"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "grow-coach-consent";

type ConsentState = "unknown" | "accepted" | "declined";

export default function ConsentBanner() {
  const [state, setState] = useState<ConsentState>("unknown");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted" || stored === "declined") {
      setState(stored);
    } else {
      setState("declined");
    }
  }, []);

  if (state === "accepted") return null;

  const onAccept = () => {
    setState("accepted");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "accepted");
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="max-w-4xl flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
        <p className="text-sm text-gray-700">
          Grow Coach のご利用にあたり、利用規約とプライバシーポリシーへの同意が必要です。
          続行することで、データの利用目的（コーチング改善と安全性の確保）に同意したものとみなされます。
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-xs">
          <a href="/terms" className="underline" target="_blank" rel="noreferrer">
            利用規約を確認
          </a>
          <a href="/privacy" className="underline" target="_blank" rel="noreferrer">
            プライバシーを確認
          </a>
          <button
            type="button"
            onClick={onAccept}
            className="rounded bg-black px-4 py-2 font-semibold text-white"
          >
            同意して続行
          </button>
        </div>
      </div>
    </div>
  );
}