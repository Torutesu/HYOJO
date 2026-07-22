# HYOJO Webアプリ 実装計画 v1.0

## 目的と前提

この計画は、要件定義書 v2.0 を満たす**ユーザー向けWebアプリ**を、既存の Expo モバイルアプリ・管理Webとは別に実装するためのものです。

- 新規アプリ: `apps/web`
- 技術: Next.js App Router / TypeScript / React
- 日常UIは **Home / Detail / Speak / Huddle** の4画面だけ。Admin は既存 `apps/admin` に限定する
- Web版はモバイル幅を最優先にし、PCでは中央に単一作業面として表示する
- API・永続化・監査・ACL は既存 `apps/api` を拡張して共用する
- ユーザーに Space / Topic / Conversation / チャンネル / 検索 / DM を露出しない

## 成果物

1. URLで開いて操作できるWebアプリ（認証後のユーザー体験）
2. Speak → AIルーティング → AIの語り → 判断／Huddle → Memory・TODO の一連の動作
3. ja/en表示、原文参照、用語集、Ask、見習いモードを含む Phase 1 の体験
4. HuddleはWebRTC/LiveKitを使った音声・画面共有・字幕・終了後の記録表示
5. 既存Adminから ACL・監査・用語集・メータリングを確認できる状態

## 実装原則

| 守ること | 実装上の判断 |
| --- | --- |
| Push Only | 初期画面はAIの語り。履歴一覧・フィードを置かない |
| Zero-Filing | Speakに投稿先・宛先・タグ入力を置かない |
| One Context | Detail / Huddle / Askは同じ決定・記録オブジェクトを読む |
| Language-Transparent | 原文は保存、閲覧時に翻訳。原文トグルだけを露出 |
| ACL first | ルーティング、Memory、Huddle、翻訳すべてでSpace境界を先に検査 |
| 可逆・監査 | AIの分類、再配送、記録、TODO完了、エージェント実行を監査イベント化 |

## フェーズ0 — Web基盤とレビュー可能な縦切り（3〜5日）

### 新設

- `apps/web`: Next.js アプリ、Web用の認証・APIクライアント・LiveKitクライアントを配置
- `packages/ui`: HYOJO固有の最小コンポーネント（NarrationCard / DecisionCard / SpeakComposer / SourceSheet / HuddleOverlay）
- `apps/web/.env.example`: `NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_LIVEKIT_URL` を定義。秘密鍵は一切置かない

### 最初に完成させる縦切り

1. `/` HomeでAIの朝の語りを表示
2. 画面下部の常設Speakから自然文を送る
3. APIがルーティング結果を返し、語り／判断カードを更新
4. 判断を選ぶと監査イベントが記録され、Detailへ遷移
5. Huddle提案から録画方針の確認、参加、終了後の要約表示まで遷移

### 受入条件

- モバイル幅360pxで片手操作できる
- 日常UIにチャンネル、検索窓、DM、宛先セレクターがない
- Speakが失敗しても、入力内容を保持し再送できる
- APIがない場合も、明確なオフライン／再試行表示を出す

## フェーズ1 — 画面実装（1〜2週）

### S1 Home: AIの語り

- 朝ブリーフィング、夕クロージング、オンデマンド「今どうなってる？」
- 3秒／30秒／3分の深さをカードごとに選べる
- 判断が必要なものだけに、承認・比較・Huddle提案の操作を置く
- 未応答カードは未読表示をせず、次の語りで再構成する
- 週次精度レポートとTime Savedを、語りの一部として表示

### S2 Detail: 深く聞く

- ひとつの論点をAIの言葉で説明
- 決定、根拠、TODO、関連する過去決定を表示
- 「原文を見せて」で出典メッセージをシート表示
- 翻訳表示中は控えめな翻訳インジケーターと原文トグルを表示
- Speakを常設して、追加説明や訂正を同一コンテキストへ送る

### S3 Speak: 話す

- テキスト入力、音声入力、Speakプレビュー（見習いモードは初期ON）
- 高確信度: 無言配送。中確信度: 「○○に届けました」。低確信度: 2〜3候補を1タップ選択
- 「重要」を送れる。送信者には未達／催促状態を見せない
- 誤配送の修正は1タップ。ACL境界を跨ぐ候補は明示確認する
- Askは別検索画面を作らず、Speakで質問文を送る

### S4 Huddle: 集まる

- AI提案またはSpeak意図からのみHuddleを生成（一覧の開始ボタンは作らない）
- 参加前の録音・文字起こし同意、記録なしモード、30秒サマリー選択
- 音声、映像、画面共有、参加者表示、終了操作
- 日英の二言語字幕、遅延参加者への30秒キャッチアップ
- 終了後はS1の次の語りへ要約・決定・TODOを統合

