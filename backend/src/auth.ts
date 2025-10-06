import { getAuth } from "firebase-admin/auth";
import { firebaseApp } from "./firebase.js";

const auth = getAuth(firebaseApp);

export async function verifyBearerToken(authorization?: string): Promise<string> {
  const header = authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) throw new Error("missing bearer token");

  const decoded = await auth.verifyIdToken(match[1]);
  return decoded.uid;