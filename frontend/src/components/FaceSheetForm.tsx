"use client";

export default function FaceSheetForm() {
  return (
    <details className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" defaultOpen>
      <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-slate-900">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">フェイスシート（基本設定）</h2>
          <p className="mt-1 text-sm text-slate-600">
            コーチとのセッション準備に向けて、現在の状況を整理しましょう。
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition-transform group-open:rotate-180 group-open:text-teal-700 group-open:border-teal-400 transform">
          開閉
        </span>
      </summary>

      <div className="mt-6 space-y-10 text-sm text-slate-800">
        <section className="space-y-6">
          <header>
            <h3 className="text-base font-semibold text-slate-900">1. 基本設定</h3>
            <p className="mt-1 text-xs text-slate-500">呼ばれ方や性別などの希望を教えてください。</p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Q1. 愛称（呼ばれたい名前）</span>
              <input
                type="text"
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="例：あいこ"
              />
            </label>
            <fieldset className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">Q2. 呼ばれ方の希望</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "さん",
                  "くん",
                  "ちゃん",
                  "呼び捨て",
                  "英名で",
                ].map((label) => (
                  <label key={label} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                    <span>{label}</span>
                  </label>
                ))}
                <label className="col-span-full flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>その他</span>
                  <input
                    type="text"
                    className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="自由記述"
                    aria-label="呼ばれ方 その他"
                  />
                </label>
              </div>
            </fieldset>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">Q3. 性別・ジェンダー</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "女性",
                  "男性",
                  "ノンバイナリー",
                  "トランス女性",
                  "トランス男性",
                  "Xジェンダー/その他",
                  "回答しない",
                ].map((label) => (
                  <label key={label} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                    <span>{label}</span>
                  </label>
                ))}
                <label className="col-span-full flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>自由記述</span>
                  <input
                    type="text"
                    className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="自由記述"
                    aria-label="性別・ジェンダー 自由記述"
                  />
                </label>
              </div>
            </fieldset>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Q4. 年齢（任意）</span>
              <input
                type="text"
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="例：35"
              />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-base font-semibold text-slate-900">2. お仕事</h3>
            <p className="mt-1 text-xs text-slate-500">お仕事に関する情報を教えてください。</p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Q6. 職種・役割</span>
              <input
                type="text"
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Q7. 所属（部署・施設名）</span>
              <input
                type="text"
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">Q8. 雇用形態</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {["常勤", "非常勤", "派遣", "学生"].map((label) => (
                  <label key={label} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                    <span>{label}</span>
                  </label>
                ))}
                <label className="col-span-full flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>その他</span>
                  <input
                    type="text"
                    className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="自由記述"
                    aria-label="雇用形態 その他"
                  />
                </label>
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">Q9. 勤務形態</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "日勤のみ",
                  "2交代",
                  "3交代",
                  "夜勤専従",
                  "フレックス/リモート",
                ].map((label) => (
                  <label key={label} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                    <span>{label}</span>
                  </label>
                ))}
                <label className="col-span-full flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>その他</span>
                  <input
                    type="text"
                    className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="自由記述"
                    aria-label="勤務形態 その他"
                  />
                </label>
              </div>
            </fieldset>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Q10. 週あたりの勤務時間（例：40h）</span>
              <input
                type="text"
                className="rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Q11. 現在の主なストレス要因</span>
              <textarea
                className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="例：人員不足、夜勤、役割不明瞭 など"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Q12. 頼れる支援資源</span>
              <textarea
                className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="同僚・上司・家族・外部支援等"
              />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-base font-semibold text-slate-900">3. 家族背景</h3>
            <p className="mt-1 text-xs text-slate-500">ご家庭の状況について教えてください。</p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">Q13. 同居</legend>
              {[
                "ひとり暮らし",
                "家族と同居",
                "同居者あり（家族以外）",
                "未回答",
              ].map((label) => (
                <label key={label} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Q14. 世帯構成</span>
              <textarea
                className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                placeholder="例：配偶者、子ども2人、祖母"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="flex flex-col gap-2 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">Q15. ケア責任</legend>
              {[
                "育児",
                "介護",
                "ペット",
                "なし",
              ].map((label) => (
                <label key={label} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>{label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                <span>その他</span>
                <input
                  type="text"
                  className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  placeholder="自由記述"
                  aria-label="ケア責任 その他"
                />
              </label>
            </fieldset>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Q16. 家事・育児・介護の担当/時間目安（1日/週）</span>
              <textarea
                className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-base font-semibold text-slate-900">4. 自分の性格特性</h3>
            <p className="mt-1 text-xs text-slate-500">自己評価や強みについて記入してください。</p>
          </header>
          <div className="space-y-4">
            <fieldset className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">
                Q18. 以下を自己評価してください（1=全く当てはまらない〜5=とても当てはまる）
              </legend>
              {[
                "外向性",
                "協調性",
                "誠実性",
                "情緒安定性",
                "開放性",
              ].map((trait) => (
                <div key={trait} className="flex flex-wrap items-center gap-3">
                  <span className="w-24 text-sm text-slate-700">・{trait}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <label key={score} className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name={`trait-${trait}`}
                          value={score}
                          className="h-4 w-4 border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                        />
                        <span>{score}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-3 py-3">
              <legend className="text-xs font-medium text-slate-600">Q19. 特性タグ（任意）</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  "論理的",
                  "共感的",
                  "慎重",
                  "挑戦的",
                  "計画的",
                  "柔軟",
                  "観察的",
                  "即断型",
                ].map((label) => (
                  <label key={label} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                    <span>{label}</span>
                  </label>
                ))}
                <label className="col-span-full flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>その他</span>
                  <input
                    type="text"
                    className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    placeholder="自由記述"
                    aria-label="特性タグ その他"
                  />
                </label>
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Q20. 強み（3つまで）</span>
                <textarea className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Q21. 留意したい傾向</span>
                <textarea className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-base font-semibold text-slate-900">5. 生活の棚卸し</h3>
            <p className="mt-1 text-xs text-slate-500">満足度とメモを記入しましょう（0〜10）。</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="w-36 px-3">領域</th>
                  <th className="w-32 px-3">満足度（0–10）</th>
                  <th className="px-3">一言メモ</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  "睡眠",
                  "食事",
                  "運動/身体活動",
                  "仕事",
                  "学習/自己研鑽",
                  "家族",
                  "友人/同僚",
                  "趣味/余暇",
                  "経済/家計",
                  "住環境",
                  "健康（身体）",
                  "メンタル/感情",
                  "休息/回復",
                  "デジタル/スマホ",
                  "時間管理",
                ].map((domain) => (
                  <tr key={domain} className="rounded-2xl">
                    <th scope="row" className="rounded-l-2xl bg-slate-50 px-3 py-2 text-slate-700">
                      {domain}
                    </th>
                    <td className="bg-white px-3 py-2 align-top">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        className="w-full rounded-xl border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                        aria-label={`${domain}の満足度`}
                      />
                    </td>
                    <td className="rounded-r-2xl bg-white px-3 py-2">
                      <textarea
                        className="h-16 w-full rounded-xl border border-slate-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                        aria-label={`${domain}の一言メモ`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Q23. 典型的な1日の流れ（起床〜就寝のタイムライン）</span>
            <textarea className="min-h-[6rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
          </label>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-base font-semibold text-slate-900">6. コーチとセッションしたいこと</h3>
            <p className="mt-1 text-xs text-slate-500">優先度の高いテーマに★を付けてください。</p>
          </header>
          <fieldset className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-3 py-3">
            <legend className="text-xs font-medium text-slate-600">Q24. テーマ候補</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                "睡眠/疲労",
                "ストレス/感情整理",
                "時間管理/先延ばし",
                "コミュニケーション",
                "キャリア/学習",
                "健康習慣（食/運動）",
                "金銭/家計",
                "対人関係",
                "セルフコンパッション",
                "自己効力感",
              ].map((label) => (
                <label key={label} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-2 focus:ring-amber-400"
                    aria-label={`${label}の優先度に★を付ける`}
                    title="優先度に★を付ける"
                  />
                </label>
              ))}
              <label className="col-span-full flex flex-wrap items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                <span>その他</span>
                <input
                  type="text"
                  className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  placeholder="自由記述"
                  aria-label="テーマ候補 その他"
                />
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-2 focus:ring-amber-400"
                  aria-label="その他のテーマに★を付ける"
                  title="優先度に★を付ける"
                />
              </label>
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Q25. 具体化したい課題</span>
              <textarea className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Q26. 達成の指標（KPI案）</span>
              <textarea className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <header>
            <h3 className="text-base font-semibold text-slate-900">7. 安全と境界（任意）</h3>
            <p className="mt-1 text-xs text-slate-500">
              必要に応じて安全上の情報や同意事項を記入してください。
            </p>
          </header>
          <fieldset className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-3 py-3">
            <legend className="text-xs font-medium text-slate-600">Q39. 最近の安全上の懸念（該当に✔）</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "特になし",
                "強い不眠の持続",
                "自傷他害の衝動",
                "家庭内暴力の懸念",
                "薬物/アルコールの問題",
              ].map((label) => (
                <label key={label} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                  <span>{label}</span>
                </label>
              ))}
              <label className="col-span-full flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
                <span>その他</span>
                <input
                  type="text"
                  className="grow rounded-2xl border border-slate-300 px-3 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  placeholder="自由記述"
                  aria-label="安全上の懸念 その他"
                />
              </label>
            </div>
          </fieldset>
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            ※このアプリは医療判断の代替ではありません。危機時は、主治医・産業保健・地域窓口・緊急（#7119/119）等へ。
          </p>
          <fieldset className="space-y-3 rounded-2xl border border-slate-200 px-3 py-3">
            <legend className="text-xs font-medium text-slate-600">任意の同意・共有</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500" />
              <span>
                同意：この回答内容をアプリ内のコーチング支援に利用することに同意します（撤回可）
              </span>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>共有範囲（任意：例）担当コーチのみ／チーム内限定／匿名で集計利用</span>
              <textarea className="min-h-[4.5rem] rounded-2xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
          </fieldset>
        </section>
      </div>
    </details>
  );
}
