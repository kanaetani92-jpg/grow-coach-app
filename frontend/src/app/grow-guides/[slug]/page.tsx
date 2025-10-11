import Link from "next/link";
import { notFound } from "next/navigation";

import { flowDefinitions, getFlowBySlug } from "../flow-data";

type FlowDetailPageProps = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return flowDefinitions.map((flow) => ({ slug: flow.slug }));
}

export default async function FlowDetailPage({ params }: FlowDetailPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const flow = getFlowBySlug(resolvedParams.slug);

  if (!flow) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-teal-600">GROW Module</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{flow.title}</h1>
          <p className="rounded-3xl border border-teal-100 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
            {flow.summary}
          </p>
          <p className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs text-teal-700">{flow.tooltip}</p>
        </header>

        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">ラベル候補（UI表示／内部タグ）</h2>
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

          <div>
            <h2 className="text-sm font-semibold text-slate-700">補助質問</h2>
            <p className="text-xs text-slate-500">セッションの文脈に合わせて1つずつ提示します。</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {flow.helperQuestions.map((question, index) => (
                <li key={`${flow.slug}-question-${index}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                  {question}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-700">記録フィールド（例）</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {flow.recordFields.map((field, index) => (
                <li key={`${flow.slug}-field-${index}`} className="flex items-start gap-1">
                  <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          </div>

          {flow.completionConditions.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-slate-700">完了条件</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {flow.completionConditions.map((condition, index) => (
                  <li key={`${flow.slug}-completion-${index}`} className="flex items-start gap-1">
                    <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{condition}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {flow.quickVersion?.length ? (
            <div>
              <h2 className="text-sm font-semibold text-slate-700">クイック版</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {flow.quickVersion.map((item, index) => (
                  <li key={`${flow.slug}-quick-${index}`} className="flex items-start gap-1">
                    <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap justify-between gap-3">
          <Link
            href="/grow-guides"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="text-base leading-none">
              ⟵
            </span>
            モジュール一覧へ戻る
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            ホームに移動
            <span aria-hidden="true" className="text-base leading-none">
              →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
