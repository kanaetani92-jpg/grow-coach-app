"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var zod_1 = require("zod");
var generative_ai_1 = require("@google/generative-ai");
require("dotenv/config");
var PORT = parseInt(process.env.PORT || "8080", 10);
var GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in .env");
    process.exit(1);
}
var genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
var model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/health", function (_req, res) { return res.status(200).send("ok"); });
var memory = {};
var bodySchema = zod_1.z.object({ sessionId: zod_1.z.string(), userText: zod_1.z.string().min(1) });
var systemPrompt = "\n\u3042\u306A\u305F\u306FGROW\u30E2\u30C7\u30EB\uFF08Goal/Reality/Options/Will\uFF09\u306B\u57FA\u3065\u304D\u3001\n\u50BE\u8074\uFF08\u8981\u7D04\u30FB\u611F\u60C5\u306E\u53CD\u6620\uFF09\u3068\u524D\u9032\u3092\u4FC3\u3059\u8CEA\u554F\u3067\u5BFE\u8A71\u3092\u9032\u3081\u308B\u30B3\u30FC\u30C1\u3067\u3059\u3002\nWrap-up/Review\u307E\u3067\u304C1\u30B5\u30A4\u30AF\u30EB\u3002\u884C\u52D5\u306F\u300C\u8A00\u3044\u5207\u308A\u6587\uFF0B\u6E2C\u5B9A\uFF0B\u30CF\u30FC\u30C9\u30EB\u5BFE\u7B56\u300D\u3002\n\u51FA\u529B\u306F JSON \u3067 {stage, message, next_fields} \u306E\u307F\u3002\u4E00\u5EA6\u306E\u8CEA\u554F\u306F\u6700\u59273\u3064\u3002\n";
app.post("/api/sessions", function (_req, res) {
    var id = Math.random().toString(36).slice(2);
    memory[id] = [];
    res.json({ sessionId: id, stage: "G" });
});
app.post("/api/coach", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var parsed, _a, sessionId, userText, history, parts, result, text, payload;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                parsed = bodySchema.safeParse(req.body);
                if (!parsed.success)
                    return [2 /*return*/, res.status(400).json(parsed.error)];
                _a = parsed.data, sessionId = _a.sessionId, userText = _a.userText;
                if (!memory[sessionId])
                    memory[sessionId] = [];
                history = memory[sessionId];
                parts = __spreadArray(__spreadArray([
                    { text: systemPrompt }
                ], history.map(function (m) { return ({ text: "".concat(m.role.toUpperCase(), ": ").concat(m.content) }); }), true), [
                    { text: "USER: ".concat(userText) },
                    { text: 'JSONで {"stage":"G|R|O|W|Wrap|Review","message":"...","next_fields":["..."]} のみを返すこと。' }
                ], false);
                return [4 /*yield*/, model.generateContent({ contents: [{ role: "user", parts: parts }] })];
            case 1:
                result = _b.sent();
                text = result.response.text();
                try {
                    payload = JSON.parse(text);
                }
                catch (_c) {
                    payload = { stage: "R", message: text, next_fields: [] };
                }
                history.push({ role: "user", content: userText, createdAt: Date.now() });
                history.push({ role: "coach", content: payload.message, createdAt: Date.now() });
                res.json(payload);
                return [2 /*return*/];
        }
    });
}); });
app.listen(PORT, "0.0.0.0", function () { return console.log("listening on ".concat(PORT)); });
var db_1 = require("./db");
// セッション作成
app.post("/api/sessions", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var uid, id;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                uid = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.uid) || "anon";
                id = Math.random().toString(36).slice(2);
                memory[id] = [];
                // Firestore: セッションメタを作成
                return [4 /*yield*/, db_1.db.collection("users").doc(uid)
                        .collection("sessions").doc(id).set({
                        createdAt: Date.now(), stage: "G"
                    }, { merge: true })];
            case 1:
                // Firestore: セッションメタを作成
                _b.sent();
                res.json({ sessionId: id, stage: "G" });
                return [2 /*return*/];
        }
    });
}); });
// コーチ応答（保存付き）
app.post("/api/coach", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, sessionId, userText, _b, uid, ref, batch, msgs;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = req.body, sessionId = _a.sessionId, userText = _a.userText, _b = _a.uid, uid = _b === void 0 ? "anon" : _b;
                ref = db_1.db.collection("users").doc(uid)
                    .collection("sessions").doc(sessionId);
                batch = db_1.db.batch();
                msgs = ref.collection("messages");
                batch.set(msgs.doc(), { role: "user", content: userText, createdAt: Date.now() });
                batch.set(msgs.doc(), { role: "coach", content: payload.message, createdAt: Date.now() });
                batch.set(ref, { stage: payload.stage, updatedAt: Date.now() }, { merge: true });
                return [4 /*yield*/, batch.commit()];
            case 1:
                _c.sent();
                res.json(payload);
                return [2 /*return*/];
        }
    });
}); });
// 履歴取得（新規）
app.get("/api/history", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, uid, sessionId, snap, items;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.query, uid = _a.uid, sessionId = _a.sessionId;
                return [4 /*yield*/, db_1.db.collection("users").doc(uid)
                        .collection("sessions").doc(sessionId)
                        .collection("messages").orderBy("createdAt", "asc").get()];
            case 1:
                snap = _b.sent();
                items = snap.docs.map(function (d) { return d.data(); });
                res.json({ messages: items });
                return [2 /*return*/];
        }
    });
}); });
var auth_1 = require("./auth");
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/health", function (_, res) { return res.send("ok"); });
// セッション作成/履歴取得/コーチAPI を認証保護
app.post("/api/sessions", auth_1.verifyBearer, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var uid;
    return __generator(this, function (_a) {
        uid = req.uid;
        return [2 /*return*/];
    });
}); });
app.post("/api/coach", auth_1.verifyBearer, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var uid;
    return __generator(this, function (_a) {
        uid = req.uid;
        return [2 /*return*/];
    });
}); });
app.get("/api/history", auth_1.verifyBearer, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var uid;
    return __generator(this, function (_a) {
        uid = req.uid;
        return [2 /*return*/];
    });
}); });
