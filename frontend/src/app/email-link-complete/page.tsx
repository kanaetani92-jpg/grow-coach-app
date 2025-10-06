'use client';

import { useEffect, useState } from 'react';
// 必要ならユーティリティを使う
// import { completeEmailLink } from '@/lib/emailLink';

export default function EmailLinkCompletePage() {
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        // ここでメールリンクの完了処理を行う
        // await completeEmailLink();
        setStatus('ok');
        setMessage('メールリンクを確認しました。サインイン完了です。');
      } catch (e: unknown) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'エラーが発生しました。');
      }
    })();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">メールリンク認証</h1>
      {status === 'pending' && <p>確認中...</p>}
      {status !== 'pending' && <p>{message}</p>}
    </main>
  );
}
