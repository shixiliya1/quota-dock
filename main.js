const { app, BrowserWindow, ipcMain, Menu, nativeImage, safeStorage, screen, session, shell, Tray } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { randomUUID } = require('node:crypto')

const EXPANDED_WIDTH = 184
const WINDOW_HEIGHT = 520
const FLOATING_GAP = 16
const CHATGPT_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'
const OPENCODE_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage'
const DSH_OPENCODE_USAGE_URL = 'http://127.0.0.1:3080/api/opencode-go-quota'
const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance'

let mainWindow
let chatGptWindow
let tray
let dockTop
let dockLeft

function configPath() {
  return path.join(app.getPath('userData'), 'quota-dock.json')
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'))
  } catch {
    return {}
  }
}

function writeConfig(config) {
  fs.writeFileSync(configPath(), JSON.stringify(config), 'utf8')
}

function encrypt(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 加密存储当前不可用')
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch {
    return undefined
  }
}

function credential(name, environmentName) {
  const stored = decrypt(readConfig()[name])
  return stored || process.env[environmentName]
}

function currentWorkArea() {
  return screen.getDisplayMatching(mainWindow?.getBounds() ?? screen.getPrimaryDisplay().bounds).workArea
}

function clampedDockTop(area, top) {
  const centeredTop = area.y + Math.max(24, Math.round((area.height - WINDOW_HEIGHT) / 2))
  const maximumTop = area.y + Math.max(0, area.height - WINDOW_HEIGHT)
  return Math.max(area.y, Math.min(Number.isFinite(top) ? top : centeredTop, maximumTop))
}

function clampedDockLeft(area, left) {
  const defaultLeft = area.x + area.width - EXPANDED_WIDTH - FLOATING_GAP
  const maximumLeft = area.x + Math.max(0, area.width - EXPANDED_WIDTH)
  return Math.max(area.x, Math.min(Number.isFinite(left) ? left : defaultLeft, maximumLeft))
}

function placeWindow() {
  if (!mainWindow) return
  const area = currentWorkArea()
  dockTop = clampedDockTop(area, dockTop)
  dockLeft = clampedDockLeft(area, dockLeft)
  mainWindow.setBounds({
    x: dockLeft,
    y: dockTop,
    width: EXPANDED_WIDTH,
    height: WINDOW_HEIGHT,
  })
}

function keepDockInWorkArea() {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  const area = currentWorkArea()
  const top = clampedDockTop(area, bounds.y)
  const left = clampedDockLeft(area, bounds.x)
  dockTop = top
  if (bounds.x !== left || bounds.y !== top) mainWindow.setBounds({ x: left, y: top, width: bounds.width, height: bounds.height })
  dockLeft = left
}

async function requestJson(url, token, requestSession) {
  const headers = { accept: 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const response = requestSession
    ? await requestSession.fetch(url, { headers })
    : await fetch(url, { headers })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

function errorState(error) {
  return { status: 'error', message: error instanceof Error ? error.message : '请求失败' }
}

function valueAtPath(value, fieldPath) {
  return fieldPath.split('.').filter(Boolean).reduce((current, key) => {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined
    return current[key]
  }, value)
}

function formatReset(value) {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value < 1_000_000_000_000 ? value * 1_000 : value).toISOString()
  return undefined
}

function publicCustomProvider(provider) {
  return { id: provider.id, name: provider.name, url: provider.url, kind: provider.kind, valuePath: provider.valuePath, resetPath: provider.resetPath, unit: provider.unit, hasToken: Boolean(decrypt(provider.token)) }
}

function validateCustomProvider(values) {
  const name = typeof values.name === 'string' ? values.name.trim() : ''
  const url = typeof values.url === 'string' ? values.url.trim() : ''
  const kind = values.kind === 'balance' ? 'balance' : 'quota'
  const valuePath = typeof values.valuePath === 'string' ? values.valuePath.trim() : ''
  const resetPath = typeof values.resetPath === 'string' ? values.resetPath.trim() : ''
  const unit = typeof values.unit === 'string' ? values.unit.trim() : ''
  if (!name || name.length > 40 || !valuePath || !/^[A-Za-z0-9_.-]+$/.test(valuePath)) throw new Error('请填写名称和正确的数值字段路径')
  if (resetPath && !/^[A-Za-z0-9_.-]+$/.test(resetPath)) throw new Error('重置时间字段路径不正确')
  let parsedUrl
  try { parsedUrl = new URL(url) } catch { throw new Error('接口 URL 不正确') }
  if (!['https:', 'http:'].includes(parsedUrl.protocol)) throw new Error('接口 URL 只支持 HTTP 或 HTTPS')
  return { name, url: parsedUrl.toString(), kind, valuePath, resetPath: kind === 'quota' ? resetPath : '', unit: kind === 'balance' ? unit : '' }
}

async function customProviderUsage(provider) {
  try {
    const payload = await requestJson(provider.url, decrypt(provider.token))
    const value = valueAtPath(payload, provider.valuePath)
    if (provider.kind === 'quota') {
      const percent = Number(value)
      if (!Number.isFinite(percent)) throw new Error('未找到百分比字段')
      return { id: provider.id, name: provider.name, kind: provider.kind, status: 'ready', percent: Math.max(0, Math.min(100, percent)), resetAt: formatReset(valueAtPath(payload, provider.resetPath)) }
    }
    if (typeof value !== 'number' && typeof value !== 'string') throw new Error('未找到余额字段')
    return { id: provider.id, name: provider.name, kind: provider.kind, status: 'ready', value: String(value), unit: provider.unit }
  } catch (error) {
    return { id: provider.id, name: provider.name, kind: provider.kind, status: 'error', message: error instanceof Error ? error.message : '请求失败' }
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const client = net.connect({ host: '127.0.0.1', port })
    client.once('connect', () => { client.destroy(); resolve(true) })
    client.once('error', () => resolve(false))
  })
}

