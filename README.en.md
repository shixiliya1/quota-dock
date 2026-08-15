# Quota Dock

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

Quota Dock is a compact Windows desktop dashboard for checking local usage and quota information for DeepSeek, ChatGPT Plus, OpenCode Go, and custom AI providers.

## Features

- Shows the DeepSeek API balance.
- Shows the current ChatGPT Plus session quota.
- Shows OpenCode Go rolling five-hour, weekly, and monthly usage with reset times.
- Estimates remaining OpenCode Go credit in USD from the monthly amount you configure.
- Supports custom JSON quota endpoints.
- Minimizes to the Windows notification area; click its tray icon to restore it.
- Hold Shift and drag the title area to move the panel.

## Installation

1. Open the [latest release](https://github.com/shixiliya1/quota-dock/releases/latest).
2. Download the latest Windows portable `.exe` asset.
3. Double-click the file to run it. No setup wizard is required.
4. If Windows SmartScreen appears, select **More info** and then **Run anyway**. The application is not code-signed yet.

On first launch, use the gear button to connect DeepSeek, OpenCode Go, and ChatGPT Plus. The minimize button keeps the application in the Windows notification area.

## Run from Source

Node.js 22 or later and pnpm are required.

```powershell
pnpm install
pnpm start
```

DeepSeek can use the `DEEPSEEK_API_KEY` environment variable. OpenCode Go can use `OPENCODE_GO_API_KEY` or a key entered in Settings. Without an OpenCode key, the application tries to read the local DSH Web quota endpoint. ChatGPT Plus is connected through the app's login window, so you do not need to paste cookies or tokens.

## Configuration

Copy `.env.example` to a local `.env` file, or enter keys in the app settings. Do not commit `.env` files, API keys, cookies, exported usage data, or Windows user-data directories.

The OpenCode Go USD balance is a local estimate based on the monthly USD amount you set and the monthly usage percentage returned by the quota endpoint. It is not an independent OpenCode balance API.

## Build a Portable Windows App

```powershell
pnpm dist
```

The portable `.exe` is generated in `dist` and is ignored by Git by default.

## Privacy

- DeepSeek and OpenCode keys are stored through Windows encrypted storage.
- The ChatGPT login cookie stays in Electron's local session and is not exported as text.
- The app only requests the quota endpoints that you configure.
- App configuration stays in the system user-data directory and is not written to this repository.

## Custom Providers

Choose **Add** under **Custom providers** in Settings, then provide an endpoint URL, an optional Bearer token, and JSON field paths.

- For percentage usage, use a value path such as `usage.percent` and optionally a reset path such as `usage.reset_at`.
- For balances, use a value path such as `data.balance` and optionally set a unit such as `USD`.
- Tokens use Windows encrypted storage and are sent only to the URL you enter.

## Dependencies and Credits

| Project | Locked version | Purpose | License |
| --- | --- | --- | --- |
| [Electron](https://www.electronjs.org/) | 39.8.10 | Windows desktop runtime | MIT |
| [electron-builder](https://www.electron.build/) | 26.15.3 | Portable Windows packaging | MIT |

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for direct-dependency notices. Transitive dependency versions are locked in `pnpm-lock.yaml`.

## License

This project is open source under the [MIT License](LICENSE).
