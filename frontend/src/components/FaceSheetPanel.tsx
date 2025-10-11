import { type FormEvent, useEffect, useRef } from "react";

import type {
  CoachingState,
  DialogueCategory,
  DialogueEntry,
} from "@/lib/api";

const DIALOGUE_SECTIONS: ReadonlyArray<{
  category: DialogueCategory;
  title: string;
  description: string;
}> = [
  {
    category: "anythingTalk",
    title: "何でもトーク",
    description: "自由に書き留めたい話題や雑談メモを残せます。",
  },
  {
    category: "futureVision",
    title: "臨む未来の実現に向けた対話",
    description: "望む未来に近づく気づきや合意を記録しましょう。",
  },
];

type DialogueMap = Record<DialogueCategory, DialogueEntry[]>;
type DialogueInputs = Record<DialogueCategory, string>;

type FaceSheetPanelProps = {
  state: CoachingState | null;
  stageKey: string | null;
  stageDisplay: string;
  loading: boolean;
  error: string | null;
  dialogueError: string | null;
  dialogues: DialogueMap;
  inputs: DialogueInputs;
  onInputChange: (category: DialogueCategory, value: string) => void;
  onSubmit: (category: DialogueCategory) => void;
  savingCategory: DialogueCategory | null;
  disabled: boolean;
  onSectionSelect: (category: DialogueCategory) => void;
  activeCategory: DialogueCategory;
  focusCategory: DialogueCategory | null;
  focusToken: number;
};

export default function FaceSheetPanel({
  state,
  stageKey,
  stageDisplay,
  loading,
  error,
  dialogueError,
  dialogues,
  inputs,
  onInputChange,
  onSubmit,
  savingCategory,
  disabled,
  onSectionSelect,
  activeCategory,
  focusCategory,
  focusToken,
}: FaceSheetPanelProps) {
  return (
    <aside className="order-3 flex min-h-0 w-full flex-shrink-0 flex-col border-t border-slate-200 bg-white px-5 py-5 sm:px-6 sm:py-6 lg:order-3 lg:w-96 lg:border-l lg:border-t-0 lg:bg-white/80">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">フェイスシート</h2>
          <p className="text-xs text-slate-500">コーチのState JSONを読みやすく整理しています。</p>
        </div>
        {loading ? <span className="text-xs text-slate-500">読込中…</span> : null}
      </div>
      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="status">
          {error}
        </div>
      ) : null}
      {dialogueError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700" role="status">
          {dialogueError}
        </div>
      ) : null}
      {disabled ? (
        <p className="mt-3 text-xs text-slate-500">オンラインに接続すると対話メモを保存できます。</p>
      ) : null}
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="対話メモの入力先">
        {DIALOGUE_SECTIONS.map(({ category, title }) => {
          const isActive = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSectionSelect(category)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                isActive
                  ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                  : "border-teal-200 bg-white text-teal-700 shadow-sm hover:bg-teal-50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              aria-pressed={isActive}
              disabled={disabled}
            >
              {title}
            </button>
          );
        })}
      </nav>
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto text-sm text-slate-700">
        <FaceSheetSummary state={state} stageKey={stageKey} stageDisplay={stageDisplay} />
        {DIALOGUE_SECTIONS.map(({ category, title, description }) => (
          <DialogueSection
            key={category}
            category={category}
            title={title}
            description={description}
            entries={dialogues[category] ?? []}
            value={inputs[category] ?? ""}
            onChange={(value) => onInputChange(category, value)}
            onSubmit={() => onSubmit(category)}
            saving={savingCategory === category}
            disabled={disabled}
            focusTrigger={focusCategory === category ? focusToken : null}
            isActive={activeCategory === category}
            onSelect={onSectionSelect}
          />
        ))}
      </div>
    </aside>
  );
}

type FaceSheetSummaryProps = {
  state: CoachingState | null;
  stageKey: string | null;
  stageDisplay: string;
};

