import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

export const app = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 既存
export const googleProvider = new GoogleAuthProvider();

// 追加: Apple / LINE（OIDC）
export const appleProvider = new OAuthProvider('apple.com');
// Identity Platform の「OIDC プロバイダID」に合わせる（例: oidc.line）
export const lineProvider  = new OAuthProvider('oidc.line');
