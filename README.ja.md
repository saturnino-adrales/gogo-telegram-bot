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
- 長時間セッションの自動コンパクション
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
