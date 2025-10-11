"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { logEvent } from "@/lib/logger";
import {
  createNewBundleId,
  getOrCreateCurrentBundleId,
  loadGoalRecord,
  loadOptionsRecord,
  loadWillRecord,
  saveGoalRecord,
  saveOptionsRecord,
  saveWillRecord,
} from "@/lib/storage";
import type {
  GoalRecord,
  OptionItem,
  OptionsRecord,
  TimeHorizon,
  WillRecord,
} from "@/types/records";

type Step = "goal" | "options" | "will" | "summary";

type GoalTag = "goal_setting" | "future_design" | "vision_define" | "decide_goal" | "set_direction";
type OptionsTag = "make_options" | "idea_pool" | "action_menu";
type WillTag = "decide_step" | "action_plan" | "if_then_plan";

type GoalFormState = {
  goalText: string;
  timeHorizon: TimeHorizon | "";
  successMetric: string;
  importance?: number;
  quick: boolean;
  tag: GoalTag;
};

type OptionsFormState = {
  options: OptionItem[];
  chosenOption: string;
  criteriaNote: string;
  tag: OptionsTag;
};

type WillFormState = {
  ifThen: string;
  barrier: string;
  antiBarrier: string;
  startTimeLocal: string;
  tag: WillTag;
};

const GOAL_TAG_OPTIONS: { value: GoalTag; label: string }[] = [
  { value: "goal_setting", label: "ゴール設定" },
  { value: "future_design", label: "未来デザイン" },
  { value: "vision_define", label: "ビジョン言語化" },
  { value: "decide_goal", label: "目標を決める" },
  { value: "set_direction", label: "方向づけ" },
];

const OPTIONS_TAG_OPTIONS: { value: OptionsTag; label: string }[] = [
  { value: "make_options", label: "選択肢づくり" },
  { value: "idea_pool", label: "対策アイデア" },
  { value: "action_menu", label: "できる手" },
];

const WILL_TAG_OPTIONS: { value: WillTag; label: string }[] = [
  { value: "decide_step", label: "一歩を決める" },
  { value: "action_plan", label: "実行プラン" },
  { value: "if_then_plan", label: "If-Then設定" },
];

const GOAL_HELPERS = [
  "3か月後、何ができていたら“前進”と言えますか。",
  "1週間の“できた／できない”は何で測りますか（回数・時間・行動有無など）。",
  "そのゴールが“あなたにとって大事な理由”は何ですか。",
];

const OPTIONS_HELPERS = [
  "他にどんなやり方がありますか？最低でももう1案出しましょう。",
  "各案の短所・長所を一言で。",
  "選ぶ基準は何ですか（時間／効果／負担など）。",
];

const WILL_HELPERS = [
  "もし（状況）なら（行動）をする—1つ作ってください。",
  "実行の妨げになりそうな障壁は？その先回り策は？",
  "いつ始めますか（日時・所要）。",
];

const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  today: "今日",
  "1w": "1週間",
  "3m": "3か月",
  "1y": "1年",
};

const QUICK_HORIZONS: TimeHorizon[] = ["today", "1w", "3m"];

const GOAL_TOOLTIP =
  "実現したい“望む未来”を言語化します。期間（今日／1週間／3か月／1年）と達成の目安を明確化します。";
const OPTIONS_TOOLTIP =
  "2–3個の選択肢を出し、短所・長所と選択基準で見比べます。";
const WILL_TOOLTIP =
  "“やる一歩”をIf-Thenで確定し、開始タイミングを決めます。";

const GOAL_ERROR_ID = "gow-goal-error";
const GOAL_STATUS_ID = "gow-goal-status";
const OPTIONS_ERROR_ID = "gow-options-error";
const OPTIONS_STATUS_ID = "gow-options-status";
const WILL_ERROR_ID = "gow-will-error";
const WILL_STATUS_ID = "gow-will-status";

