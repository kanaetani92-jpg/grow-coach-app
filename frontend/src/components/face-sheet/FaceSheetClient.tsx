"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import FaceSheetForm from "@/components/face-sheet/FaceSheetForm";
import {
  ApiError,
  type FaceSheet,
  fetchFaceSheet,
  saveFaceSheet,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

function createEmptyFaceSheet(): FaceSheet {
  return {
    basic: {
      nickname: "",
      honorifics: [],
      honorificOther: "",
      gender: [],
      genderOther: "",
      genderFreeText: "",
      age: "",
    },
    work: {
      role: "",
      organization: "",
      employmentTypes: [],
      employmentOther: "",
      workPatterns: [],
      workPatternOther: "",
      weeklyHours: "",
      stressors: "",
      supportResources: "",
    },
    family: {
      livingArrangement: "noAnswer",
      household: "",
      careResponsibilities: [],
      careOther: "",
      careTime: "",
    },
    personality: {
      traits: {
        extraversion: null,
        agreeableness: null,
        conscientiousness: null,
        emotionalStability: null,
        openness: null,
      },
      tags: [],
      tagOther: "",
      strengths: "",
      cautions: "",
    },
    lifeInventory: {
      areas: {
        sleep: { satisfaction: null, note: "" },
        nutrition: { satisfaction: null, note: "" },
        activity: { satisfaction: null, note: "" },
        work: { satisfaction: null, note: "" },
        learning: { satisfaction: null, note: "" },
        family: { satisfaction: null, note: "" },
        friends: { satisfaction: null, note: "" },
        hobby: { satisfaction: null, note: "" },
        finance: { satisfaction: null, note: "" },
        housing: { satisfaction: null, note: "" },
        physicalHealth: { satisfaction: null, note: "" },
        mental: { satisfaction: null, note: "" },
        rest: { satisfaction: null, note: "" },
        digital: { satisfaction: null, note: "" },
        timeManagement: { satisfaction: null, note: "" },
      },
      dailyRoutine: "",
    },
    coaching: {
      topics: [],
      topicOther: "",
      challenge: "",
      kpi: "",
    },
    safety: {
      concerns: [],
      concernOther: "",
      consent: false,
    },
  };
}

export default function FaceSheetClient() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [form, setForm] = useState<FaceSheet>(() => createEmptyFaceSheet());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  const authed = useMemo(() => Boolean(user), [user]);

  const callWithAuth = useCallback(
    async <T,>(callback: (token: string) => Promise<T>): Promise<T> => {
      const token = tokenRef.current;
      if (token) {
        return callback(token);
      }
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("サインインが必要です");
      }
      const freshToken = await currentUser.getIdToken();
      tokenRef.current = freshToken;
      return callback(freshToken);
    },
    [],
  );

  const loadFaceSheet = useCallback(async () => {
    if (!auth.currentUser) {
      setForm(createEmptyFaceSheet());
      setUpdatedAt(null);
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await callWithAuth((token) => fetchFaceSheet(token));
      if (response.faceSheet) {
        setForm(response.faceSheet);
      } else {
        setForm(createEmptyFaceSheet());
      }
      setUpdatedAt(response.updatedAt ?? null);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 404) {
        setForm(createEmptyFaceSheet());
        setUpdatedAt(null);
      } else {
        const message = getErrorMessage(loadError);
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [callWithAuth]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      tokenRef.current = null;
      if (next) {
        try {
          const token = await next.getIdToken();
          tokenRef.current = token;
        } catch (tokenError) {
          setError(getErrorMessage(tokenError));
        }
        await loadFaceSheet();
      } else {
        setForm(createEmptyFaceSheet());
        setUpdatedAt(null);
      }
    });
    return () => unsub();
  }, [loadFaceSheet]);

  const handleSave = useCallback(
    async (next: FaceSheet) => {
      setSaving(true);
      setError(null);
      setStatus(null);
      try {
        const result = await callWithAuth((token) => saveFaceSheet(next, token));
        setForm(result.faceSheet);
        setUpdatedAt(result.updatedAt);
        setStatus("フェイスシートを保存しました");
      } catch (saveError) {
        const message = getErrorMessage(saveError);
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [callWithAuth],
  );

  if (!authed) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">フェイスシート</h2>
        <p className="mt-3 text-sm text-slate-600">
          フェイスシートの登録・更新にはサインインが必要です。トップページからサインインし、再度アクセスしてください。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">フェイスシート</h1>
        <p className="mt-2 text-sm text-slate-600">
          初回に登録し、その後は必要に応じて更新してください。変更内容は保存ボタンを押したタイミングで反映されます。
        </p>
        {updatedAt ? (
          <p className="mt-2 text-xs text-slate-500">
            最終更新: {new Date(updatedAt).toLocaleString("ja-JP")}
          </p>
        ) : null}
      </header>
      <FaceSheetForm
        value={form}
        onChange={setForm}
        onSubmit={() => handleSave(form)}
        onRetry={loadFaceSheet}
        loading={loading}
        saving={saving}
        error={error}
        status={status}
      />
    </section>
  );
}
