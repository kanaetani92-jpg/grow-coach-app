import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp({ credential: applicationDefault() });