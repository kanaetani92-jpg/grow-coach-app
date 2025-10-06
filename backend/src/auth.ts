import type { Request, Response, NextFunction } from "express";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// 初期化（Cloud Run では ADC を利用）
initializeApp({ credential: applicationDefault() });

export async function verifyBearer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization || "";
  const m = header.match(/^Bearer (.+)$/i);
  if (!m) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  try {
    const decoded = await getAuth().verifyIdToken(m[1]);
    (req as any).uid = decoded.uid;
    next();
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
}
