import Link from "next/link";

import { flowDefinitions } from "./flow-data";

export default function GrowGuidesPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            GROWモジュール一覧
          </h1>
          <p className="text-sm text-slate-600 sm:text-base">
            セッションで使える進行モジュールを選び、詳細ガイドに進めます。
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {flowDefinitions.map((flow) => (
            <article
              key={flow.slug}
              className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">{flow.title}</h2>
                  <p className="text-sm text-slate-600">{flow.summary}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    ラベル候補（UI表示／内部タグ）
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {flow.labelCandidates.map((candidate) => (
                      <li key={`${flow.slug}-${candidate.tag}`} className="flex items-start gap-1">
                        <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-500" />
                        <span>
                          {candidate.ui}（<span className="font-mono text-[13px]">{candidate.tag}</span>）
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs text-teal-700">
                  {flow.tooltip}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-end">
                <Link
                  href={`/grow-guides/${flow.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  詳細ガイドを見る
                  <span aria-hidden="true" className="text-base leading-none">
                    →
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </section>

        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="text-base leading-none">
              ⟵
            </span>
            トップページへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
