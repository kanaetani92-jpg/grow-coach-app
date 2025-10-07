"use client";

const LOG_ENDPOINT = process.env.NEXT_PUBLIC_LOG_ENDPOINT;

export type LogEventName =
  | "session_created"
  | "coach_request"
  | "coach_response"
  | "coach_failure"
  | "history_restore_failed";

type LogPayload = Record<string, unknown>;

export function logEvent(event: LogEventName, payload: LogPayload = {}): void {
  const body = {
    event,
    payload,
    timestamp: new Date().toISOString(),
  };

  console.info(`[log] ${event}`, payload);

  if (typeof window === "undefined" || !LOG_ENDPOINT) return;

  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: "application/json" });
      navigator.sendBeacon(LOG_ENDPOINT, blob);
      return;
    }
    void fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
      keepalive: true,
    });
  } catch (error) {
    console.error("failed to send log", error);
  }
}