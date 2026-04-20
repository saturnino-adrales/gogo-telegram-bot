# gogo-telegram-bot

Claude Codeの会話コンテキストをそのまま引き継ぐTelegramボットを起動するスキルです。スマホからClaude Codeと同じ操作ができます。

## インストール

1コマンドで完了:

```bash
npx gogo-telegram-bot
```

または手動で:

```bash
git clone https://github.com/saturnino-adrales/gogo-telegram-bot.git ~/.claude/skills/telegram-bot
cd ~/.claude/skills/telegram-bot/bot && npm install
```

## セットアップ

1. Telegramで[@BotFather](https://t.me/BotFather)にメッセージを送り、ボットトークンを取得
2. [@userinfobot](https://t.me/userinfobot)にメッセージを送り、自分のユーザーIDを取得
3. `~/.claude/telegram-bot.yml` を作成:

```yaml
telegram:
  bot_token: "ボットトークン"
  owner_id: ユーザーID（数字）
defaults:
  permission_level: readonly
  acl: []
```

## 使い方

Claude Codeのターミナルで:

```
/telegram-bot                # デフォルト権限で起動
/telegram-bot --full         # フルアクセス（読み書き・bash・エージェント）
/telegram-bot --standard     # 読み書き + bash
/telegram-bot --readonly     # 読み取り専用（デフォルト）
/telegram-bot ps             # 実行中のボット一覧
/telegram-bot stop           # 全ボット停止
/telegram-bot restart        # 再起動（権限レベル維持）
/telegram-bot kill <PID>     # 特定のボットを停止
```

## Telegramコマンド

ボットが起動したら、Telegramで以下のコマンドが使えます:

| コマンド | 説明 |
|---------|------|
| `/stop` | ボットを停止 |
| `/status` | 権限・稼働時間・作業ディレクトリを表示 |
| `/perms` | 許可されたツール一覧 |
| `/permlevel full` | 権限をリアルタイムで変更 |
| `/acl add <id>` | ユーザーを追加 |
| `/acl remove <id>` | ユーザーを削除 |
| `/context` | 注入されたコンテキストのサイズを表示 |
| `/reset` | 現在のSDKセッションをクリアしてやり直す |

## 権限レベル

| レベル | できること |
|--------|-----------|
| `readonly` | ファイル読み取り、検索、質問への回答 |
| `standard` | 上記 + ファイル編集、bashコマンド実行 |
| `full` | すべて（エージェント、MCP、書き込み、bash） |

## 主な機能

- Claude Codeの会話コンテキストを完全に引き継ぎ
- 3段階の権限レベル（readonly / standard / full）
- `/permlevel`でリアルタイム権限変更
- ACL（アクセス制御リスト）- デフォルトはオーナーのみ
- ツール使用状況のリアルタイム表示
- 中間テキストメッセージ（「確認中...」など）
- Telegram HTML対応フォーマット（太字、コード、テーブル、リンク）
- 画像・ファイル添付対応（写真、書類、音声、動画、ステッカーなど）
- コンテキスト上限エラー時の自動セッションローテーション（再起動不要で復旧）
- `/reset` で手動セッションクリア
- セッション内の会話記憶
- プロジェクトごとの設定オーバーライド

## 仕組み

このスキルはNode.jsプロセスを起動し:
1. Telegrafボットを作成し、Telegram Bot APIに接続
2. Claude Agent SDKセッションを会話コンテキスト付きで初期化
3. メッセージをブリッジ: Telegram → SDK → Telegram
4. ツール使用と中間応答をリアルタイムで表示
5. `/stop`送信またはプロセス終了で停止

## 設定の優先順位

スラッシュコマンド引数 > プロジェクト設定 > グローバル設定

- **グローバル**: `~/.claude/telegram-bot.yml`
- **プロジェクト**: `./telegram-bot.yml`（オプション、グローバルを上書き）
- **引数**: `--full`、`--acl 123,456`（すべてを上書き）

## 開発元

GoGo IT Lab

## 更新履歴

### 1.0.10 — 長時間処理中のサイレント停止を解消
- Telegrafの90秒 `handlerTimeout` を無効化（`Infinity`）。長時間のSDK/Agent呼び出しが途中でabortされなくなった
- Telegrafのミドルウェアエラーを `bot.catch` で捕捉
- `unhandledRejection` と `uncaughtException` 発生時、ログ出力に加えてオーナーにTelegram DMでエラー詳細（スタックトレース含む）を通知

### 1.0.9 — セッション耐障害性
- `/reset` コマンドを追加（現在のSDKセッションをクリア）
- コンテキスト上限エラー発生時、自動でセッションをローテーション（新規セッションで1回リトライ）
- `unhandledRejection` / `uncaughtException` をログ出力のみに変更（ボット停止を防止）

### 1.0.8 — PIDステートファイル
- 起動時と `/permlevel` / `/acl` 変更時に `/tmp/gogo-telegram-bot.state.json` を書き出し
- `/telegram ps|kill|stop|restart` が `kill -0 <pid>` で生存確認（`ps aux` 不使用）
- 正常終了時にステートファイル削除、発見時に古いファイルを自動クリーンアップ

### 1.0.7 — 添付ファイル対応
- Telegram添付ファイル（写真・書類・動画・音声・ボイス・ビデオノート・アニメーション・ステッカー）をダウンロードし、絶対パスでClaudeに渡す
- `<cwd>/.telegram-uploads/` 配下に保存
- テキスト・キャプション・添付のみのメッセージに対応

### 1.0.6 — プロセス制御の修正
- `/telegram stop` を `kill -9` とpgrep正規表現の修正で対応

### 1.0.5 — ボットプロセスのデタッチ
- `nohup` でClaude Code終了後もボットを生存

### 1.0.4以前
- インストーラがスキルルートに `SKILL.md` をコピー（Claude Codeの検出用）
- 日本語README追加
- `npx gogo-telegram-bot` ワンコマンドインストーラ
- GoGo IT Lab配下の `gogo-telegram-bot` にリネーム
- Claude Codeプラグイン構造に再編成（npm配布用）
- `/telegram restart` と `/telegram stop` サブコマンド追加
- ツール使用メッセージのHTMLエンティティエスケープ
- 中間テキストと最終結果が一致する場合も必ず最終結果を送信
