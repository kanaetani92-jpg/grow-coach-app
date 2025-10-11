export type TimeHorizon = "today" | "1w" | "3m" | "1y";

export type CheckinRecord = {
  id: string;
  created_at: string; // ISO
  mood_today?: number; // 0-10
  free_note?: string; // <=140
  want_small_talk?: boolean;
  quick?: boolean;
  meta?: { prompt_key?: "mood_oneword" | "recent_win" | "talk_style" };
  tags: string[]; // e.g., ['checkin','mood_share']
};

export type GoalRecord = {
  id: string;
  created_at: string;
  goal_text: string; // <=200 (quick: <=40)
  time_horizon: TimeHorizon;
  success_metric: string; // text or numeric string
  importance?: number; // 0-10
  tags: string[]; // ['goal_setting','vision_define']
};

export type OptionItem = {
  id: string;
  option_text: string; // required
  pros_cons: string; // required
};

export type OptionsRecord = {
  id: string;
  created_at: string;
  options: OptionItem[]; // 2..3
  chosen_option: string; // id
  criteria_note?: string; // 任意
  tags: string[]; // ['make_options','action_menu']
};

export type WillRecord = {
  id: string;
  created_at: string;
  if_then: string; // required
  barrier?: string;
  anti_barrier?: string;
  start_time: string; // ISO
  tags: string[]; // ['if_then_plan','action_plan']
};

export type GOWBundle = {
  goal: GoalRecord;
  options?: OptionsRecord;
  will?: WillRecord;
};
