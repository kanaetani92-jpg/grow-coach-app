// サーバーコンポーネント（表示だけ）
import EmailLinkForm from "@/components/EmailLinkForm";
import ChatClient from "@/components/ChatClient";

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0b141a] bg-[radial-gradient(circle_at_top,_#233138,_transparent_55%)] px-4 py-8 sm:px-10 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
        <section className="w-full rounded-3xl bg-[#1f2c34]/90 p-6 text-[#e9edef] shadow-2xl shadow-black/40 ring-1 ring-black/40 lg:w-[320px]">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Grow Coach
              </h1>
              <p className="mt-2 text-sm text-[#8696a0]">
                メールリンクでログインして、コーチとの会話を開始しましょう。
              </p>
            </div>
            <div className="rounded-2xl bg-[#111b21]/40 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#00a884]">
                サインイン
              </h2>
              <p className="mt-1 text-xs text-[#8696a0]">
                WhatsApp風のチャット画面でGrow Coachと会話するには、メールアドレスを入力してサインインリンクを受け取ってください。
              </p>
              <div className="mt-4">
                <EmailLinkForm />
              </div>
            </div>
          </div>
        </section>

        <section className="flex-1">
          <ChatClient />
        </section>
      </div>
    </main>
  );
}
