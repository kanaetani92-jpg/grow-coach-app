// サーバーコンポーネント（表示だけ）
import ChatClient from "@/components/ChatClient";
import SignInPanel from "@/components/SignInPanel";

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-10 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-900/10 lg:w-[320px]">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                アイコチ（GROW編）
              </h1>
            </div>
            <SignInPanel />
          </div>
        </section>

        <section className="flex-1">
          <ChatClient />
        </section>
      </div>
    </main>
  );
}