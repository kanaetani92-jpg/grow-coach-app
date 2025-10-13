import { akitoPrompt } from "./akito.js";
import { kanonPrompt } from "./kanon.js";
import { narukaPrompt } from "./naruka.js";
import type { CoachType } from "./types.js";

export const coachPrompts: Record<CoachType, string> = {
  akito: akitoPrompt,
  kanon: kanonPrompt,
  naruka: narukaPrompt,
};

