export const COACH_TYPES = ["akito", "kanon", "naruka"] as const;

export type CoachType = (typeof COACH_TYPES)[number];
