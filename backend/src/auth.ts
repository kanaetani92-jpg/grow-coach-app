import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Request, Response, NextFunction } from "express";

initializeApp({ credential: applicationDefault() });

export async function verifyBearer(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/i);
  if (!m) return res.status(401).json({ error: "missing bearer token" });
  try {
    const decoded = await getAuth().verifyIdToken(m[1]);
    (req as any).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}
