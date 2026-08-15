const cards = document.querySelector('#cards')
const updated = document.querySelector('#updated')
const settingsDialog = document.querySelector('#settingsDialog')
const settingsForm = document.querySelector('#settingsForm')
const customProviderDialog = document.querySelector('#customProviderDialog')
const customProviderForm = document.querySelector('#customProviderForm')
const customProviderList = document.querySelector('#customProviderList')

const displayNames = { rolling: '5 小时', weekly: '每周', monthly: '每月' }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]))
}

function resetText(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `重置：${date.toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })}`
}

function rowsMarkup(rows, accent) {
  return rows.map((row) => `<div class="usage-row"><span>${escapeHtml(displayNames[row.id] || row.label)}</span><div class="bar"><i style="width:${row.percent}%;--accent:${accent}"></i></div><b>${row.percent.toFixed(0)}%</b>${resetText(row.resetsAt || row.resetAt) ? `<small class="reset">${resetText(row.resetsAt || row.resetAt)}</small>` : ''}</div>`).join('')
}

function card(name, accent, state, body) {
  return `<article class="card"><div class="card-head"><span class="brand" style="color:${accent}">${escapeHtml(name)}</span><span class="state ${state.status}">${state.status === 'ready' ? '已连接' : state.status === 'setup' ? '未连接' : state.status === 'connected' ? '已连接' : '读取失败'}</span></div>${body}</article>`
}

function providerMessage(state) {
  const action = state.action === 'start-dsh'
    ? '<button data-start-dsh>启动 DSH Web</button>'
    : '<button data-open-settings>设置</button>'
  return `<p class="message">${escapeHtml(state.message || '暂时没有可显示的数据')} ${action}</p>`
}

function deepSeekMarkup(state) {
  return state.balances.map((item) => `<div class="balance"><strong class="amount">${escapeHtml(item.total)}</strong><span class="currency">${escapeHtml(item.currency)}</span></div><p class="sub">充值 ${escapeHtml(item.toppedUp)} · 赠金 ${escapeHtml(item.granted)}</p>`).join('')
}

function dollars(value) {
  return `$${Number(value).toFixed(2)}`
}

function openCodeMarkup(state) {
  const monthly = state.usage.find((row) => row.id === 'monthly')
  const budget = Number(state.monthlyBudget)
  const balance = monthly && Number.isFinite(budget) && budget > 0
    ? `<div class="balance"><strong class="amount">${dollars(Math.max(0, budget * (1 - monthly.percent / 100)))}</strong><span class="currency">USD 余量</span></div><p class="sub">月度额度 ${dollars(budget)} · 已用 ${dollars(budget * monthly.percent / 100)}</p>`
    : '<p class="sub">请在设置中填写月度 USD 额度</p>'
  return `${balance}${rowsMarkup(state.usage, 'var(--open)')}`
}

function render(payload) {
  const deepseek = payload.deepseek.status === 'ready' ? deepSeekMarkup(payload.deepseek) : providerMessage(payload.deepseek)
  const chatgpt = payload.chatgpt.status === 'ready' ? rowsMarkup(payload.chatgpt.rows, 'var(--chat)') : providerMessage(payload.chatgpt)
  const opencode = payload.opencode.status === 'ready' ? openCodeMarkup(payload.opencode) : providerMessage(payload.opencode)
  const custom = payload.custom.map((provider) => {
    const body = provider.status === 'ready'
      ? provider.kind === 'quota'
        ? rowsMarkup([{ label: '额度', percent: provider.percent, resetAt: provider.resetAt }], 'var(--custom)')
        : `<div class="balance"><strong class="amount">${escapeHtml(provider.value)}</strong><span class="currency">${escapeHtml(provider.unit)}</span></div>`
      : providerMessage(provider)
    return card(provider.name, 'var(--custom)', provider, body)
  }).join('')
  cards.innerHTML = card('DeepSeek', 'var(--deep)', payload.deepseek, deepseek) + card('ChatGPT Plus', 'var(--chat)', payload.chatgpt, chatgpt) + card('OpenCode Go', 'var(--open)', payload.opencode, opencode) + custom
  updated.textContent = `上次读取：${new Date(payload.updatedAt).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' })}`
  document.querySelectorAll('[data-open-settings]').forEach((button) => button.addEventListener('click', openSettings))
  document.querySelectorAll('[data-start-dsh]').forEach((button) => button.addEventListener('click', startDsh))
}

