import { auth } from "./firebase";
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";

export async function startEmailLink(email: string) {
  const actionCodeSettings = {
    url: `${window.location.origin}/email-link-complete`, // 受け取りページ
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem("emailForSignIn", email);
}

export async function completeEmailLink(currentUrl: string) {
  if (!isSignInWithEmailLink(auth, currentUrl)) return false;
  let email = window.localStorage.getItem("emailForSignIn") || "";
  if (!email) {
    email = window.prompt("サインイン用メールを入力してください") || "";
  }
  await signInWithEmailLink(auth, email, currentUrl);
  window.localStorage.removeItem("emailForSignIn");
  return true;
}
