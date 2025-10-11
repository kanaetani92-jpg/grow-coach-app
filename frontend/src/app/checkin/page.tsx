"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { logEvent } from "@/lib/logger";
import { loadLatestCheckin, saveCheckin } from "@/lib/storage";
import type { CheckinRecord } from "@/types/records";

type PromptKey = "mood_oneword" | "recent_win" | "talk_style";

type PromptOption = {
  key: PromptKey;
  label: string;
};

type TagOption = {
  value: string;
  label: string;
};

const PROMPTS: PromptOption[] = [
  { key: "mood_oneword", label: "今日の気分を一言で言うと？（例：落ち着く／そわそわ／疲れ気味）" },
  { key: "recent_win", label: "最近“うまくいったこと”を1つ教えてください。" },
  {
    key: "talk_style",
    label: "今日は本題から入りますか？それとも軽く雑談しますか？",
  },
];

const TAGS: TagOption[] = [
  { value: "warmup_checkin", label: "ウォームアップ" },
  { value: "checkin", label: "チェックイン" },
  { value: "mood_share", label: "気分シェア" },
  { value: "brief_update", label: "近況ひとこと" },
  { value: "rapport_talk", label: "安心トーク" },
];

const CHECKIN_TAG_BASE = "checkin";

const PROMPT_DESCRIPTION_ID = "checkin-prompt-description";
const MOOD_DESCRIPTION_ID = "checkin-mood-description";
const NOTE_DESCRIPTION_ID = "checkin-note-description";
const TALK_DESCRIPTION_ID = "checkin-talk-description";
const QUICK_DESCRIPTION_ID = "checkin-quick-description";
const ERROR_ID = "checkin-error";
const STATUS_ID = "checkin-status";