### S5 Admin: 既存管理Webを拡張

- Space ACL、録画・保持方針、用語集承認、エージェント抑制、監査ログ
- 日常ユーザー向けWebにはこれらを露出しない

## フェーズ2 — API・データモデル（並行、1〜2週）

既存の Huddle / Memory / Audit を以下へ拡張します。

| モデル | 追加する主な責務 |
| --- | --- |
| Workspace / Space | テナント分離、ACL、プライベートMemory除外 |
| Message | 原文、言語、外部由来フラグ、配送状態、出典 |
| RoutingDecision | 候補、確信度、ユーザー訂正、再配送、監査 |
| Narration | 対象ユーザー、深さ、応答要否、再構成履歴 |
| Decision | 決定内容、理由、決定者、出典、上書きチェーン |
| Memory | Wiki断片、決定、関連度、出典Message |
| Translation | 原文ID、対象言語、訳文、用語集バージョン、フィードバック |
| Preference | Named Preference、信頼スコア、見習いモード状態 |
| MeteringEvent | 配送、翻訳、AI生成、Huddle文字起こし、エージェント実行 |

### API追加順

1. `/v1/narrations/current`、`/v1/narrations/:id`、`/v1/speak`
2. `/v1/routing-decisions/:id/correct`、`/v1/messages/:id/source`
3. `/v1/ask`、`/v1/decisions/:id`、`/v1/memory/*`
4. `/v1/translations/*`、`/v1/preferences/*`
5. Huddleの字幕・画面共有・参加キャッチアップ、メータリング

## フェーズ3 — AI実装（段階的に有効化）

### まずルール＋構造化出力で開始

- JSON Schemaで `route / confidence / narration / surface / citations / actions` を強制
- 許可されたUI SurfaceだけをWebへ返す。任意HTMLや任意コンポーネントは返さない
- LLM障害時は、メッセージ保存・ルーティング保留・再処理キューへ退避

### 実装する内部エージェント

- Librarian: ルーティング、決定抽出、Memory更新
- Concierge: Ask、Huddle調整、語りの編集
- Scribe: Huddle字幕、議事録、TODO

各エージェントは同じACLコンテキストを受け、外部テキストの命令を実行しない。MCP実行は明示許可されたアクションだけに限定する。

## フェーズ4 — 品質・セキュリティ・運用（継続）

- JWT/OIDCをWebへ接続し、開発用 `x-hyojo-actor` を本番から排除
- PostgreSQL RLSまたはSpace ID条件を全クエリで強制し、越境テストを追加
- レート制限、監査イベントの不変化、保持期限ワーカー、削除証跡
- OpenTelemetry / エラー監視 / AI失敗率 / 翻訳レイテンシ / 語り生成時間を計測
- Playwrightによるモバイル幅E2E: Speak、低確信度修正、原文表示、Huddle同意、TODO、ACL拒否
- CI: 型検査、APIスモーク、PostgreSQL統合、Web build、E2E、依存脆弱性確認

## リリース計画

### Alpha（社内3〜10人）

- Home / Speak / Detail / Ask / Huddle音声の最小版
- ja/en、原文表示、監査、ACL、見習いモード
- 実データは限定Space、記録ポリシーはrequired/optionalを明示

### Beta（1チーム）

- Huddle字幕・議事録、Decision Registry、週次精度レポート、用語集
- メータリングと利用規約（翻訳・AI判断免責）
- 翻訳 <1秒、語り初回表示 <2秒を計測して改善

### Production readiness

- OIDC、テナント分離、データ削除手順、バックアップ、障害対応
- LLM障害時のgraceful degradationを障害訓練で確認
- TestFlight/ネイティブ版はWeb版で価値検証後に並行再開

## 最初の実装スプリント（着手順）

1. `apps/web` を作成し、Web専用の認証・APIクライアントを接続
2. S1 HomeとS3 Speakを実APIで接続（静的レビュー画面を置換）
3. S2 Detailと出典シート、Decision Registry最小版を実装
4. RoutingDecisionと低確信度修正を実装
5. ja/en翻訳・原文トグル・Glossary最小版を実装
6. Web LiveKit Huddle、字幕、Scribe結果を実装
7. 見習いモード、Named Preferences、精度レポート、メータリングを実装
8. Alpha運用・ACL・負荷・障害時の検証を通して公開

## 現時点で決めるべきこと

1. AIの語りの一人称・トーン（要件の未決事項 #2）
2. Web版の初期認証方法（Google Workspace OIDCを推奨）
3. Alpha対象の最初のSpaceと参加者
4. LiveKit / 文字起こし / LLM / Postgresの本番サービス選定と予算上限
5. Speakプレビューの初期値（要件に沿ってONを推奨）
