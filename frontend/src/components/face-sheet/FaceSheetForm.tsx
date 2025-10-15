import { useMemo, type ReactNode } from "react";

import {
  CARE_RESPONSIBILITIES,
  COACHING_TOPICS,
  EMPLOYMENT_TYPES,
  GENDER_OPTIONS,
  HONORIFIC_OPTIONS,
  LIFE_AREAS,
  LIVING_ARRANGEMENTS,
  PERSONALITY_TAGS,
  PERSONALITY_TRAITS,
  SAFETY_CONCERNS,
  WORK_PATTERNS,
  type CareResponsibilityOption,
  type CoachingTopicOption,
  type FaceSheet,
  type FaceSheetTopicSelection,
  type HonorificOption,
  type LifeAreaKey,
  type PersonalityTagOption,
  type WorkPatternOption,
} from "@/lib/api";

const HONORIFIC_LABELS: Record<HonorificOption, string> = {
  san: "さん",
  kun: "くん",
  chan: "ちゃん",
  noHonorific: "呼び捨て",
  english: "英名で",
  other: "その他",
};

const GENDER_LABELS: Record<(typeof GENDER_OPTIONS)[number], string> = {
  female: "女性",
  male: "男性",
  nonBinary: "ノンバイナリー",
  transWoman: "トランス女性",
  transMan: "トランス男性",
  xGender: "Xジェンダー/その他",
  noAnswer: "回答しない",
  other: "その他",
  selfDescribe: "自由記述",
};

const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  fullTime: "常勤",
  partTime: "非常勤",
  dispatch: "派遣",
  student: "学生",
  other: "その他",
};

const WORK_PATTERN_LABELS: Record<WorkPatternOption, string> = {
  day: "日勤のみ",
  twoShift: "2交代",
  threeShift: "3交代",
  nightOnly: "夜勤専従",
  flexRemote: "フレックス/リモート",
  other: "その他",
};

const CARE_RESPONSIBILITY_LABELS: Record<CareResponsibilityOption, string> = {
  childcare: "育児",
  caregiving: "介護",
  pets: "ペット",
  none: "なし",
  other: "その他",
};

const LIVING_ARRANGEMENT_LABELS: Record<(typeof LIVING_ARRANGEMENTS)[number], string> = {
  alone: "ひとり暮らし",
  withFamily: "家族と同居",
  withOthers: "同居者あり（家族以外）",
  noAnswer: "未回答",
};

const PERSONALITY_TAG_LABELS: Record<PersonalityTagOption, string> = {
  logical: "論理的",
  empathetic: "共感的",
  careful: "慎重",
  challenging: "挑戦的",
  planned: "計画的",
  flexible: "柔軟",
  observant: "観察的",
  quickDecider: "即断型",
  other: "その他",
};

const COACHING_TOPIC_LABELS: Record<CoachingTopicOption, string> = {
  sleepFatigue: "睡眠/疲労",
  stressCare: "ストレス/感情整理",
  timeManagement: "時間管理/先延ばし",
  communication: "コミュニケーション",
  careerLearning: "キャリア/学習",
  healthHabits: "健康習慣（食/運動）",
  finance: "金銭/家計",
  relationships: "対人関係",
  selfCompassion: "セルフコンパッション",
  selfEfficacy: "自己効力感",
  other: "その他",
};

const SAFETY_CONCERN_LABELS: Record<(typeof SAFETY_CONCERNS)[number], string> = {
  none: "特になし",
  insomnia: "強い不眠の持続",
  selfHarm: "自傷他害の衝動",
  domesticViolence: "家庭内暴力の懸念",
  substance: "薬物/アルコールの問題",
  other: "その他",
};

const LIFE_AREA_LABELS: Record<LifeAreaKey, string> = {
  sleep: "睡眠",
  nutrition: "食事",
  activity: "運動/身体活動",
  work: "仕事",
  learning: "学習/自己研鑽",
  family: "家族",
  friends: "友人/同僚",
  hobby: "趣味/余暇",
  finance: "経済/家計",
  housing: "住環境",
  physicalHealth: "健康（身体）",
  mental: "メンタル/感情",
  rest: "休息/回復",
  digital: "デジタル/スマホ",
  timeManagement: "時間管理",
};

