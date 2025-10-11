"use client";

import Link from "next/link";
import { useEffect } from "react";

import ChatClient from "@/components/ChatClient";
import SignInPanel from "@/components/SignInPanel";
import { logEvent } from "@/lib/logger";

export default function Page() {
  useEffect(() => {
    logEvent("view_home");
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg,#f9fafb)] px-4 py-16 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="flex flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            今日はどう進めますか？
          </h1>
          <p className="text-base text-slate-600 sm:text-lg">
            目的に合わせてコーチング体験を選びつつ、従来のGROWセッションやコーチ選択にもアクセスできます。
          </p>
        </header>

        <section
          aria-label="コーチングメニュー"
          className="grid gap-6 sm:grid-cols-2"
        >
          <Link
            href="/checkin"
            title="本題の前に、いまの気分や近況を30秒で共有します。話したくなければスキップ可。"
            className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">
                チェックイン
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                何でもトーク（チェックイン／Rの軽い導入）
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                ウォームアップで気分や近況を共有し、話しやすい空気を整えましょう。
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
              進む →
            </span>
          </Link>

          <Link
            href="/gow"
            title="実現したい“望む未来”を言語化します。期間（今日／1週間／3か月／1年）と達成の目安を明確化します。"
            className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-500">
                G・O・W
              </p>
              <h2 className="text-2xl font-bold text-slate-900">
                望む未来の実現に向けた対話（G・O・W）
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                ゴール・選択肢・踏み出す一歩を順に整理し、行動につながる対話を設計します。
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
              進む →
            </span>
          </Link>
        </section>

        <section className="grid gap-6 lg:grid-cols-[320px,1fr]" aria-label="GROWコーチング">
          <div className="order-2 lg:order-1">
            <SignInPanel />
          </div>
          <div className="order-1 lg:order-2">
            <ChatClient />
          </div>
        </section>
      </div>
    </main>
  );
}
