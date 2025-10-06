// サーバーコンポーネント（表示だけ）
import EmailLinkForm from "@/components/EmailLinkForm";
import ChatClient from "@/components/ChatClient";

export default function Page() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Grow Coach</h1>
      <EmailLinkForm />
      <ChatClient />
    </main>
  );
}
