# Quota Dock

Quota Dock 是一个 Windows 桌面额度面板，集中展示 DeepSeek、ChatGPT Plus、OpenCode Go 与自定义 AI 供应商的本地额度信息。

## 功能

- 显示 DeepSeek API 余额；
- 显示 ChatGPT Plus 当前会话额度；
- 显示 OpenCode Go 的滚动 5 小时、每周与每月进度和重置时间；
- 根据你设置的月度美元额度，估算 OpenCode Go 的美元余量；
- 支持添加自定义 JSON 额度接口；
- 点击最小化按钮后收进 Windows 右下角通知区，点击通知区图标即可恢复；
- 按住 Shift 拖动窗口标题区可移动面板。

## 安装

1. 打开 [Releases 页面](https://github.com/shixiliya1/quota-dock/releases/latest)。
2. 下载最新版本的 `Quota Dock <版本号>.exe`。
3. 双击运行即可。这是便携版，不需要安装向导。
4. Windows 如果显示 SmartScreen 提示，选择“更多信息”后再选择“仍要运行”。该程序目前没有代码签名证书。

首次打开后，可在齿轮设置中连接 DeepSeek、OpenCode Go 和 ChatGPT Plus；点击最小化按钮后，应用会留在 Windows 右下角通知区。

## 运行

需要 Node.js 22 或更高版本和 pnpm。

```powershell
pnpm install
pnpm start
```

DeepSeek 可使用 `DEEPSEEK_API_KEY` 环境变量；OpenCode Go 可使用 `OPENCODE_GO_API_KEY`，也可以在设置中输入。未设置 OpenCode Key 时，应用会尝试读取本机运行的 DSH Web 额度接口。ChatGPT Plus 通过应用内登录窗口连接，不需要粘贴 Cookie 或 Token。

## 配置

可以复制 `.env.example` 为本机 `.env`，或直接在应用设置中填写 Key。不要提交 `.env`、Key、Cookie、导出的用量文件或 Windows 用户配置目录。

OpenCode Go 的美元余量由“月度额度（USD）”和接口返回的本月使用百分比计算；这是本地估算值，不是 OpenCode 的独立余额接口。

## 构建便携版 Windows 程序

```powershell
pnpm dist
```

构建完成的便携版 `.exe` 位于 `dist` 目录，默认不会被 Git 跟踪。

## 隐私

- DeepSeek 与 OpenCode 的 Key 通过 Windows 加密存储保存；
- ChatGPT 登录 Cookie 仅保留在 Electron 本地会话中，不导出为文本；
- 应用只会请求配置的额度接口；
- 应用配置位于系统用户数据目录，不会写入本仓库。

## 自定义供应商

在设置中的“自定义供应商”选择“添加”，填写接口 URL、可选 Bearer Token 与 JSON 字段路径即可添加额度来源。

- “使用百分比”示例：数值字段 `usage.percent`，可选重置字段 `usage.reset_at`；
- “余额”示例：数值字段 `data.balance`，可加单位 `USD`；
- Token 仅使用 Windows 加密存储，并且只随请求发送到你填写的 URL。

## 依赖与致谢

| 项目 | 锁定版本 | 用途 | 许可证 |
| --- | --- | --- | --- |
| [Electron](https://www.electronjs.org/) | 39.8.10 | Windows 桌面运行时 | MIT |
| [electron-builder](https://www.electron.build/) | 26.15.3 | Windows 便携版打包 | MIT |

完整的直接依赖声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。传递依赖版本由 `pnpm-lock.yaml` 锁定。

## 许可证

本项目以 [MIT License](LICENSE) 开源。
