// サーバーコンポーネント（表示だけ）
import ChatClient from "@/components/ChatClient";
import SignInPanel from "@/components/SignInPanel";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0b141a] bg-[radial-gradient(circle_at_top,_#233138,_transparent_55%)] px-4 py-8 sm:px-10 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
        <section className="w-full rounded-3xl bg-[#1f2c34]/90 p-6 text-[#e9edef] shadow-2xl shadow-black/40 ring-1 ring-black/40 lg:w-[320px]">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
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