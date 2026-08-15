# Quota Dock

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

Quota Dock は、DeepSeek、ChatGPT Plus、OpenCode Go、およびカスタム AI プロバイダーのローカル利用状況と利用枠を確認するための、コンパクトな Windows デスクトップダッシュボードです。

## 主な機能

- DeepSeek API の残高を表示します。
- 現在の ChatGPT Plus セッションの利用枠を表示します。
- OpenCode Go の直近 5 時間、週間、月間の利用率とリセット時刻を表示します。
- 設定した月額 USD と月間利用率から、OpenCode Go の残り USD 枠を推定します。
- カスタム JSON 利用枠エンドポイントを追加できます。
- 最小化すると Windows の通知領域に入り、トレイアイコンから復元できます。
- 既定で Windows 起動時に自動起動し、トレイメニューの「Windows と同時に起動」で切り替えられます。
- Shift キーを押しながらタイトル領域をドラッグすると、パネルを移動できます。

## インストール

1. [最新リリース](https://github.com/shixiliya1/quota-dock/releases/latest) を開きます。
2. 最新の Windows ポータブル版 `.exe` をダウンロードします。
3. ファイルをダブルクリックして実行します。セットアップウィザードは不要です。
4. Windows SmartScreen が表示された場合は、**詳細情報** を選択してから **実行** を選択してください。現在、このアプリにはコード署名がありません。

初回起動後、歯車ボタンから DeepSeek、OpenCode Go、ChatGPT Plus を接続できます。最小化ボタンを押すと、アプリは Windows の通知領域に残ります。

## ソースから実行する

Node.js 22 以降と pnpm が必要です。

```powershell
pnpm install
pnpm start
```

DeepSeek では `DEEPSEEK_API_KEY` 環境変数を利用できます。OpenCode Go では `OPENCODE_GO_API_KEY`、または設定画面で入力したキーを利用できます。OpenCode のキーがない場合、アプリはローカルで起動している DSH Web の利用枠エンドポイントを読み取ろうとします。ChatGPT Plus はアプリ内のログインウィンドウで接続するため、Cookie や Token を貼り付ける必要はありません。

## 設定

`.env.example` をローカルの `.env` にコピーするか、アプリの設定画面でキーを入力してください。`.env`、API キー、Cookie、エクスポートした利用データ、Windows のユーザーデータディレクトリはコミットしないでください。

OpenCode Go の USD 残高は、設定した月額 USD と利用枠エンドポイントが返す月間利用率から算出するローカル推定値です。OpenCode の独立した残高 API ではありません。

## ポータブル版 Windows アプリのビルド

```powershell
pnpm dist
```

ポータブル版 `.exe` は `dist` に生成され、既定で Git の追跡対象外です。

## プライバシー

- DeepSeek と OpenCode のキーは Windows の暗号化ストレージで保存されます。
- ChatGPT のログイン Cookie は Electron のローカルセッション内にのみ保持され、テキストとしてエクスポートされません。
- アプリは設定した利用枠エンドポイントにだけリクエストを送信します。
- アプリの設定はシステムのユーザーデータディレクトリに保存され、このリポジトリには書き込まれません。

## カスタムプロバイダー

設定の **カスタムプロバイダー** で **追加** を選択し、エンドポイント URL、任意の Bearer Token、JSON フィールドパスを入力します。

- 利用率では、値のパスに `usage.percent`、任意のリセット時刻のパスに `usage.reset_at` などを指定します。
- 残高では、値のパスに `data.balance`、単位に `USD` などを指定できます。
- Token は Windows の暗号化ストレージを使用し、入力した URL にのみ送信されます。

## 依存関係と謝辞

| プロジェクト | 固定バージョン | 用途 | ライセンス |
| --- | --- | --- | --- |
| [Electron](https://www.electronjs.org/) | 39.8.10 | Windows デスクトップランタイム | MIT |
| [electron-builder](https://www.electron.build/) | 26.15.3 | Windows ポータブル版のパッケージング | MIT |

直接依存関係の通知は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。推移的な依存関係のバージョンは `pnpm-lock.yaml` に固定されています。

## ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。