async function startDshWeb() {
  if (await portInUse(3080)) return { status: 'running' }
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const child = spawn(command, ['@deepseek-ai/dsh', 'web'], { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  return { status: 'starting' }
}

async function deepSeekUsage() {
  const token = credential('deepseekKey', 'DEEPSEEK_API_KEY')
  if (!token) return { status: 'setup', message: '需要 DeepSeek API Key' }
  try {
    const payload = await requestJson(DEEPSEEK_BALANCE_URL, token)
    const balances = Array.isArray(payload.balance_infos) ? payload.balance_infos : []
    return {
      status: 'ready',
      available: Boolean(payload.is_available),
      balances: balances.map((item) => ({
        currency: item.currency,
        total: item.total_balance,
        granted: item.granted_balance,
        toppedUp: item.topped_up_balance,
      })),
    }
  } catch (error) {
    return errorState(error)
  }
}

async function openCodeUsage(config) {
  const token = credential('openCodeKey', 'OPENCODE_GO_API_KEY')
  const configuredBudget = Number(config.openCodeMonthlyBudget)
  const monthlyBudget = Number.isFinite(configuredBudget) && configuredBudget > 0 ? configuredBudget : undefined
  try {
    const payload = token
      ? await requestJson(OPENCODE_USAGE_URL, token)
      : await requestJson(DSH_OPENCODE_USAGE_URL)
    const usage = payload?.usage
    if (!usage?.rolling || !usage?.weekly || !usage?.monthly) throw new Error('额度数据格式无法识别')
    return {
      status: 'ready',
      usage: ['rolling', 'weekly', 'monthly'].map((id) => ({
        id,
        percent: Math.max(0, Math.min(100, Number(usage[id].percent) || 0)),
        resetsAt: usage[id].resetsAt,
      })),
      monthlyBudget,
    }
  } catch (error) {
    if (!token) return { status: 'setup', message: '启动 DSH Web，或在设置中输入 OpenCode Go API Key', action: 'start-dsh' }
    return errorState(error)
  }
}

function chatGptRows(payload) {
  const rateLimit = payload?.rate_limit
  if (!rateLimit || typeof rateLimit !== 'object') return []
  return [
    ['当前窗口', rateLimit.primary_window],
    ['第二窗口', rateLimit.secondary_window],
  ].flatMap(([label, window]) => {
    if (!window || typeof window !== 'object' || !Number.isFinite(window.used_percent)) return []
    const resetAt = typeof window.reset_at === 'number' ? new Date(window.reset_at * 1_000).toISOString() : undefined
    return [{ label, percent: Math.max(0, Math.min(100, window.used_percent)), resetAt }]
  })
}

async function chatGptUsage() {
  try {
    const chatSession = session.fromPartition('persist:chatgpt')
    const authResponse = await chatSession.fetch('https://chatgpt.com/api/auth/session', { headers: { accept: 'application/json' } })
    const auth = await authResponse.json()
    const accessToken = typeof auth.accessToken === 'string' && auth.accessToken.length > 0 ? auth.accessToken : undefined
    if (!accessToken) return { status: 'setup', message: '点击设置并登录 ChatGPT Plus' }
    const payload = await requestJson(CHATGPT_USAGE_URL, accessToken, chatSession)
    const rows = chatGptRows(payload)
    if (!rows.length) return { status: 'connected', message: '已登录，但当前额度格式需要更新应用' }
    return { status: 'ready', rows }
  } catch {
    return { status: 'setup', message: '点击设置并登录 ChatGPT' }
  }
}

async function allUsage() {
  const config = readConfig()
  const custom = await Promise.all((Array.isArray(config.customProviders) ? config.customProviders : []).map(customProviderUsage))
  const [deepseek, chatgpt, opencode] = await Promise.all([deepSeekUsage(), chatGptUsage(), openCodeUsage(config)])
  return { updatedAt: Date.now(), deepseek, chatgpt, opencode, custom }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: EXPANDED_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  mainWindow.on('move', keepDockInWorkArea)
  mainWindow.once('ready-to-show', () => {
    placeWindow()
    mainWindow.showInactive()
  })
}

function createTrayIcon() {
  const size = 16
  const bitmap = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (Math.hypot(x - 7.5, y - 7.5) > 7) continue
      const index = (y * size + x) * 4
      bitmap[index] = 104
      bitmap[index + 1] = 161
      bitmap[index + 2] = 52
      bitmap[index + 3] = 255
    }
  }
  return nativeImage.createFromBitmap(bitmap, { width: size, height: size })
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.show()
  mainWindow.focus()
}