async function refresh() {
  updated.textContent = '正在读取额度…'
  try { render(await window.quotaDock.refresh()) } catch { updated.textContent = '读取失败，请稍后重试' }
}

async function openSettings() {
  const state = await window.quotaDock.settingsState()
  document.querySelector('#deepseekKey').placeholder = state.deepseek ? '已保存，留空则保持不变' : '请输入 DeepSeek API Key'
  document.querySelector('#openCodeKey').placeholder = state.opencode ? '已保存，留空则保持不变' : '请输入 OpenCode Go API Key'
  document.querySelector('#openCodeMonthlyBudget').value = state.openCodeMonthlyBudget
  renderCustomProviderList(state.customProviders)
  settingsDialog.showModal()
}

function renderCustomProviderList(providers) {
  customProviderList.innerHTML = providers.length
    ? providers.map((provider) => `<div class="custom-provider"><span>${escapeHtml(provider.name)}<small>${escapeHtml(provider.kind === 'quota' ? provider.valuePath : `${provider.valuePath}${provider.unit ? ` · ${provider.unit}` : ''}`)}</small></span><button data-remove-custom="${escapeHtml(provider.id)}" type="button">删除</button></div>`).join('')
    : '<p class="custom-empty">还没有自定义供应商。</p>'
  document.querySelectorAll('[data-remove-custom]').forEach((button) => button.addEventListener('click', async () => {
    if (!window.confirm('删除这个自定义供应商吗？')) return
    await window.quotaDock.removeCustomProvider(button.dataset.removeCustom)
    const state = await window.quotaDock.settingsState()
    renderCustomProviderList(state.customProviders)
    refresh()
  }))
}

function updateCustomKind() {
  const balance = document.querySelector('#customKind').value === 'balance'
  document.querySelector('#customResetLabel').hidden = balance
  document.querySelector('#customUnitLabel').hidden = !balance
}

async function startDsh() {
  const result = await window.quotaDock.startDsh()
  updated.textContent = result.status === 'running' ? 'DSH Web 已在运行，正在读取额度…' : '正在启动 DSH Web，稍后自动刷新…'
  setTimeout(refresh, 5000)
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Shift') document.body.classList.add('drag-enabled')
})
window.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') document.body.classList.remove('drag-enabled')
})
window.addEventListener('blur', () => document.body.classList.remove('drag-enabled'))

document.querySelector('#minimize').addEventListener('click', () => window.quotaDock.minimize())
document.querySelector('#refresh').addEventListener('click', refresh)
document.querySelector('#settings').addEventListener('click', openSettings)
document.querySelector('#quit').addEventListener('click', () => window.quotaDock.quit())
document.querySelector('#connectChatGpt').addEventListener('click', () => window.quotaDock.connectChatGpt())
document.querySelector('#addCustomProvider').addEventListener('click', () => customProviderDialog.showModal())
document.querySelector('#customKind').addEventListener('change', updateCustomKind)
settingsForm.addEventListener('submit', async (event) => {
  if (event.submitter?.id !== 'saveSettings') return
  event.preventDefault()
  await window.quotaDock.saveSettings({ deepseek: document.querySelector('#deepseekKey').value, opencode: document.querySelector('#openCodeKey').value, openCodeMonthlyBudget: document.querySelector('#openCodeMonthlyBudget').value })
  document.querySelector('#deepseekKey').value = ''
  document.querySelector('#openCodeKey').value = ''
  settingsDialog.close()
  refresh()
})
customProviderForm.addEventListener('submit', async (event) => {
  if (event.submitter?.id !== 'saveCustomProvider') return
  event.preventDefault()
  await window.quotaDock.addCustomProvider({
    name: document.querySelector('#customName').value,
    url: document.querySelector('#customUrl').value,
    token: document.querySelector('#customToken').value,
    kind: document.querySelector('#customKind').value,
    valuePath: document.querySelector('#customValuePath').value,
    resetPath: document.querySelector('#customResetPath').value,
    unit: document.querySelector('#customUnit').value,
  })
  customProviderForm.reset()
  updateCustomKind()
  customProviderDialog.close()
  const state = await window.quotaDock.settingsState()
  renderCustomProviderList(state.customProviders)
  refresh()
})
window.quotaDock.onChatGptConnected(() => refresh())
refresh()
setInterval(refresh, 5 * 60 * 1000)
