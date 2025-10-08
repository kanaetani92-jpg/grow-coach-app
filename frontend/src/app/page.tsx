// サーバーコンポーネント（表示だけ）
import ChatClient from "@/components/ChatClient";
import SignInPanel from "@/components/SignInPanel";

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            アイコチ（GROW編）
          </h1>
          <p className="text-sm text-slate-600 sm:text-base">
            Grow Coach と一緒にゴールを整理し、行動計画を立てましょう。
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <section className="order-2 lg:order-1">
            <SignInPanel />
          </section>
          <section className="order-1 lg:order-2">
            <ChatClient />
          </section>
        </div>
      </div>
    </main>
  );
}