const STEP_ORDER: Step[] = ["goal", "options", "will"];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function toLocalDateTimeInput(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoWithTimezone(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (abs % 60).toString().padStart(2, "0");
  const [datePart, timePart] = localValue.split("T");
  return `${datePart}T${timePart}:00${sign}${hours}:${minutes}`;
}

function nowIsBefore(localValue: string): boolean {
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now();
}

function ensureOptionCount(options: OptionItem[]): OptionItem[] {
  if (options.length >= 2) return options;
  const padded = [...options];
  while (padded.length < 2) {
    padded.push({ id: crypto.randomUUID(), option_text: "", pros_cons: "" });
  }
  return padded;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function GOWPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("goal");
  const [bundleId, setBundleId] = useState<string | undefined>(undefined);
  const [goalState, setGoalState] = useState<GoalFormState>({
    goalText: "",
    timeHorizon: "",
    successMetric: "",
    importance: undefined,
    quick: false,
    tag: "goal_setting",
  });
  const [goalRecord, setGoalRecord] = useState<GoalRecord | undefined>(undefined);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalStatus, setGoalStatus] = useState<string | null>(null);

  const [optionsState, setOptionsState] = useState<OptionsFormState>({
    options: ensureOptionCount([
      { id: crypto.randomUUID(), option_text: "", pros_cons: "" },
      { id: crypto.randomUUID(), option_text: "", pros_cons: "" },
    ]),
    chosenOption: "",
    criteriaNote: "",
    tag: "make_options",
  });
  const [optionsRecord, setOptionsRecord] = useState<OptionsRecord | undefined>(undefined);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsStatus, setOptionsStatus] = useState<string | null>(null);

  const [willState, setWillState] = useState<WillFormState>({
    ifThen: "",
    barrier: "",
    antiBarrier: "",
    startTimeLocal: "",
    tag: "if_then_plan",
  });
  const [willRecord, setWillRecordState] = useState<WillRecord | undefined>(undefined);
  const [willError, setWillError] = useState<string | null>(null);
  const [willStatus, setWillStatus] = useState<string | null>(null);

  const gowCompletedLogged = useRef(false);

  const goalHelpers = useMemo(() => shuffle(GOAL_HELPERS).slice(0, 2), []);

  useEffect(() => {
    logEvent("view_gow");
    logEvent("view_gow_goal");
    const id = getOrCreateCurrentBundleId();
    if (!id) return;
    setBundleId(id);
    const existingGoal = loadGoalRecord(id);
    if (existingGoal) {
      setGoalRecord(existingGoal);
      setGoalState({
        goalText: existingGoal.goal_text,
        timeHorizon: existingGoal.time_horizon,
        successMetric: existingGoal.success_metric,
        importance: existingGoal.importance,
        quick: existingGoal.tags?.includes("quick_goal") ?? false,
        tag:
          (existingGoal.tags?.find((tag) =>
            GOAL_TAG_OPTIONS.some((option) => option.value === tag as GoalTag),
          ) as GoalTag | undefined) ?? "goal_setting",
      });
    }
    const existingOptions = loadOptionsRecord(id);
    if (existingOptions) {
      setOptionsRecord(existingOptions);
      setOptionsState({
        options: ensureOptionCount(existingOptions.options),
        chosenOption: existingOptions.chosen_option,
        criteriaNote: existingOptions.criteria_note ?? "",
        tag:
          (existingOptions.tags?.find((tag) =>
            OPTIONS_TAG_OPTIONS.some((option) => option.value === tag as OptionsTag),
          ) as OptionsTag | undefined) ?? "make_options",
      });
    }
    const existingWill = loadWillRecord(id);
    if (existingWill) {
      setWillRecordState(existingWill);
      setWillState({
        ifThen: existingWill.if_then,
        barrier: existingWill.barrier ?? "",
        antiBarrier: existingWill.anti_barrier ?? "",
        startTimeLocal: toLocalDateTimeInput(existingWill.start_time),
        tag:
          (existingWill.tags?.find((tag) =>
            WILL_TAG_OPTIONS.some((option) => option.value === tag as WillTag),
          ) as WillTag | undefined) ?? "if_then_plan",
      });
    }
  }, []);

  useEffect(() => {
    if (currentStep === "goal") return;
    if (currentStep === "options") {
      logEvent("view_gow_options");
    } else if (currentStep === "will") {
      logEvent("view_gow_will");
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== "summary" || !goalRecord || gowCompletedLogged.current) return;
    logEvent("gow_completed", {
      time_horizon: goalRecord.time_horizon,
      has_options: Boolean(optionsRecord),
      has_will: Boolean(willRecord),
    });
    gowCompletedLogged.current = true;
  }, [currentStep, goalRecord, optionsRecord, willRecord]);
  const handleGoalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bundleId) return;
    setGoalError(null);

    const trimmedGoal = goalState.goalText.trim();
    const trimmedMetric = goalState.quick
      ? goalState.goalText.trim()
      : goalState.successMetric.trim();

    if (!trimmedGoal || !goalState.timeHorizon || !trimmedMetric) {
      setGoalError("ゴールの本文・期間・達成の目安を入力してください。");
      return;
    }

    const limit = goalState.quick ? 40 : 200;
    if (trimmedGoal.length > limit) {
      setGoalError(`ゴール本文は${limit}文字以内で入力してください。`);
      return;
    }

    if (!goalState.quick && trimmedMetric.length === 0) {
      setGoalError("達成の目安を入力してください。");
      return;
    }

    const record: GoalRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      goal_text: trimmedGoal,
      time_horizon: goalState.timeHorizon,
      success_metric: trimmedMetric,
      importance: goalState.importance,
      tags: Array.from(
        new Set([
          "goal_setting",
          "vision_define",
          goalState.tag,
          goalState.quick ? "quick_goal" : undefined,
        ].filter(Boolean) as string[]),
      ),
    };

    saveGoalRecord(bundleId, record);
    setGoalRecord(record);
    logEvent("goal_created", {
      time_horizon: record.time_horizon,
      quick: goalState.quick,
    });
    setGoalStatus("ゴールを保存しました。次のステップに進みます。");
    setTimeout(() => {
      setGoalStatus(null);
      setCurrentStep("options");
    }, 600);
  };

  const handleGoalQuickChange = (next: boolean) => {
    setGoalState((prev) => {
      const timeHorizon = next && prev.timeHorizon === "1y" ? "" : prev.timeHorizon;
      const goalText = next && prev.goalText.length > 40 ? prev.goalText.slice(0, 40) : prev.goalText;
      const successMetric = next ? goalText : prev.successMetric;
      return {
        ...prev,
        quick: next,
        timeHorizon,
        goalText,
        successMetric,
      };
    });
  };

  const addOption = () => {
    setOptionsState((prev) => {
      if (prev.options.length >= 3) return prev;
      return {
        ...prev,
        options: [...prev.options, { id: crypto.randomUUID(), option_text: "", pros_cons: "" }],
      };
    });
  };

  const updateOption = (id: string, field: "option_text" | "pros_cons", value: string) => {
    setOptionsState((prev) => ({
      ...prev,
      options: prev.options.map((option) =>
        option.id === id ? { ...option, [field]: value } : option,
      ),
    }));
  };

  const removeOption = (id: string) => {
    setOptionsState((prev) => {
      if (prev.options.length <= 2) return prev;
      const filtered = prev.options.filter((option) => option.id !== id);
      const nextChosen = filtered.some((option) => option.id === prev.chosenOption)
        ? prev.chosenOption
        : "";
      return {
        ...prev,
        options: filtered,
        chosenOption: nextChosen,
      };
    });
  };

  const handleOptionsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bundleId) return;
    setOptionsError(null);

    const trimmedOptions = optionsState.options.map((option) => ({
      ...option,
      option_text: option.option_text.trim(),
      pros_cons: option.pros_cons.trim(),
    }));

    if (trimmedOptions.length < 2) {
      setOptionsError("案は2〜3個必要です。");
      return;
    }

    if (trimmedOptions.some((option) => !option.option_text || !option.pros_cons)) {
      setOptionsError("各案の本文と短所・長所を入力してください。");
      return;
    }

    if (!trimmedOptions.some((option) => option.id === optionsState.chosenOption)) {
      setOptionsError("選択した案が見つかりません。");
      return;
    }

    const record: OptionsRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      options: trimmedOptions.slice(0, 3),
      chosen_option: optionsState.chosenOption,
      criteria_note: optionsState.criteriaNote.trim() || undefined,
      tags: Array.from(
        new Set([
          "make_options",
          "action_menu",
          optionsState.tag,
        ]),
      ),
    };

    saveOptionsRecord(bundleId, record);
    setOptionsRecord(record);
    logEvent("options_created", { count: record.options.length });
    logEvent("option_chosen", { chosen_option: record.chosen_option });
    setOptionsStatus("選択肢を保存しました。次のステップに進みます。");
    setTimeout(() => {
      setOptionsStatus(null);
      setCurrentStep("will");
    }, 600);
  };

  const handleWillSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bundleId) return;
    setWillError(null);

    const trimmedIfThen = willState.ifThen.trim();
    if (!trimmedIfThen) {
      setWillError("If-Then文と開始日時を入力してください。");
      return;
    }

    if (!willState.startTimeLocal) {
      setWillError("If-Then文と開始日時を入力してください。");
      return;
    }

    if (!nowIsBefore(willState.startTimeLocal)) {
      setWillError("開始日時は現在時刻以降を選んでください。");
      return;
    }

    const iso = toIsoWithTimezone(willState.startTimeLocal);
    if (!iso) {
      setWillError("開始日時の形式が正しくありません。");
      return;
    }

    const record: WillRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      if_then: trimmedIfThen,
      barrier: willState.barrier.trim() || undefined,
      anti_barrier: willState.antiBarrier.trim() || undefined,
      start_time: iso,
      tags: Array.from(new Set(["if_then_plan", "action_plan", willState.tag])),
    };

    saveWillRecord(bundleId, record);
    setWillRecordState(record);
    logEvent("will_created", { has_barrier: Boolean(record.barrier) });
    setWillStatus("実行プランを保存しました。要約に移ります。");
    setTimeout(() => {
      setWillStatus(null);
      setCurrentStep("summary");
    }, 600);
  };

  const goToSummary = () => {
    setCurrentStep("summary");
  };

  const startNewSession = () => {
    const newId = createNewBundleId();
    if (!newId) return;
    setBundleId(newId);
    gowCompletedLogged.current = false;
    setGoalState({
      goalText: "",
      timeHorizon: "",
      successMetric: "",
      importance: undefined,
      quick: false,
      tag: "goal_setting",
    });
    setGoalRecord(undefined);
    setOptionsState({
      options: ensureOptionCount([
        { id: crypto.randomUUID(), option_text: "", pros_cons: "" },
        { id: crypto.randomUUID(), option_text: "", pros_cons: "" },
      ]),
      chosenOption: "",
      criteriaNote: "",
      tag: "make_options",
    });
    setOptionsRecord(undefined);
    setWillState({
      ifThen: "",
      barrier: "",
      antiBarrier: "",
      startTimeLocal: "",
      tag: "if_then_plan",
    });
    setWillRecordState(undefined);
    setCurrentStep("goal");
    logEvent("view_gow_goal");
  };

  const renderStepper = () => (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      {STEP_ORDER.map((step, index) => {
        const isActive = currentStep === step;
        const isCompleted = STEP_ORDER.indexOf(currentStep as Step) > index || currentStep === "summary";
        const label =
          step === "goal" ? "G: ゴール" : step === "options" ? "O: 選択肢" : "W: 一歩";
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : isCompleted
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-600"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-slate-700">{label}</span>
          </li>
        );
      })}
    </ol>
  );
  return (
    <main className="min-h-screen bg-[var(--bg,#f9fafb)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="self-start rounded-full bg-transparent px-3 py-1 text-sm text-indigo-600 underline decoration-dotted hover:text-indigo-700"
          >
            ← ホームに戻る
          </button>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            望む未来の実現に向けた対話（G・O・W）
          </h1>
          <p className="text-sm text-slate-600">ゴール → 選択肢 → 一歩 の順に整理します。</p>
          {renderStepper()}
        </header>

        {currentStep === "goal" && (
          <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">G = Goal</h2>
              <p className="text-sm text-slate-600" title={GOAL_TOOLTIP}>
                {GOAL_TOOLTIP}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {goalHelpers.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>

            <form className="flex flex-col gap-6" onSubmit={handleGoalSubmit}>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-slate-800">カテゴリタグ</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GOAL_TAG_OPTIONS.map((tag) => (
                    <label
                      key={tag.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-indigo-300"
                    >
                      <input
                        type="radio"
                        name="goal-tag"
                        value={tag.value}
                        checked={goalState.tag === tag.value}
                        onChange={(event) =>
                          setGoalState((prev) => ({ ...prev, tag: event.target.value as GoalTag }))
                        }
                        className="h-4 w-4"
                      />
                      <span>{tag.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
                <div>
                  <span className="text-sm font-semibold text-indigo-700">クイック版</span>
                  <p className="text-xs text-indigo-600">40字ゴールと短期（今日〜3か月）のみで記録します。</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-indigo-700">
                  <input
                    type="checkbox"
                    checked={goalState.quick}
                    onChange={(event) => handleGoalQuickChange(event.target.checked)}
                    className="h-5 w-5"
                  />
                  クイック
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="goal-text">
                  ゴール本文
                </label>
                <textarea
                  id="goal-text"
                  maxLength={goalState.quick ? 40 : 200}
                  value={goalState.goalText}
                  onChange={(event) =>
                    setGoalState((prev) => {
                      const nextText = event.target.value;
                      return {
                        ...prev,
                        goalText: nextText,
                        successMetric: prev.quick ? nextText : prev.successMetric,
                      };
                    })
                  }
                  aria-describedby="goal-text-desc"
                  className="h-32 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <p id="goal-text-desc" className="text-xs text-slate-500">
                  {goalState.quick
                    ? "クイックは40文字以内。達成の目安として同じ内容が保存されます。"
                    : "最大200文字まで入力できます。"}
                </p>
                <span className="self-end text-xs text-slate-400">
                  {goalState.goalText.length}/{goalState.quick ? 40 : 200}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="goal-horizon">
                  期間（タイムホライズン）
                </label>
                <select
                  id="goal-horizon"
                  value={goalState.timeHorizon}
                  onChange={(event) =>
                    setGoalState((prev) => ({
                      ...prev,
                      timeHorizon: event.target.value as TimeHorizon,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {(goalState.quick ? QUICK_HORIZONS : (Object.keys(TIME_HORIZON_LABELS) as TimeHorizon[])).map((key) => (
                    <option key={key} value={key}>
                      {TIME_HORIZON_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              {!goalState.quick && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="goal-success">
                    達成の目安
                  </label>
                  <textarea
                    id="goal-success"
                    value={goalState.successMetric}
                    onChange={(event) =>
                      setGoalState((prev) => ({ ...prev, successMetric: event.target.value }))
                    }
                    aria-describedby="goal-success-desc"
                    className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <p id="goal-success-desc" className="text-xs text-slate-500">
                    回数・時間・行動など、達成をどう測るかを書いてください。
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="goal-importance">
                  大切さ（0〜10） <span className="text-xs text-slate-500">※任意</span>
                </label>
                <input
                  id="goal-importance"
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={goalState.importance ?? 5}
                  onChange={(event) =>
                    setGoalState((prev) => ({
                      ...prev,
                      importance: Number.parseInt(event.target.value, 10),
                    }))
                  }
                />
                <span className="text-sm text-slate-600" aria-live="polite">
                  現在の値: {goalState.importance ?? "未選択"}
                </span>
              </div>

              {goalError && (
                <div
                  id={GOAL_ERROR_ID}
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {goalError}
                </div>
              )}

              {goalStatus && (
                <div
                  id={GOAL_STATUS_ID}
                  role="status"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {goalStatus}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
                  aria-describedby={[goalError ? GOAL_ERROR_ID : null, goalStatus ? GOAL_STATUS_ID : null]
                    .filter(Boolean)
                    .join(" ") || undefined}
                  disabled={!bundleId}
                >
                  次へ
                </button>
              </div>
            </form>
          </section>
        )}
        {currentStep === "options" && (
          <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">O = Options</h2>
              <p className="text-sm text-slate-600" title={OPTIONS_TOOLTIP}>
                {OPTIONS_TOOLTIP}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {OPTIONS_HELPERS.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>

            <form className="flex flex-col gap-6" onSubmit={handleOptionsSubmit}>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-slate-800">カテゴリタグ</legend>
                <div className="flex flex-wrap gap-2">
                  {OPTIONS_TAG_OPTIONS.map((tag) => (
                    <label
                      key={tag.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-indigo-300"
                    >
                      <input
                        type="radio"
                        name="options-tag"
                        value={tag.value}
                        checked={optionsState.tag === tag.value}
                        onChange={(event) =>
                          setOptionsState((prev) => ({ ...prev, tag: event.target.value as OptionsTag }))
                        }
                        className="h-4 w-4"
                      />
                      <span>{tag.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-4">
                {optionsState.options.map((option, index) => (
                  <div key={option.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">案 {index + 1}</h3>
                      {optionsState.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(option.id)}
                          className="text-xs font-semibold text-slate-500 underline decoration-dotted hover:text-slate-700"
                        >
                          削除
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-600" htmlFor={`option-text-${option.id}`}>
                        案の内容
                      </label>
                      <textarea
                        id={`option-text-${option.id}`}
                        value={option.option_text}
                        onChange={(event) => updateOption(option.id, "option_text", event.target.value)}
                        className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <label className="text-xs font-semibold text-slate-600" htmlFor={`option-pros-${option.id}`}>
                        長所・短所（ひと言で）
                      </label>
                      <textarea
                        id={`option-pros-${option.id}`}
                        value={option.pros_cons}
                        onChange={(event) => updateOption(option.id, "pros_cons", event.target.value)}
                        className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="radio"
                        name="chosen-option"
                        value={option.id}
                        checked={optionsState.chosenOption === option.id}
                        onChange={(event) =>
                          setOptionsState((prev) => ({ ...prev, chosenOption: event.target.value }))
                        }
                      />
                      この案を軸にする
                    </label>
                  </div>
                ))}
                {optionsState.options.length < 3 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="self-start rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
                  >
                    + 案を追加
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="option-criteria">
                  選ぶ基準メモ <span className="text-xs text-slate-500">※任意</span>
                </label>
                <textarea
                  id="option-criteria"
                  value={optionsState.criteriaNote}
                  onChange={(event) =>
                    setOptionsState((prev) => ({ ...prev, criteriaNote: event.target.value }))
                  }
                  className="h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {optionsError && (
                <div
                  id={OPTIONS_ERROR_ID}
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {optionsError}
                </div>
              )}

              {optionsStatus && (
                <div
                  id={OPTIONS_STATUS_ID}
                  role="status"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {optionsStatus}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep("will")}
                  className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-700"
                >
                  スキップ
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
                  aria-describedby={[optionsError ? OPTIONS_ERROR_ID : null, optionsStatus ? OPTIONS_STATUS_ID : null]
                    .filter(Boolean)
                    .join(" ") || undefined}
                  disabled={!bundleId}
                >
                  次へ
                </button>
              </div>
            </form>
          </section>
        )}
        {currentStep === "will" && (
          <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">W = Will</h2>
              <p className="text-sm text-slate-600" title={WILL_TOOLTIP}>
                {WILL_TOOLTIP}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {WILL_HELPERS.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>

            <form className="flex flex-col gap-6" onSubmit={handleWillSubmit}>
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-slate-800">カテゴリタグ</legend>
                <div className="flex flex-wrap gap-2">
                  {WILL_TAG_OPTIONS.map((tag) => (
                    <label
                      key={tag.value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-indigo-300"
                    >
                      <input
                        type="radio"
                        name="will-tag"
                        value={tag.value}
                        checked={willState.tag === tag.value}
                        onChange={(event) =>
                          setWillState((prev) => ({ ...prev, tag: event.target.value as WillTag }))
                        }
                        className="h-4 w-4"
                      />
                      <span>{tag.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="will-ifthen">
                  If-Then文
                </label>
                <textarea
                  id="will-ifthen"
                  placeholder="もし朝の通勤電車で座れたら、5分だけ週報の素案を書く"
                  value={willState.ifThen}
                  onChange={(event) => setWillState((prev) => ({ ...prev, ifThen: event.target.value }))}
                  className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="will-barrier">
                    想定される障壁 <span className="text-xs text-slate-500">※任意</span>
                  </label>
                  <textarea
                    id="will-barrier"
                    value={willState.barrier}
                    onChange={(event) => setWillState((prev) => ({ ...prev, barrier: event.target.value }))}
                    className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="will-anti">
                    先回り策 <span className="text-xs text-slate-500">※任意</span>
                  </label>
                  <textarea
                    id="will-anti"
                    value={willState.antiBarrier}
                    onChange={(event) => setWillState((prev) => ({ ...prev, antiBarrier: event.target.value }))}
                    className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-800" htmlFor="will-start">
                  開始日時
                </label>
                <input
                  id="will-start"
                  type="datetime-local"
                  value={willState.startTimeLocal}
                  onChange={(event) =>
                    setWillState((prev) => ({ ...prev, startTimeLocal: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              {willError && (
                <div
                  id={WILL_ERROR_ID}
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {willError}
                </div>
              )}

              {willStatus && (
                <div
                  id={WILL_STATUS_ID}
                  role="status"
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {willStatus}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={goToSummary}
                  className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-700"
                >
                  スキップ
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
                  aria-describedby={[willError ? WILL_ERROR_ID : null, willStatus ? WILL_STATUS_ID : null]
                    .filter(Boolean)
                    .join(" ") || undefined}
                  disabled={!bundleId}
                >
                  完了
                </button>
              </div>
            </form>
          </section>
        )}
        {currentStep === "summary" && (
          <section className="flex flex-col gap-6 rounded-2xl border border-emerald-200 bg-white p-6 shadow-md sm:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-emerald-700">セッション要約</h2>
              <p className="text-sm text-slate-600">
                G・O・Wで整理した内容を確認し、次のアクションに備えましょう。
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">G: ゴール</h3>
                {goalRecord ? (
                  <dl className="mt-2 space-y-2 text-sm text-slate-700">
                    <div>
                      <dt className="font-semibold">本文</dt>
                      <dd>{goalRecord.goal_text}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">期間</dt>
                      <dd>{TIME_HORIZON_LABELS[goalRecord.time_horizon]}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">達成の目安</dt>
                      <dd>{goalRecord.success_metric}</dd>
                    </div>
                    {typeof goalRecord.importance === "number" && (
                      <div>
                        <dt className="font-semibold">大切さ</dt>
                        <dd>{goalRecord.importance}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-semibold">タグ</dt>
                      <dd>{goalRecord.tags.join(", ")}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">ゴールはまだ設定されていません。</p>
                )}
              </article>

              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">O: 選択肢</h3>
                {optionsRecord ? (
                  <div className="mt-2 space-y-3 text-sm text-slate-700">
                    {optionsRecord.options.map((option) => (
                      <div
                        key={option.id}
                        className={`rounded-lg border px-3 py-2 ${
                          option.id === optionsRecord.chosen_option
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-semibold">{option.option_text}</p>
                        <p className="text-xs text-slate-500">短所・長所: {option.pros_cons}</p>
                        {option.id === optionsRecord.chosen_option && (
                          <p className="mt-1 text-xs font-semibold text-emerald-600">★ 選択した案</p>
                        )}
                      </div>
                    ))}
                    {optionsRecord.criteria_note && (
                      <p className="text-xs text-slate-500">選ぶ基準: {optionsRecord.criteria_note}</p>
                    )}
                    <p className="text-xs text-slate-500">タグ: {optionsRecord.tags.join(", ")}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">選択肢はスキップされました。</p>
                )}
              </article>

              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">W: 一歩</h3>
                {willRecord ? (
                  <dl className="mt-2 space-y-2 text-sm text-slate-700">
                    <div>
                      <dt className="font-semibold">If-Then</dt>
                      <dd>{willRecord.if_then}</dd>
                    </div>
                    {willRecord.barrier && (
                      <div>
                        <dt className="font-semibold">想定される障壁</dt>
                        <dd>{willRecord.barrier}</dd>
                      </div>
                    )}
                    {willRecord.anti_barrier && (
                      <div>
                        <dt className="font-semibold">先回り策</dt>
                        <dd>{willRecord.anti_barrier}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-semibold">開始日時</dt>
                      <dd>{formatDateTime(willRecord.start_time)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">タグ</dt>
                      <dd>{willRecord.tags.join(", ")}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">一歩の設定はスキップされました。</p>
                )}
              </article>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-700"
              >
                ホームへ
              </button>
              <button
                type="button"
                onClick={startNewSession}
                className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
              >
                新しいGOWを始める
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
