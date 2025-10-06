import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = initializeApp({ credential: applicationDefault() });
export const db = getFirestore(app);
