function normalizeMessage(message: string): string {
  if (!message) return "不明なエラーが発生しました。";

  if (/Failed to fetch/i.test(message) || /NetworkError/i.test(message)) {
    return "サーバーに接続できませんでした。ネットワーク環境を確認して再試行してください。";
  }

  if (/auth\//i.test(message)) {
    return "認証に失敗しました。もう一度お試しください。";
  }

  return message;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return normalizeMessage(error.message);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return normalizeMessage((error as { message: string }).message);
  }

  if (typeof error === "string") {
    return normalizeMessage(error);
  }

  return normalizeMessage(String(error));
}