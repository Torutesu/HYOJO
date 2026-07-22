# HYOJO ローカル実機デモ

## 1. APIを起動する

```bash
npm install
npm run dev:api
```

別のターミナルで、起動を確認します。

```bash
curl http://127.0.0.1:8787/readyz
```

ローカルの初期状態では `storage.persistent: false` と `recording: development-memory` が返ります。これは安全なプロトタイプモードです。

## 2. スマホへ接続する

Macとスマホを同じWi-Fiに接続し、MacのLAN IPを確認します。例: `192.168.1.9`。

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.9:8787 npm run dev:mobile
```

LiveKitを使うHuddle通話はネイティブWebRTCを使うため、Expo GoではなくExpo development buildで開きます。初回だけ `npx eas-cli build --profile development --platform ios`（Androidは `android`）で端末へ開発ビルドを入れてください。`apps/mobile/.env.example` を `.env` にコピーし、MacのLAN IPを設定してから `npm run dev:mobile` を起動します。LiveKit環境変数が未設定の間も、Speak、判断の承認、録画ポリシーの確認、Huddleの作成・取消、結果画面までは確認できます。実通話の参加は設定不足を明示して停止します。

## 3. 管理画面を開く

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8787 npm run dev:admin
```

ブラウザで `http://localhost:3000` を開くと、Product Spaceの記録・保持・Memory登録ポリシーと監査ログを確認できます。
