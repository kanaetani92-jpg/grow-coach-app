// backend/src/auth.ts
import type { Request, Response, NextFunction } from "express";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp({ credential: applicationDefault() });

export async function getUidFromAuthHeader(authHeader?: string): Promise<string> {
  const header = authHeader || "";
  const m = header.match(/^Bearer (.+)$/i);
  if (!m) throw new Error("missing bearer token");
  const decoded = await getAuth().verifyIdToken(m[1]);
  return decoded.uid;
}

// ルートで使う用（Express ミドルウェア）
export async function verifyBearer(req: Request, res: Response, next: NextFunction) {
  try {
    const uid = await getUidFromAuthHeader(req.headers.authorization);
    (req as any).uid = uid;
    next();
  } catch (e) {
    res.status(401).json({ error: "invalid or missing token" });
  }
}
