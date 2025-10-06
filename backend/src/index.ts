import express from "express";
import cors from "cors";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const PORT = parseInt(process.env.PORT || "8080", 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) { console.error("GEMINI_API_KEY is not set in .env"); process.exit(1); }

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).send("ok"));

type Msg = { role: "user" | "coach"; content: string; createdAt: number };
const memory: Record<string, Msg[]> = {};

const bodySchema = z.object({ sessionId: z.string(), userText: z.string().min(1) });

const systemPrompt = `
あなたはGROWモデル（Goal/Reality/Options/Will）に基づき、
傾聴（要約・感情の反映）と前進を促す質問で対話を進めるコーチです。
Wrap-up/Reviewまでが1サイクル。行動は「言い切り文＋測定＋ハードル対策」。
出力は JSON で {stage, message, next_fields} のみ。一度の質問は最大3つ。
`;

app.post("/api/sessions", (_req, res) => {
  const id = Math.random().toString(36).slice(2);
  memory[id] = [];
  res.json({ sessionId: id, stage: "G" });
});

app.post("/api/coach", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { sessionId, userText } = parsed.data;

  if (!memory[sessionId]) memory[sessionId] = [];
  const history = memory[sessionId];

  const parts = [
    { text: systemPrompt },
    ...history.map(m => ({ text: `${m.role.toUpperCase()}: ${m.content}` })),
    { text: `USER: ${userText}` },
    { text: 'JSONで {"stage":"G|R|O|W|Wrap|Review","message":"...","next_fields":["..."]} のみを返すこと。' }
  ];

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  const text = result.response.text();

  let payload: any;
  try { payload = JSON.parse(text); }
  catch { payload = { stage: "R", message: text, next_fields: [] }; }

  history.push({ role: "user",  content: userText,       createdAt: Date.now() });
  history.push({ role: "coach", content: payload.message, createdAt: Date.now() });

  res.json(payload);
});

app.listen(PORT, "0.0.0.0", () => console.log(`listening on ${PORT}`));
import { db } from "./db";

// セッション作成
app.post("/api/sessions", async (req, res) => {
  const uid = (req.body?.uid as string) || "anon";
  const id = Math.random().toString(36).slice(2);
  memory[id] = [];
  // Firestore: セッションメタを作成
  await db.collection("users").doc(uid)
    .collection("sessions").doc(id).set({
      createdAt: Date.now(), stage: "G"
    }, { merge: true });
  res.json({ sessionId: id, stage: "G" });
});

// コーチ応答（保存付き）
app.post("/api/coach", async (req, res) => {
  const { sessionId, userText, uid = "anon" } = req.body;
  // ... Gemini 応答を得る現行処理 ...

  // Firestore に append（サブコレクション messages）
  const ref = db.collection("users").doc(uid)
    .collection("sessions").doc(sessionId);
  const batch = db.batch();
  const msgs = ref.collection("messages");
  batch.set(msgs.doc(), { role: "user", content: userText, createdAt: Date.now() });
  batch.set(msgs.doc(), { role: "coach", content: payload.message, createdAt: Date.now() });
  batch.set(ref, { stage: payload.stage, updatedAt: Date.now() }, { merge: true });
  await batch.commit();

  res.json(payload);
});

// 履歴取得（新規）
app.get("/api/history", async (req, res) => {
  const { uid, sessionId } = req.query as { uid: string; sessionId: string };
  const snap = await db.collection("users").doc(uid)
    .collection("sessions").doc(sessionId)
    .collection("messages").orderBy("createdAt", "asc").get();
  const items = snap.docs.map(d => d.data());
  res.json({ messages: items });
});
