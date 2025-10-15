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
- フェイスシート（`src/components/face-sheet/FaceSheetClient.tsx`）。フェイスシートの登録・更新画面で、保存説明文やサーバー接続エラー時のメッセージが表示されます。

## フェイスシートをサーバーに保存するには

1. バックエンドが起動しており、`NEXT_PUBLIC_BACKEND_URL` が正しく設定されていることを確認します（例: `http://localhost:8000`）。
2. フロントエンドのトップページからメールリンク認証でサインインします。未サインインの場合、フェイスシート画面は保存ボタンではなくサインインの案内を表示します。`FaceSheetClient` コンポーネントでサインイン状態を監視し、ID トークンを取得できた時点でフェイスシートを読み込みます。`src/components/face-sheet/FaceSheetClient.tsx`
3. `/face-sheet` ページにアクセスすると、現在保存されているフェイスシートを自動で読み込み、入力フォームが表示されます。読み込みに失敗した場合はエラーメッセージと再試行ボタンが表示されます。
4. 各項目を入力し、画面下部の「保存」ボタンを押すと `FaceSheetClient` が `saveFaceSheet` 関数を通じてバックエンド API (`PUT /face-sheet`) に送信します。成功すると「フェイスシートを保存しました」というステータスメッセージと最終更新日時が更新されます。

### API を直接呼び出す場合

`saveFaceSheet` は以下のように ID トークンを Bearer トークンとして指定し、`faceSheet` オブジェクトを JSON で送信します。`src/lib/api.ts`

```bash
curl -X PUT "${BACKEND_URL}/api/face-sheet" \
  -H "Authorization: Bearer <Firebase ID Token>" \
  -H "Content-Type: application/json" \
  -d '{
    "faceSheet": {
      "basic": {
        "nickname": "ユーザー名",
        "honorifics": ["san"],
        "gender": ["female"],
        "age": "30"
      }
      # ...省略...
    }
  }'
```

リクエストが成功すると、保存済みのフェイスシート本体と `createdAt` / `updatedAt` の UNIX タイムスタンプがレスポンスとして返されます。`backend/src/index.ts`

### GitHub と Codex のやりとりで保存を依頼する場合

ブラウザを利用できない PR レビューや GitHub 上での Codex とのやりとりでは、上記の HTTP リクエストを代わりに実行する Node.js スクリプトを用意しています。

1. `faceSheet` の内容を JSON ファイルに保存します。トップレベルが `faceSheet` オブジェクトでも、`{"faceSheet": {...}}` 形式でも構いません。
2. 一時的な Firebase ID トークンを発行し、共有時は GitHub シークレットや暗号化されたチャネルを利用してください。
3. バックエンドがアクセス可能な URL（例: `https://staging.example.com`）を確認します。末尾が `/api` でなくてもスクリプト側で付与されます。
4. 以下のコマンドを実行すると、Codex からでもフェイスシートを保存できます。

```bash
pnpm --filter frontend save-face-sheet \
  --backend-url "${BACKEND_URL}" \
  --token "${FIREBASE_ID_TOKEN}" \
  --file ./face-sheet.json
```

スクリプトは成功時にバックエンドのレスポンス JSON をそのまま標準出力へ表示します。失敗時はステータスコードとレスポンス本文をエラーとして表示するため、GitHub 上のやりとりでも結果を確認しやすくなります。`frontend/scripts/save-face-sheet.mjs`

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