const PERSONALITY_TRAIT_LABELS: Record<(typeof PERSONALITY_TRAITS)[number], string> = {
  extraversion: "外向性",
  agreeableness: "協調性",
  conscientiousness: "誠実性",
  emotionalStability: "情緒安定性",
  openness: "開放性",
};

type FaceSheetFormProps = {
  value: FaceSheet;
  onChange: (next: FaceSheet) => void;
  onSubmit: () => void;
  onRetry?: () => void;
  loading: boolean;
  saving: boolean;
  error: string | null;
  status: string | null;
};

export default function FaceSheetForm({
  value,
  onChange,
  onSubmit,
  onRetry,
  loading,
  saving,
  error,
  status,
}: FaceSheetFormProps) {
  const disabled = loading || saving;

  const selectedTopicIds = useMemo(
    () => new Set(value.coaching.topics.map((topic) => topic.id)),
    [value.coaching.topics],
  );
  const starredTopicIds = useMemo(
    () => new Set(value.coaching.topics.filter((topic) => topic.starred).map((topic) => topic.id)),
    [value.coaching.topics],
  );

  const handleBasicChange = (patch: Partial<FaceSheet["basic"]>) => {
    onChange({ ...value, basic: { ...value.basic, ...patch } });
  };

  const handleWorkChange = (patch: Partial<FaceSheet["work"]>) => {
    onChange({ ...value, work: { ...value.work, ...patch } });
  };

  const handleFamilyChange = (patch: Partial<FaceSheet["family"]>) => {
    onChange({ ...value, family: { ...value.family, ...patch } });
  };

  const handlePersonalityChange = (patch: Partial<FaceSheet["personality"]>) => {
    onChange({ ...value, personality: { ...value.personality, ...patch } });
  };

  const handleLifeInventoryChange = (patch: Partial<FaceSheet["lifeInventory"]>) => {
    onChange({ ...value, lifeInventory: { ...value.lifeInventory, ...patch } });
  };

  const handleCoachingChange = (patch: Partial<FaceSheet["coaching"]>) => {
    onChange({ ...value, coaching: { ...value.coaching, ...patch } });
  };

  const handleSafetyChange = (patch: Partial<FaceSheet["safety"]>) => {
    onChange({ ...value, safety: { ...value.safety, ...patch } });
  };

  const toggleHonorific = (option: HonorificOption, checked: boolean) => {
    const next = checked
      ? [...value.basic.honorifics, option]
      : value.basic.honorifics.filter((item) => item !== option);
    handleBasicChange({ honorifics: next });
  };

  const toggleGender = (option: (typeof GENDER_OPTIONS)[number], checked: boolean) => {
    const next = checked
      ? [...value.basic.gender, option]
      : value.basic.gender.filter((item) => item !== option);
    handleBasicChange({ gender: next });
  };

  const toggleEmploymentType = (option: (typeof EMPLOYMENT_TYPES)[number], checked: boolean) => {
    const next = checked
      ? [...value.work.employmentTypes, option]
      : value.work.employmentTypes.filter((item) => item !== option);
    handleWorkChange({ employmentTypes: next });
  };

  const toggleWorkPattern = (option: WorkPatternOption, checked: boolean) => {
    const next = checked
      ? [...value.work.workPatterns, option]
      : value.work.workPatterns.filter((item) => item !== option);
    handleWorkChange({ workPatterns: next });
  };

  const toggleCareResponsibility = (
    option: CareResponsibilityOption,
    checked: boolean,
  ) => {
    const next = checked
      ? [...value.family.careResponsibilities, option]
      : value.family.careResponsibilities.filter((item) => item !== option);
    handleFamilyChange({ careResponsibilities: next });
  };

  const togglePersonalityTag = (option: PersonalityTagOption, checked: boolean) => {
    const next = checked
      ? [...value.personality.tags, option]
      : value.personality.tags.filter((item) => item !== option);
    handlePersonalityChange({ tags: next });
  };

  const handleTraitChange = (key: (typeof PERSONALITY_TRAITS)[number], valueRaw: string) => {
    const parsed = valueRaw.trim() ? Number.parseInt(valueRaw, 10) : NaN;
    const nextValue = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 5) : null;
    handlePersonalityChange({ traits: { ...value.personality.traits, [key]: nextValue } });
  };

  const handleLifeAreaScoreChange = (key: LifeAreaKey, raw: string) => {
    const parsed = raw.trim() ? Number.parseInt(raw, 10) : NaN;
    const nextValue = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 0), 10)
      : null;
    handleLifeInventoryChange({
      areas: {
        ...value.lifeInventory.areas,
        [key]: { ...value.lifeInventory.areas[key], satisfaction: nextValue },
      },
    });
  };

  const handleLifeAreaNoteChange = (key: LifeAreaKey, note: string) => {
    handleLifeInventoryChange({
      areas: {
        ...value.lifeInventory.areas,
        [key]: { ...value.lifeInventory.areas[key], note },
      },
    });
  };

  const toggleTopic = (topic: CoachingTopicOption, checked: boolean) => {
    if (checked) {
      if (selectedTopicIds.has(topic)) return;
      handleCoachingChange({
        topics: [...value.coaching.topics, { id: topic, starred: false }],
      });
    } else {
      handleCoachingChange({
        topics: value.coaching.topics.filter((item) => item.id !== topic),
      });
    }
  };

  const toggleTopicStar = (topic: CoachingTopicOption) => {
    if (!selectedTopicIds.has(topic)) return;
    const nextTopics: FaceSheetTopicSelection[] = value.coaching.topics.map((item) =>
      item.id === topic ? { ...item, starred: !item.starred } : item,
    );
    const nextStarCount = nextTopics.filter((item) => item.starred).length;
    if (nextStarCount > 3) {
      return;
    }
    handleCoachingChange({ topics: nextTopics });
  };

  const toggleSafetyConcern = (
    option: (typeof SAFETY_CONCERNS)[number],
    checked: boolean,
  ) => {
    const next = checked
      ? [...value.safety.concerns, option]
      : value.safety.concerns.filter((item) => item !== option);
    handleSafetyChange({ concerns: next });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-6"
    >
      {loading ? (
        <p className="text-sm text-slate-500">フェイスシートを読み込み中です…</p>
      ) : null}
      {error ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={() => {
                if (disabled) return;
                onRetry();
              }}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
            >
              再試行
            </button>
          ) : null}
        </div>
      ) : null}
      {status ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
          {status}
        </div>
      ) : null}

      <Section title="1. 基本設定">
        <div className="space-y-4">
          <InputRow label="Q1. 愛称（呼ばれたい名前）">
            <input
              type="text"
              value={value.basic.nickname}
              onChange={(event) => handleBasicChange({ nickname: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：あいこち"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q2. 呼ばれ方の希望">
            <div className="flex flex-wrap gap-3">
              {HONORIFIC_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.basic.honorifics.includes(option)}
                    onChange={(event) => toggleHonorific(option, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{HONORIFIC_LABELS[option]}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              value={value.basic.honorificOther}
              onChange={(event) => handleBasicChange({ honorificOther: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="その他の希望があれば記入"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q3. 性別・ジェンダー">
            <div className="flex flex-wrap gap-3">
              {GENDER_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.basic.gender.includes(option)}
                    onChange={(event) => toggleGender(option, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{GENDER_LABELS[option]}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={value.basic.genderOther}
                onChange={(event) => handleBasicChange({ genderOther: event.target.value })}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="その他（自由記述）"
                disabled={disabled}
              />
              <input
                type="text"
                value={value.basic.genderFreeText}
                onChange={(event) => handleBasicChange({ genderFreeText: event.target.value })}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="自由記述"
                disabled={disabled}
              />
            </div>
          </InputRow>
          <InputRow label="Q4. 年齢（任意）">
            <input
              type="text"
              value={value.basic.age}
              onChange={(event) => handleBasicChange({ age: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：30"
              disabled={disabled}
            />
          </InputRow>
        </div>
      </Section>

      <Section title="2. お仕事">
        <div className="space-y-4">
          <InputRow label="Q6. 職種・役割">
            <input
              type="text"
              value={value.work.role}
              onChange={(event) => handleWorkChange({ role: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：看護師"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q7. 所属（部署・施設名）">
            <input
              type="text"
              value={value.work.organization}
              onChange={(event) => handleWorkChange({ organization: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：○○病院 ICU"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q8. 雇用形態">
            <div className="flex flex-wrap gap-3">
              {EMPLOYMENT_TYPES.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.work.employmentTypes.includes(option)}
                    onChange={(event) => toggleEmploymentType(option, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{EMPLOYMENT_LABELS[option]}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              value={value.work.employmentOther}
              onChange={(event) => handleWorkChange({ employmentOther: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="その他"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q9. 勤務形態">
            <div className="flex flex-wrap gap-3">
              {WORK_PATTERNS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.work.workPatterns.includes(option)}
                    onChange={(event) => toggleWorkPattern(option, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{WORK_PATTERN_LABELS[option]}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              value={value.work.workPatternOther}
              onChange={(event) => handleWorkChange({ workPatternOther: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="その他"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q10. 週あたりの勤務時間">
            <input
              type="text"
              value={value.work.weeklyHours}
              onChange={(event) => handleWorkChange({ weeklyHours: event.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：40h"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q11. 現在の主なストレス要因">
            <textarea
              value={value.work.stressors}
              onChange={(event) => handleWorkChange({ stressors: event.target.value })}
              className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：人員不足、夜勤、役割不明瞭など"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q12. 頼れる支援資源">
            <textarea
              value={value.work.supportResources}
              onChange={(event) => handleWorkChange({ supportResources: event.target.value })}
              className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：同僚、上司、家族、外部支援など"
              disabled={disabled}
            />
          </InputRow>
        </div>
      </Section>

      <Section title="3. 家族背景">
        <div className="space-y-4">
          <InputRow label="Q13. 同居">
            <div className="flex flex-wrap gap-3">
              {LIVING_ARRANGEMENTS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="living-arrangement"
                    value={option}
                    checked={value.family.livingArrangement === option}
                    onChange={() => handleFamilyChange({ livingArrangement: option })}
                    disabled={disabled}
                    className="h-4 w-4 border-slate-300"
                  />
                  <span>{LIVING_ARRANGEMENT_LABELS[option]}</span>
                </label>
              ))}
            </div>
          </InputRow>
          <InputRow label="Q14. 世帯構成">
            <textarea
              value={value.family.household}
              onChange={(event) => handleFamilyChange({ household: event.target.value })}
              className="min-h-[80px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：配偶者、子ども2人、祖母"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q15. ケア責任">
            <div className="flex flex-wrap gap-3">
              {CARE_RESPONSIBILITIES.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.family.careResponsibilities.includes(option)}
                    onChange={(event) => toggleCareResponsibility(option, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{CARE_RESPONSIBILITY_LABELS[option]}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              value={value.family.careOther}
              onChange={(event) => handleFamilyChange({ careOther: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="その他"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q16. 家事・育児・介護の担当/時間目安">
            <textarea
              value={value.family.careTime}
              onChange={(event) => handleFamilyChange({ careTime: event.target.value })}
              className="min-h-[80px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：平日2時間、休日4時間"
              disabled={disabled}
            />
          </InputRow>
        </div>
      </Section>

      <Section title="4. 自分の性格特性">
        <div className="space-y-4">
          <InputRow label="Q18. 自己評価（1=全く当てはまらない〜5=とても当てはまる）">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PERSONALITY_TRAITS.map((trait) => (
                <label key={trait} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <span>{PERSONALITY_TRAIT_LABELS[trait]}</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={value.personality.traits[trait] ?? ""}
                    onChange={(event) => handleTraitChange(trait, event.target.value)}
                    disabled={disabled}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
              ))}
            </div>
          </InputRow>
          <InputRow label="Q19. 特性タグ（任意）">
            <div className="flex flex-wrap gap-3">
              {PERSONALITY_TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.personality.tags.includes(tag)}
                    onChange={(event) => togglePersonalityTag(tag, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{PERSONALITY_TAG_LABELS[tag]}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              value={value.personality.tagOther}
              onChange={(event) => handlePersonalityChange({ tagOther: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="その他"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q20. 強み（3つまで）">
            <textarea
              value={value.personality.strengths}
              onChange={(event) => handlePersonalityChange({ strengths: event.target.value })}
              className="min-h-[80px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：傾聴力、計画性、チャレンジ精神"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q21. 留意したい傾向">
            <textarea
              value={value.personality.cautions}
              onChange={(event) => handlePersonalityChange({ cautions: event.target.value })}
              className="min-h-[80px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：完璧主義、先延ばしなど"
              disabled={disabled}
            />
          </InputRow>
        </div>
      </Section>

      <Section title="5. 生活の棚卸し（満足度0–10と一言メモ）">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border border-slate-200 text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="w-32 border-b border-r border-slate-200 px-3 py-2">領域</th>
                <th className="w-32 border-b border-r border-slate-200 px-3 py-2">満足度</th>
                <th className="border-b border-slate-200 px-3 py-2">一言メモ</th>
              </tr>
            </thead>
            <tbody>
              {LIFE_AREAS.map((area) => (
                <tr key={area} className="even:bg-slate-50">
                  <th scope="row" className="border-b border-r border-slate-200 px-3 py-2 font-medium">
                    {LIFE_AREA_LABELS[area]}
                  </th>
                  <td className="border-b border-r border-slate-200 px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={value.lifeInventory.areas[area].satisfaction ?? ""}
                      onChange={(event) => handleLifeAreaScoreChange(area, event.target.value)}
                      disabled={disabled}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border-b border-slate-200 px-3 py-2">
                    <input
                      type="text"
                      value={value.lifeInventory.areas[area].note}
                      onChange={(event) => handleLifeAreaNoteChange(area, event.target.value)}
                      disabled={disabled}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1"
                      placeholder="メモ"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InputRow label="Q23. 典型的な1日の流れ">
          <textarea
            value={value.lifeInventory.dailyRoutine}
            onChange={(event) => handleLifeInventoryChange({ dailyRoutine: event.target.value })}
            className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="起床〜就寝のタイムラインを記入"
            disabled={disabled}
          />
        </InputRow>
      </Section>

      <Section title="6. コーチとセッションしたいこと（優先TOP3に★）">
        <div className="space-y-4">
          <InputRow label="Q24. テーマ候補">
            <div className="flex flex-wrap gap-3">
              {COACHING_TOPICS.map((topic) => {
                const selected = selectedTopicIds.has(topic);
                const starred = starredTopicIds.has(topic);
                const starCount = starredTopicIds.size;
                const canStar = starred || starCount < 3;
                return (
                  <div
                    key={topic}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                      selected ? "border-teal-400 bg-teal-50" : "border-slate-300 bg-white"
                    }`}
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => toggleTopic(topic, event.target.checked)}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{COACHING_TOPIC_LABELS[topic]}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleTopicStar(topic)}
                      disabled={!selected || !canStar || disabled}
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        starred
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                      aria-pressed={starred}
                    >
                      ★
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">★は最大3件まで設定できます。</p>
            <input
              type="text"
              value={value.coaching.topicOther}
              onChange={(event) => handleCoachingChange({ topicOther: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="その他"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q25. 具体化したい課題">
            <textarea
              value={value.coaching.challenge}
              onChange={(event) => handleCoachingChange({ challenge: event.target.value })}
              className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：寝る前のスマホ時間を短くする"
              disabled={disabled}
            />
          </InputRow>
          <InputRow label="Q26. 達成の指標（KPI案）">
            <textarea
              value={value.coaching.kpi}
              onChange={(event) => handleCoachingChange({ kpi: event.target.value })}
              className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="例：週◯回／◯分、PSS低下など"
              disabled={disabled}
            />
          </InputRow>
        </div>
      </Section>

      <Section title="7. 安全と境界（任意）">
        <div className="space-y-4">
          <InputRow label="Q39. 最近の安全上の懸念">
            <div className="flex flex-wrap gap-3">
              {SAFETY_CONCERNS.map((concern) => (
                <label key={concern} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value.safety.concerns.includes(concern)}
                    onChange={(event) => toggleSafetyConcern(concern, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{SAFETY_CONCERN_LABELS[concern]}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              value={value.safety.concernOther}
              onChange={(event) => handleSafetyChange({ concernOther: event.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="その他"
              disabled={disabled}
            />
          </InputRow>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={value.safety.consent}
              onChange={(event) => handleSafetyChange({ consent: event.target.checked })}
              disabled={disabled}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>
              同意：この回答内容をアプリ内のコーチング支援に利用することに同意します（撤回可）
            </span>
          </label>
        </div>
      </Section>

      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
        >
          {saving ? "保存中" : "保存"}
        </button>
      </div>
    </form>
  );
}

type SectionProps = {
  title: string;
  children: ReactNode;
};

function Section({ title, children }: SectionProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-4 text-sm text-slate-700">{children}</div>
    </section>
  );
}

type InputRowProps = {
  label: string;
  children: ReactNode;
};

function InputRow({ label, children }: InputRowProps) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-slate-900">{label}</p>
      <div className="space-y-2 text-sm text-slate-700">{children}</div>
    </div>
  );
}
