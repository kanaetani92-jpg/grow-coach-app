import { getFirestore } from "firebase-admin/firestore";
import { firebaseApp } from "./firebase.js";

export const db = getFirestore(firebaseApp);