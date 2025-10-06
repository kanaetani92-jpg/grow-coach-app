"use client";
import { useEffect, useState } from "react";
import { completeEmailLink } from "@/lib/emailLink";

export default function EmailComplete() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    completeEmailLink(window.location.href).then(ok => setDone(ok));
  }, []);
  return <div className="p-6">{done ? "サインイン完了！" : "処理中…"}</div>;
}
import { startEmailLink } from "@/lib/emailLink";
const [email, setEmail] = useState("");
<button onClick={() => startEmailLink(email)}>メールでログインリンクを送る</button>
