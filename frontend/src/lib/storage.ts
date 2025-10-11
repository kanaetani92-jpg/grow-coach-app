"use client";

import type {
  CheckinRecord,
  GOWBundle,
  GoalRecord,
  OptionsRecord,
  WillRecord,
} from "@/types/records";

const CHECKIN_PREFIX = "checkins/";
const CHECKIN_LATEST_KEY = "checkins/latestId";
const GOW_PREFIX = "gow/";
const GOW_CURRENT_ID_KEY = "gow/currentBundleId";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function parseJSON<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("failed to parse localStorage JSON", error);
    return undefined;
  }
}

export function saveCheckin(record: CheckinRecord): void {
  if (!isBrowser()) return;
  localStorage.setItem(`${CHECKIN_PREFIX}${record.id}`, JSON.stringify(record));
  localStorage.setItem(CHECKIN_LATEST_KEY, record.id);
}

export function loadLatestCheckin(): CheckinRecord | undefined {
  if (!isBrowser()) return undefined;
  const latestId = localStorage.getItem(CHECKIN_LATEST_KEY);
  if (latestId) {
    const record = parseJSON<CheckinRecord>(
      localStorage.getItem(`${CHECKIN_PREFIX}${latestId}`),
    );
    if (record) return record;
  }

  let newest: CheckinRecord | undefined;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CHECKIN_PREFIX)) {
      const record = parseJSON<CheckinRecord>(localStorage.getItem(key));
      if (!record) continue;
      if (!newest || newest.created_at < record.created_at) {
        newest = record;
      }
    }
  }

  if (newest) {
    localStorage.setItem(CHECKIN_LATEST_KEY, newest.id);
  }

  return newest;
}

export function getOrCreateCurrentBundleId(): string | undefined {
  if (!isBrowser()) return undefined;
  const existing = localStorage.getItem(GOW_CURRENT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(GOW_CURRENT_ID_KEY, id);
  return id;
}

export function setCurrentBundleId(id: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(GOW_CURRENT_ID_KEY, id);
}

export function saveGoalRecord(bundleId: string, record: GoalRecord): void {
  if (!isBrowser()) return;
  localStorage.setItem(`${GOW_PREFIX}${bundleId}/goal`, JSON.stringify(record));
}

export function loadGoalRecord(bundleId: string): GoalRecord | undefined {
  if (!isBrowser()) return undefined;
  return parseJSON<GoalRecord>(localStorage.getItem(`${GOW_PREFIX}${bundleId}/goal`));
}

export function saveOptionsRecord(bundleId: string, record: OptionsRecord): void {
  if (!isBrowser()) return;
  localStorage.setItem(`${GOW_PREFIX}${bundleId}/options`, JSON.stringify(record));
}

export function loadOptionsRecord(bundleId: string): OptionsRecord | undefined {
  if (!isBrowser()) return undefined;
  return parseJSON<OptionsRecord>(
    localStorage.getItem(`${GOW_PREFIX}${bundleId}/options`),
  );
}

export function saveWillRecord(bundleId: string, record: WillRecord): void {
  if (!isBrowser()) return;
  localStorage.setItem(`${GOW_PREFIX}${bundleId}/will`, JSON.stringify(record));
}

export function loadWillRecord(bundleId: string): WillRecord | undefined {
  if (!isBrowser()) return undefined;
  return parseJSON<WillRecord>(localStorage.getItem(`${GOW_PREFIX}${bundleId}/will`));
}

export function loadGowBundle(bundleId: string): GOWBundle | undefined {
  if (!isBrowser()) return undefined;
  const goal = loadGoalRecord(bundleId);
  if (!goal) return undefined;
  const options = loadOptionsRecord(bundleId);
  const will = loadWillRecord(bundleId);
  return { goal, options, will };
}

export function createNewBundleId(): string | undefined {
  if (!isBrowser()) return undefined;
  const id = crypto.randomUUID();
  localStorage.setItem(GOW_CURRENT_ID_KEY, id);
  return id;
}