function autoLaunchEnabled() {
  return readConfig().autoLaunch !== false
}

function setAutoLaunch(enabled) {
  const config = readConfig()
  config.autoLaunch = enabled
  writeConfig(config)
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled })
}

function createTray() {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Quota Dock')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示额度仪表', click: showMainWindow },
    { label: '开机自动启动', type: 'checkbox', checked: autoLaunchEnabled(), click: (item) => setAutoLaunch(item.checked) },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]))
  tray.on('click', showMainWindow)
}

function openChatGptLogin() {
  if (chatGptWindow && !chatGptWindow.isDestroyed()) {
    chatGptWindow.focus()
    return
  }
  chatGptWindow = new BrowserWindow({
    width: 520,
    height: 760,
    title: '连接 ChatGPT Plus',
    parent: mainWindow,
    webPreferences: { partition: 'persist:chatgpt', contextIsolation: true, nodeIntegration: false },
  })
  chatGptWindow.loadURL('https://chatgpt.com/auth/login')
  const probe = setInterval(async () => {
    if (!chatGptWindow || chatGptWindow.isDestroyed()) return clearInterval(probe)
    const result = await chatGptUsage()
    if (result.status === 'ready' || result.status === 'connected') {
      clearInterval(probe)
      chatGptWindow.close()
      mainWindow?.webContents.send('chatgpt-connected')
    }
  }, 1800)
  chatGptWindow.on('closed', () => clearInterval(probe))
}

app.whenReady().then(() => {
  setAutoLaunch(autoLaunchEnabled())
  createMainWindow()
  createTray()
  screen.on('display-metrics-changed', placeWindow)
  screen.on('display-added', placeWindow)
})

ipcMain.handle('usage:refresh', allUsage)
ipcMain.handle('dsh:start', startDshWeb)
ipcMain.handle('settings:state', () => {
  const config = readConfig()
  return {
    deepseek: Boolean(decrypt(config.deepseekKey) || process.env.DEEPSEEK_API_KEY),
    opencode: Boolean(decrypt(config.openCodeKey) || process.env.OPENCODE_GO_API_KEY),
    openCodeMonthlyBudget: Number.isFinite(Number(config.openCodeMonthlyBudget)) ? String(config.openCodeMonthlyBudget) : '',
    customProviders: (Array.isArray(config.customProviders) ? config.customProviders : []).map(publicCustomProvider),
  }
})
ipcMain.handle('settings:save', (_event, values) => {
  const config = readConfig()
  if (typeof values.deepseek === 'string' && values.deepseek.trim()) config.deepseekKey = encrypt(values.deepseek.trim())
  if (typeof values.opencode === 'string' && values.opencode.trim()) config.openCodeKey = encrypt(values.opencode.trim())
  if (typeof values.openCodeMonthlyBudget === 'string') {
    const rawBudget = values.openCodeMonthlyBudget.trim()
    if (!rawBudget) delete config.openCodeMonthlyBudget
    else {
      const budget = Number(rawBudget)
      if (!Number.isFinite(budget) || budget <= 0) throw new Error('OpenCode Go 月度额度必须大于 0')
      config.openCodeMonthlyBudget = budget
    }
  }
  writeConfig(config)
  return { ok: true }
})
ipcMain.handle('custom:add', (_event, values) => {
  const config = readConfig()
  const provider = validateCustomProvider(values)
  const token = typeof values.token === 'string' && values.token.trim() ? encrypt(values.token.trim()) : undefined
  const entry = { id: randomUUID(), ...provider, token }
  config.customProviders = [...(Array.isArray(config.customProviders) ? config.customProviders : []), entry]
  writeConfig(config)
  return publicCustomProvider(entry)
})
ipcMain.handle('custom:remove', (_event, id) => {
  const config = readConfig()
  config.customProviders = (Array.isArray(config.customProviders) ? config.customProviders : []).filter((provider) => provider.id !== id)
  writeConfig(config)
  return { ok: true }
})
ipcMain.on('chatgpt:connect', openChatGptLogin)
ipcMain.on('app:minimize', () => mainWindow?.hide())
ipcMain.on('app:quit', () => app.quit())
ipcMain.on('link:open', (_event, url) => shell.openExternal(url))
