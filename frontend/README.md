+1
-1

# Grow Coach Frontend

Next.js アプリケーション。Firebase Authentication のメールリンク認証とバックエンド API を経由した AI コーチング体験を提供します。

## 開発環境の準備

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

`.env.local` に以下の環境変数を設定してください。

| 変数名 | 説明 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth ドメイン (例: `your-project.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase プロジェクト ID |
| `NEXT_PUBLIC_BACKEND_URL` | バックエンド API のベース URL。末尾が `/api` でない場合は自動的に付与されます。旧名称の `NEXT_PUBLIC_BACKEND_BASE_URL` も利用できます。未設定のままだとフロントエンドは Next.js の `/api` プレースホルダーにアクセスし、`405 Method Not Allowed` が発生します。開発環境では `http://localhost:8000` を指定します。|
| `NEXT_PUBLIC_APP_ORIGIN` | メールリンクで使用するアプリ公開 URL (開発環境では `http://localhost:3000`) |
| `NEXT_PUBLIC_LOG_ENDPOINT` (任意) | 追加のログ送信先エンドポイント |

Firebase コンソールでは Identity Platform/Firebase Authentication の許可ドメインに、ローカル (`localhost`)、Vercel の Preview/Production ドメインなどアプリで利用するホストを追加してください。メールリンクテンプレートでは送信者名と返信先を設定し、案内文に「Grow Coach ログインリンク」であることを明記します。

## 主要機能

- メールリンクサインイン（期限切れ・無効リンクの判定、再送機能付き）
- Firebase ID トークンを利用したセキュアな API 呼び出し（401 時のワンタイムリフレッシュ）
- チャット UI（会話履歴の復元、新規セッション作成、送信制限・再試行ボタン・ローディング表示）
- 利用規約/プライバシー/同意バナー
- 送受信イベントの軽量ロギング

## 注意事項

- メッセージは最大 800 文字まで。制御文字や絵文字は送信前に除去されます。
- ブラウザのローカルストレージに `activeSessionId` と `emailForSignIn` を保存します。
- バックエンド API エラー時はユーザー向けメッセージを表示し、再試行できます。

## トラブルシューティング

### 「サーバーに接続できませんでした」と表示される

1. `.env.local` に設定した `NEXT_PUBLIC_BACKEND_URL` が正しいか確認します。ローカル開発では `http://localhost:8000` を指定してください。
2. バックエンドが起動しているかを確認します。`cd ../backend && pnpm dev` を実行し、ログに `listening on http://localhost:8000` と表示されることを確認してください。
3. フロントエンドを再起動して環境変数の変更を反映させます。
4. それでも解決しない場合はブラウザの開発者ツールの Network タブで API リクエストの URL とレスポンスコードを確認し、CORS エラーなどを特定してください。
