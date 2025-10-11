export type FlowDefinition = {
  slug: string;
  title: string;
  summary: string;
  tooltip: string;
  labelCandidates: Array<{ ui: string; tag: string }>;
  helperQuestions: string[];
  recordFields: string[];
  completionConditions: string[];
  quickVersion?: string[];
};

export const flowDefinitions: FlowDefinition[] = [
  {
    slug: "warmup-checkin",
    title: "① 何でもトーク（チェックイン／Rの軽い導入）",
    summary: "本題に入る前に気分や近況をさっと共有し、安心感をつくるウォームアップモジュールです。",
    tooltip:
      "本題の前に、いまの気分や近況を30秒で共有します。話したくなければスキップ可。",
    labelCandidates: [
      { ui: "ウォームアップ", tag: "warmup_checkin" },
      { ui: "チェックイン", tag: "checkin" },
      { ui: "気分シェア", tag: "mood_share" },
      { ui: "近況ひとこと", tag: "brief_update" },
      { ui: "安心トーク", tag: "rapport_talk" },
    ],
    helperQuestions: [
      "今日の気分を一言で言うと？（例：落ち着く／そわそわ／疲れ気味）",
      "最近“うまくいったこと”を1つ教えてください。",
      "今日は本題から入りますか？それとも軽く雑談しますか？",
    ],
    recordFields: [
      "mood_today (0–10)",
      "free_note (short)",
      "want_small_talk (yes/no)",
    ],
    completionConditions: ["mood_today入力 または free_note記入のいずれか"],
    quickVersion: ["気分スコア（0–10）のみ"],
  },
  {
    slug: "goal-design",
    title: "② 望む未来の実現に向けた対話（Goal）",
    summary:
      "実現したい未来像を言語化し、期間や達成の目安を明確にするゴール設定用モジュールです。",
    tooltip:
      "実現したい“望む未来”を言語化します。期間（今日／1週間／3か月／1年）と達成の目安を明確化します。",
    labelCandidates: [
      { ui: "ゴール設定", tag: "goal_setting" },
      { ui: "未来デザイン", tag: "future_design" },
      { ui: "ビジョン言語化", tag: "vision_define" },
      { ui: "目標を決める", tag: "decide_goal" },
      { ui: "方向づけ", tag: "set_direction" },
    ],
    helperQuestions: [
      "3か月後、何ができていたら“前進”と言えますか。",
      "1週間の“できた／できない”は何で測りますか（回数・時間・行動有無など）。",
      "そのゴールが“あなたにとって大事な理由”は何ですか。",
    ],
    recordFields: [
      "goal_text",
      "time_horizon (today/1w/3m/1y)",
      "success_metric (text/num)",
      "importance (0–10)",
    ],
    completionConditions: ["goal_text・time_horizon・success_metricが入力済"],
    quickVersion: ["期間（今日／1週間／3か月）＋40字ゴール"],
  },
  {
    slug: "options-design",
    title: "（O）案だし — Options",
    summary: "複数の選択肢を出して短所・長所を比較し、意思決定の材料をそろえるブレインストーミング向けモジュールです。",
    tooltip:
      "2–3個の選択肢を出し、短所・長所と選択基準で見比べます。",
    labelCandidates: [
      { ui: "選択肢づくり", tag: "make_options" },
      { ui: "対策アイデア", tag: "idea_pool" },
      { ui: "できる手", tag: "action_menu" },
    ],
    helperQuestions: [
      "他にどんなやり方がありますか？最低でももう1案出しましょう。",
      "各案の短所・長所を一言で。",
      "選ぶ基準は何ですか（時間／効果／負担など）。",
    ],
    recordFields: [
      "option_1/2/3 (text)",
      "pros_cons_1/2/3 (text)",
      "chosen_option (id)",
    ],
    completionConditions: [],
  },
  {
    slug: "will-design",
    title: "（W）踏み出し — Will",
    summary:
      "選んだ案をIf-Thenで具体的な一歩に落とし込み、開始タイミングや障壁対策まで合意する実行計画モジュールです。",
    tooltip:
      "“やる一歩”をIf-Thenで確定し、開始タイミングを決めます。",
    labelCandidates: [
      { ui: "一歩を決める", tag: "decide_step" },
      { ui: "実行プラン", tag: "action_plan" },
      { ui: "If-Then設定", tag: "if_then_plan" },
    ],
    helperQuestions: [
      "もし（状況）なら（行動）をする—1つ作ってください。",
      "実行の妨げになりそうな障壁は？その先回り策は？",
      "いつ始めますか（日時・所要）。",
    ],
    recordFields: [
      "if_then (text)",
      "barrier (text)",
      "anti_barrier (text)",
      "start_time (datetime)",
    ],
    completionConditions: [],
  },
];

const flowMap = new Map(flowDefinitions.map((flow) => [flow.slug, flow]));

export function getFlowBySlug(slug: string): FlowDefinition | undefined {
  return flowMap.get(slug);
}