function FaceSheetSummary({ state, stageKey, stageDisplay }: FaceSheetSummaryProps) {
  if (!state) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-sm">
        <p>コーチとの対話が進むと、最新のState JSONがここに表示されます。</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">現在のステージ</h3>
        <p className="mt-1 text-xs text-slate-600">
          {stageDisplay} {stageKey ? `(${stageKey})` : ""}
        </p>
        {state.next_prompt_to_user ? (
          <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
            次の問いかけ: {state.next_prompt_to_user}
          </p>
        ) : null}
      </div>
      <FaceSheetList title="目標" items={state.user_goals} />
      <FaceSheetList title="現状の事実" items={state.reality.facts} />
      <FaceSheetList title="妨げ" items={state.reality.obstacles} />
      <FaceSheetList title="支え" items={state.reality.supports} />
      <FaceSheetScore score={state.reality.score_0to10} />
      <FaceSheetList title="活用できる内的資源" items={state.resources.internal} />
      <FaceSheetList title="活用できる外的資源" items={state.resources.external} />
      <FaceSheetList title="検討中の選択肢" items={state.options} />
      <FaceSheetPlan plan={state.plan} />
      <FaceSheetList title="想定されるリスク" items={state.risks} />
      <FaceSheetList title="合意したこと" items={state.agreements} />
    </section>
  );
}

type FaceSheetListProps = {
  title: string;
  items: string[];
};

function FaceSheetList({ title, items }: FaceSheetListProps) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-1 space-y-1 text-xs text-slate-600">
          {items.map((item, index) => (
            <li key={`${title}-${index}-${item}`} className="leading-relaxed">
              ・{item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-slate-400">記録がありません。</p>
      )}
    </div>
  );
}

type FaceSheetScoreProps = {
  score: number | null;
};

function FaceSheetScore({ score }: FaceSheetScoreProps) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-900">現状スコア (0-10)</h4>
      <p className="mt-1 text-xs text-slate-600">{score ?? "未入力"}</p>
    </div>
  );
}

type FaceSheetPlanProps = {
  plan: CoachingState["plan"];
};

function FaceSheetPlan({ plan }: FaceSheetPlanProps) {
  const items: Array<{ label: string; value: string }> = [
    { label: "最初の一歩", value: plan.first_step },
    { label: "いつ・どこで", value: plan.when_where },
    { label: "成功の指標", value: plan.measure_of_success },
    { label: "If-Then", value: plan.if_then },
    { label: "PlanB", value: plan.planB },
  ];

  const filled = items.filter((item) => item.value);

  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-900">行動計画</h4>
      {filled.length > 0 ? (
        <dl className="mt-1 space-y-1 text-xs text-slate-600">
          {filled.map((item) => (
            <div key={item.label}>
              <dt className="font-medium text-slate-700">{item.label}</dt>
              <dd className="text-slate-600">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-xs text-slate-400">まだ行動計画は記録されていません。</p>
      )}
    </div>
  );
}

type DialogueSectionProps = {
  category: DialogueCategory;
  title: string;
  description: string;
  entries: DialogueEntry[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
  disabled: boolean;
  focusTrigger: number | null;
  isActive: boolean;
  onSelect: (category: DialogueCategory) => void;
};

function DialogueSection({
  category,
  title,
  description,
  entries,
  value,
  onChange,
  onSubmit,
  saving,
  disabled,
  focusTrigger,
  isActive,
  onSelect,
}: DialogueSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusTrigger === null) {
      return;
    }
    const sectionEl = sectionRef.current;
    const textareaEl = textareaRef.current;
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    if (textareaEl) {
      textareaEl.focus();
      const length = textareaEl.value.length;
      textareaEl.setSelectionRange(length, length);
    }
  }, [focusTrigger]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <section
      ref={sectionRef}
      className={`rounded-2xl border bg-white px-4 py-4 text-sm text-slate-700 shadow-sm transition ${
        isActive ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200"
      }`}
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <textarea
          id={`${category}-input`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[120px] w-full resize-vertical rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
          placeholder="ここに記録を入力"
          disabled={saving || disabled}
          aria-label={`${title}を入力`}
          ref={textareaRef}
          onFocus={() => onSelect(category)}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || disabled || value.trim().length === 0}
          >
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      </form>
      {entries.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <time className="text-[11px] text-slate-500">{formatTimestamp(entry.createdAt)}</time>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{entry.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-slate-400">まだ記録がありません。</p>
      )}
    </section>
  );
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