export default function CheckinPage() {
  const router = useRouter();
  const [quick, setQuick] = useState(false);
  const [moodToday, setMoodToday] = useState<number | undefined>(undefined);
  const [freeNote, setFreeNote] = useState("");
  const [wantSmallTalk, setWantSmallTalk] = useState<boolean | undefined>(undefined);
  const [selectedTag, setSelectedTag] = useState<string>(CHECKIN_TAG_BASE);
  const [promptKey, setPromptKey] = useState<PromptKey>(() => {
    const random = Math.floor(Math.random() * PROMPTS.length);
    return PROMPTS[random]?.key ?? "mood_oneword";
  });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  const promptLabel = useMemo(
    () => PROMPTS.find((item) => item.key === promptKey)?.label ?? PROMPTS[0].label,
    [promptKey],
  );

  useEffect(() => {
    logEvent("view_checkin");
    logEvent("checkin_started");
    const latest = loadLatestCheckin();
    if (latest) {
      if (typeof latest.quick === "boolean") {
        setQuick(latest.quick);
      }
      if (typeof latest.mood_today === "number" && !Number.isNaN(latest.mood_today)) {
        setMoodToday(latest.mood_today);
      }
      if (typeof latest.free_note === "string") {
        setFreeNote(latest.free_note);
      }
      if (typeof latest.want_small_talk === "boolean") {
        setWantSmallTalk(latest.want_small_talk);
      }
      const matchedTag = latest.tags?.find((tag) => TAGS.some((t) => t.value === tag));
      if (matchedTag) {
        setSelectedTag(matchedTag);
      }
      const restoredPrompt = latest.meta?.prompt_key;
      if (restoredPrompt && PROMPTS.some((item) => item.key === restoredPrompt)) {
        setPromptKey(restoredPrompt);
      }
    }
    setIsRestored(true);
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => {
      router.push("/");
    }, 1400);
    return () => clearTimeout(timer);
  }, [router, status]);

  const resetOptionalFieldsForQuick = (nextQuick: boolean) => {
    if (nextQuick) {
      setFreeNote("");
      setWantSmallTalk(undefined);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedNote = freeNote.trim();
    const hasMood = typeof moodToday === "number" && !Number.isNaN(moodToday);
    const hasNote = !quick && trimmedNote.length > 0;

    if (!hasMood && !hasNote) {
      setError("気分スコア（0–10）または近況ひとことを入力してください。");
      return;
    }

    if (hasMood && (moodToday! < 0 || moodToday! > 10 || !Number.isInteger(moodToday!))) {
      setError("気分スコアは0〜10の整数で入力してください。");
      return;
    }

    if (!quick && trimmedNote.length > 140) {
      setError("近況ひとことは140文字以内で入力してください。");
      return;
    }

    const record: CheckinRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      tags: Array.from(new Set([CHECKIN_TAG_BASE, selectedTag])),
      quick,
      meta: { prompt_key: promptKey },
    };

    if (hasMood) {
      record.mood_today = moodToday;
    }
    if (hasNote) {
      record.free_note = trimmedNote;
    }
    if (!quick && typeof wantSmallTalk === "boolean") {
      record.want_small_talk = wantSmallTalk;
    }

    saveCheckin(record);

    logEvent("checkin_completed", {
      mood_today: hasMood ? moodToday : undefined,
      has_free_note: hasNote,
      quick,
    });

    setStatus("保存しました。ホーム画面に戻ります。");
  };

  const handleQuickChange = (next: boolean) => {
    setQuick(next);
    resetOptionalFieldsForQuick(next);
  };

  return (
    <main className="min-h-screen bg-[var(--bg,#f9fafb)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="self-start rounded-full bg-transparent px-3 py-1 text-sm text-indigo-600 underline decoration-dotted hover:text-indigo-700"
          >
            ← ホームに戻る
          </button>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            何でもトーク（チェックイン／Rの軽い導入）
          </h1>
          <p className="text-sm text-slate-600">
            本題の前に、いまの気分や近況を30秒で共有します。話したくなければスキップ可。
          </p>
        </header>

        <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-800" htmlFor="prompt">
              補助質問
            </label>
            <p id={PROMPT_DESCRIPTION_ID} className="text-sm text-slate-600">
              会話のきっかけに使ってください（1つだけ提示されます）。
            </p>
            <select
              id="prompt"
              aria-describedby={PROMPT_DESCRIPTION_ID}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={promptKey}
              onChange={(event) => setPromptKey(event.target.value as PromptKey)}
            >
              {PROMPTS.map((prompt) => (
                <option key={prompt.key} value={prompt.key}>
                  {prompt.label}
                </option>
              ))}
            </select>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700" role="note">
              {promptLabel}
            </div>
          </div>

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-slate-800">カテゴリタグ</legend>
              <p className="text-xs text-slate-500">
                タグは内省ログに保存され、後で検索できます。
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TAGS.map((tag) => (
                  <label
                    key={tag.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-indigo-300"
                  >
                    <input
                      type="radio"
                      name="tag"
                      value={tag.value}
                      checked={selectedTag === tag.value}
                      onChange={(event) => setSelectedTag(event.target.value)}
                      className="h-4 w-4"
                    />
                    <span>{tag.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3">
              <div>
                <span className="text-sm font-semibold text-indigo-700">クイック入力</span>
                <p id={QUICK_DESCRIPTION_ID} className="text-xs text-indigo-600">
                  ONで気分スコアだけを記録します。
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-indigo-700">
                <input
                  type="checkbox"
                  checked={quick}
                  onChange={(event) => handleQuickChange(event.target.checked)}
                  aria-describedby={QUICK_DESCRIPTION_ID}
                  className="h-5 w-5"
                />
                クイック
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-800" htmlFor="mood">
                気分スコア（0〜10）
              </label>
              <p id={MOOD_DESCRIPTION_ID} className="text-xs text-slate-500">
                0=かなり低い、10=最高の気分。スライダーで今の状態に近い数字を選んでください。
              </p>
              <input
                id="mood"
                type="range"
                min={0}
                max={10}
                step={1}
                value={typeof moodToday === "number" ? moodToday : 5}
                onChange={(event) => setMoodToday(Number.parseInt(event.target.value, 10))}
                aria-describedby={MOOD_DESCRIPTION_ID}
              />
              <span className="text-sm text-slate-600" aria-live="polite">
                現在の値: {typeof moodToday === "number" ? moodToday : "未選択"}
              </span>
            </div>

            {!quick && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="note">
                    近況ひとこと
                  </label>
                  <p id={NOTE_DESCRIPTION_ID} className="text-xs text-slate-500">
                    最大140文字。入力しなくても構いません。
                  </p>
                  <textarea
                    id="note"
                    maxLength={140}
                    value={freeNote}
                    onChange={(event) => setFreeNote(event.target.value)}
                    aria-describedby={NOTE_DESCRIPTION_ID}
                    className="h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <span className="self-end text-xs text-slate-400">
                    {freeNote.length}/140
                  </span>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-semibold text-slate-800">
                    軽い雑談をしますか？
                  </legend>
                  <p id={TALK_DESCRIPTION_ID} className="text-xs text-slate-500">
                    Rapport（安心感）づくりの希望を残せます。
                  </p>
                  <div className="flex gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
                      <input
                        type="radio"
                        name="smallTalk"
                        value="yes"
                        checked={wantSmallTalk === true}
                        onChange={() => setWantSmallTalk(true)}
                        aria-describedby={TALK_DESCRIPTION_ID}
                      />
                      はい
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm">
                      <input
                        type="radio"
                        name="smallTalk"
                        value="no"
                        checked={wantSmallTalk === false}
                        onChange={() => setWantSmallTalk(false)}
                        aria-describedby={TALK_DESCRIPTION_ID}
                      />
                      いいえ
                    </label>
                  </div>
                </fieldset>
              </>
            )}

            {error && (
              <div
                id={ERROR_ID}
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {status && (
              <div
                id={STATUS_ID}
                role="status"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                {status}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-700"
              >
                スキップ
              </button>
              <button
                type="submit"
                className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
                aria-describedby={[error ? ERROR_ID : null, status ? STATUS_ID : null]
                  .filter(Boolean)
                  .join(" ") || undefined}
                disabled={!isRestored}
              >
                保存
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
