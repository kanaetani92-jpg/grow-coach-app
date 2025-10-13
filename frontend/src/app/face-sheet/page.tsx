import FaceSheetClient from "@/components/face-sheet/FaceSheetClient";

export const metadata = {
  title: "フェイスシート | アイコチ（GROW編）",
};

export default function FaceSheetPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <FaceSheetClient />
      </div>
    </main>
  );
}
