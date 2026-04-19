import http from 'http'
import crypto from 'crypto'
import { URL } from 'url'
import { getFilterSummary } from './encarFilters.js'

const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h
const COOKIE_NAME = 'admin_session'

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function parseCookies(header) {
  const out = {}
  const raw = String(header || '')
  if (!raw) return out
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    const val = part.slice(eq + 1).trim()
    if (key) out[key] = decodeURIComponent(val)
  }
  return out
}

function readBody(req, limitBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (chunk) => {
      total += chunk.length
      if (total > limitBytes) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function htmlResponse(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  })
  res.end(html)
}

function buildLoginPage(errorText = '') {
  const errHtml = errorText
    ? `<div class="err">${errorText.replace(/</g, '&lt;')}</div>`
    : ''
  return `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Admin — login</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#0b0f17;color:#e7ecf3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  form{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:28px;width:320px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  h1{margin:0 0 16px;font-size:18px}
  input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #374151;background:#0b1220;color:#e7ecf3;font-size:14px;margin-bottom:12px;box-sizing:border-box}
  button{width:100%;padding:10px 12px;border-radius:8px;border:0;background:#2563eb;color:#fff;font-weight:600;cursor:pointer}
  button:hover{background:#1d4ed8}
  .err{color:#f87171;font-size:13px;margin-bottom:10px}
</style></head><body>
<form method="POST" action="/admin/login">
  <h1>🔒 Admin Panel</h1>
  ${errHtml}
  <input type="password" name="password" placeholder="Пароль" autofocus required/>
  <button type="submit">Войти</button>
</form>
</body></html>`
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Admin Panel</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#0b0f17;color:#e7ecf3;margin:0}
  header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#111827;border-bottom:1px solid #1f2937;position:sticky;top:0;z-index:10}
  header h1{margin:0;font-size:16px}
  header .actions{display:flex;gap:8px}
  button,.btn{padding:7px 12px;border-radius:6px;border:0;background:#1f2937;color:#e7ecf3;cursor:pointer;font-size:13px;text-decoration:none;display:inline-block}
  button:hover,.btn:hover{background:#374151}
  button.primary{background:#2563eb}button.primary:hover{background:#1d4ed8}
  button.danger{background:#991b1b}button.danger:hover{background:#b91c1c}
  main{padding:20px;max-width:1400px;margin:0 auto}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
  .stat{background:#111827;border:1px solid #1f2937;border-radius:10px;padding:14px}
  .stat .label{color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  .stat .value{font-size:22px;font-weight:700;margin-top:4px}
  .tabs{display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid #1f2937}
  .tab{padding:10px 16px;cursor:pointer;border-bottom:2px solid transparent;color:#9ca3af;font-size:14px}
  .tab.active{color:#e7ecf3;border-bottom-color:#2563eb}
  .panel{background:#111827;border:1px solid #1f2937;border-radius:10px;padding:14px;min-height:200px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #1f2937;vertical-align:top}
  th{color:#9ca3af;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em;position:sticky;top:0;background:#111827}
  tr:hover td{background:#0f1623}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .badge.on{background:#065f46;color:#a7f3d0}
  .badge.off{background:#451a03;color:#fbbf24}
  .logs{background:#05070d;border:1px solid #1f2937;border-radius:8px;padding:10px;max-height:60vh;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5}
  .log-line{white-space:pre-wrap;word-break:break-word;margin:0;padding:2px 0}
  .log-warn{color:#fbbf24}.log-error{color:#f87171}.log-info{color:#d1d5db}
  .log-ts{color:#6b7280;margin-right:8px}
  .row{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
  input[type=text],textarea{background:#0b1220;border:1px solid #374151;color:#e7ecf3;padding:7px 10px;border-radius:6px;font-size:13px;font-family:inherit}
  textarea{width:100%;min-height:80px}
  .muted{color:#9ca3af;font-size:12px}
  .link{color:#60a5fa;text-decoration:none}
  .link:hover{text-decoration:underline}
  details{background:#0f1623;border:1px solid #1f2937;border-radius:6px;padding:8px 10px;margin:6px 0}
  details summary{cursor:pointer;font-size:12px;color:#9ca3af}
  details pre{margin:8px 0 0;font-size:11px;color:#d1d5db;overflow:auto;max-height:300px}
  .flex-split{display:flex;justify-content:space-between;align-items:center;gap:12px}
  .chip{display:inline-block;padding:3px 8px;background:#0b1220;border:1px solid #374151;border-radius:6px;font-size:11px;margin:2px 4px 2px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#1e3a8a;color:#bfdbfe;font-size:11px;font-weight:600}
</style></head><body>
<header>
  <h1>🤖 Encar Bot — Admin</h1>
  <div class="actions">
    <button onclick="refreshAll()">↻ Обновить</button>
    <a class="btn" href="/admin/logout">Выйти</a>
  </div>
</header>
<main>
  <div class="stats-grid" id="stats"></div>
  <div class="tabs">
    <div class="tab active" data-tab="users">👥 Пользователи</div>
    <div class="tab" data-tab="filters">🎯 Фильтры</div>
    <div class="tab" data-tab="deliveries">🚗 Доставленные</div>
    <div class="tab" data-tab="logs">📋 Логи</div>
    <div class="tab" data-tab="actions">⚙️ Действия</div>
  </div>
  <div class="panel" id="panel-users"></div>
  <div class="panel" id="panel-filters" style="display:none"></div>
  <div class="panel" id="panel-deliveries" style="display:none"></div>
  <div class="panel" id="panel-logs" style="display:none"></div>
  <div class="panel" id="panel-actions" style="display:none"></div>
</main>
<script>
const tabs = document.querySelectorAll('.tab')
const panels = {
  users: document.getElementById('panel-users'),
  filters: document.getElementById('panel-filters'),
  deliveries: document.getElementById('panel-deliveries'),
  logs: document.getElementById('panel-logs'),
  actions: document.getElementById('panel-actions'),
}
let activeTab = 'users'
let lastLogId = 0
let logsTimer = null

tabs.forEach((t) => t.addEventListener('click', () => {
  tabs.forEach((x) => x.classList.remove('active'))
  t.classList.add('active')
  activeTab = t.dataset.tab
  Object.keys(panels).forEach((k) => { panels[k].style.display = k === activeTab ? '' : 'none' })
  loadTab(activeTab)
  if (activeTab === 'logs') startLogsStream(); else stopLogsStream()
}))

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtNum(n){return new Intl.NumberFormat('ru-RU').format(Number(n)||0)}
function fmtDate(iso){if(!iso)return'—';const d=new Date(iso);if(isNaN(d))return'—';return d.toLocaleString('ru-RU')}
function fmtPrice(krw){if(!krw)return'—';return new Intl.NumberFormat('ru-RU').format(Math.round(krw/10000))+' млн ₩'}

async function api(path, opts){
  const r = await fetch(path, Object.assign({credentials:'same-origin'}, opts||{}))
  if (r.status === 401){location.href='/admin/login';return null}
  return r.json()
}

async function loadStats(){
  const s = await api('/admin/api/stats'); if(!s) return
  const grid = document.getElementById('stats')
  grid.innerHTML = [
    ['Пользователей',fmtNum(s.users.total)],
    ['Активных',fmtNum(s.users.active)],
    ['Всего фильтров',fmtNum(s.users.totalFilters)],
    ['Доставлено машин',fmtNum(s.globalStats.totalDelivered)],
    ['Сканирований',fmtNum(s.globalStats.totalScans)],
    ['Страниц обработано',fmtNum(s.globalStats.totalPages)],
    ['Объявлений проверено',fmtNum(s.globalStats.totalListingsChecked)],
    ['Seen listings',fmtNum(s.seen.total)],
    ['VIN\\'ов в памяти',fmtNum(s.seen.vinsTracked)],
    ['Uptime',s.uptime],
  ].map(([k,v])=>\`<div class="stat"><div class="label">\${k}</div><div class="value">\${v}</div></div>\`).join('')
}

async function loadUsers(){
  const d = await api('/admin/api/users'); if(!d) return
  const rows = d.users.map((u)=>{
    const name = [u.firstName,u.lastName].filter(Boolean).join(' ') || (u.username?'@'+u.username:'') || '—'
    const filters = u.filters.length
      ? u.filters.map((f)=>\`<div class="chip" title="\${esc(f.key)}">\${esc(f.label)}</div>\`).join('')
      : '<span class="muted">нет фильтров</span>'
    const status = u.isActive ? '<span class="badge on">парсит</span>' : '<span class="badge off">остановлен</span>'
    return \`<tr>
      <td><code>\${esc(u.chatId)}</code></td>
      <td>\${esc(name)}\${u.username?\`<div class="muted">@\${esc(u.username)}</div>\`:''}</td>
      <td>\${status}</td>
      <td>\${filters}</td>
      <td class="muted">\${fmtDate(u.updatedAt)}</td>
      <td>\${fmtNum(u.deliveredCount)}</td>
      <td>
        \${u.isActive
          ? \`<button class="danger" onclick="stopUser('\${esc(u.chatId)}')">Стоп</button>\`
          : \`<button onclick="startUser('\${esc(u.chatId)}')">Старт</button>\`}
      </td>
    </tr>\`
  }).join('')
  panels.users.innerHTML = \`<table>
    <thead><tr><th>chat_id</th><th>Имя</th><th>Статус</th><th>Фильтры</th><th>Обновлено</th><th>Доставлено</th><th></th></tr></thead>
    <tbody>\${rows||'<tr><td colspan="7" class="muted">Пусто</td></tr>'}</tbody></table>\`
}

async function loadFilters(){
  const d = await api('/admin/api/filter-stats'); if(!d) return
  const rows = d.stats.map((s)=>\`<tr>
    <td>\${esc(s.label||s.filterKey)}</td>
    <td>\${fmtNum(s.scans)}</td>
    <td>\${fmtNum(s.pagesProcessed)}</td>
    <td>\${fmtNum(s.listingsChecked)}</td>
    <td>\${fmtNum(s.freshHits)}</td>
    <td>\${fmtNum(s.filtered)}</td>
    <td>\${fmtNum(s.vinDupes)}</td>
    <td>\${fmtNum(s.networkErrors)}</td>
    <td class="muted">\${fmtDate(s.lastScanAt)}</td>
    <td class="muted">\${fmtDate(s.lastFreshAt)}</td>
  </tr>\`).join('')
  panels.filters.innerHTML = \`<table>
    <thead><tr><th>Фильтр</th><th>Сканы</th><th>Страницы</th><th>Проверено</th><th>Свежие</th><th>Отфильтровано</th><th>VIN дубли</th><th>Ошибки сети</th><th>Последний скан</th><th>Последняя свежая</th></tr></thead>
    <tbody>\${rows||'<tr><td colspan="10" class="muted">Пусто</td></tr>'}</tbody></table>\`
}

async function loadDeliveries(){
  const d = await api('/admin/api/deliveries'); if(!d) return
  const sections = d.byUser.map((u)=>{
    const list = u.items.map((it)=>\`<tr>
      <td><code>\${esc(it.encarId)}</code></td>
      <td>\${esc(it.title||'—')}</td>
      <td>\${fmtNum(it.year)}</td>
      <td>\${fmtNum(it.mileage)} км</td>
      <td>\${fmtPrice(it.priceKrw)}</td>
      <td><span class="pill">\${esc(it.filterLabel||'—')}</span></td>
      <td class="muted">\${fmtDate(it.deliveredAt)}</td>
      <td>\${it.link?\`<a class="link" href="\${esc(it.link)}" target="_blank">open</a>\`:''}</td>
    </tr>\`).join('')
    return \`<details open>
      <summary><b>chat_id \${esc(u.chatId)}</b> \${esc(u.name)} — \${fmtNum(u.items.length)} доставленных</summary>
      <table style="margin-top:8px">
        <thead><tr><th>ID</th><th>Машина</th><th>Год</th><th>Пробег</th><th>Цена</th><th>Фильтр</th><th>Доставлено</th><th></th></tr></thead>
        <tbody>\${list||'<tr><td colspan="8" class="muted">Пусто</td></tr>'}</tbody>
      </table>
    </details>\`
  }).join('')
  panels.deliveries.innerHTML = sections || '<div class="muted">Ещё ничего не доставлено</div>'
}

async function loadLogsInitial(){
  const d = await api('/admin/api/logs?limit=300'); if(!d) return
  lastLogId = d.lastId || 0
  panels.logs.innerHTML = \`<div class="row">
    <button onclick="clearLogsView()">Очистить вид</button>
    <span class="muted" id="log-status">streaming...</span>
  </div>
  <div class="logs" id="logs-container"></div>\`
  const c = document.getElementById('logs-container')
  d.items.forEach((it)=>appendLog(c, it))
  c.scrollTop = c.scrollHeight
}
function appendLog(container, it){
  const el = document.createElement('pre')
  el.className = 'log-line log-'+(it.level||'info')
  el.innerHTML = \`<span class="log-ts">\${fmtDate(it.ts)}</span>\${esc(it.text)}\`
  container.appendChild(el)
}
function clearLogsView(){
  const c = document.getElementById('logs-container'); if(c) c.innerHTML=''
}
async function pollLogs(){
  if(activeTab!=='logs') return
  const d = await api('/admin/api/logs?sinceId='+lastLogId); if(!d) return
  if(d.items.length){
    const c = document.getElementById('logs-container')
    if(c){
      const near = c.scrollTop + c.clientHeight >= c.scrollHeight - 40
      d.items.forEach((it)=>appendLog(c, it))
      if(near) c.scrollTop = c.scrollHeight
    }
    lastLogId = d.lastId || lastLogId
  }
}
function startLogsStream(){
  if(logsTimer) clearInterval(logsTimer)
  loadLogsInitial().then(()=>{ logsTimer = setInterval(pollLogs, 2000) })
}
function stopLogsStream(){ if(logsTimer){clearInterval(logsTimer);logsTimer=null} }

function loadActions(){
  panels.actions.innerHTML = \`
    <h3 style="margin-top:0">Рассылка всем активным</h3>
    <textarea id="broadcast-text" placeholder="Текст сообщения..."></textarea>
    <div class="row" style="margin-top:8px">
      <button class="primary" onclick="doBroadcast()">Отправить</button>
      <span id="broadcast-status" class="muted"></span>
    </div>
    <h3 style="margin-top:24px">Остановить всех</h3>
    <button class="danger" onclick="stopAll()">Выключить парсинг у всех пользователей</button>
    <h3 style="margin-top:24px">Сбросить seen listings</h3>
    <p class="muted">После сброса бот заново увидит все объявления как новые. Используй осторожно.</p>
    <button class="danger" onclick="clearSeen()">Сбросить seen + VIN + фильтр-статистику</button>\`
}

async function stopUser(chatId){
  if(!confirm('Остановить парсинг у '+chatId+'?'))return
  await api('/admin/api/user/'+encodeURIComponent(chatId)+'/stop', {method:'POST'})
  await loadUsers()
}
async function startUser(chatId){
  await api('/admin/api/user/'+encodeURIComponent(chatId)+'/start', {method:'POST'})
  await loadUsers()
}
async function stopAll(){
  if(!confirm('Остановить парсинг у ВСЕХ пользователей?'))return
  const r = await api('/admin/api/stop-all', {method:'POST'})
  alert('Остановлено: '+(r?.stopped||0))
  await refreshAll()
}
async function clearSeen(){
  if(!confirm('Точно сбросить всю историю? Это приведёт к повторным уведомлениям!'))return
  const r = await api('/admin/api/clear-seen', {method:'POST'})
  alert('Сброшено. Was: listings='+(r?.listings||0)+', vins='+(r?.vins||0))
  await refreshAll()
}
async function doBroadcast(){
  const text = document.getElementById('broadcast-text').value.trim()
  if(!text)return
  if(!confirm('Отправить это сообщение всем активным пользователям?'))return
  const r = await api('/admin/api/broadcast', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text})})
  document.getElementById('broadcast-status').textContent = 'Отправлено: '+(r?.sent||0)+' / ошибок: '+(r?.failed||0)
}

function loadTab(tab){
  if(tab==='users')return loadUsers()
  if(tab==='filters')return loadFilters()
  if(tab==='deliveries')return loadDeliveries()
  if(tab==='logs')return startLogsStream()
  if(tab==='actions')return loadActions()
}
async function refreshAll(){ await loadStats(); await loadTab(activeTab) }

refreshAll()
setInterval(loadStats, 5000)
</script>
</body></html>`

function formatUptime(startedAt) {
  const startMs = new Date(startedAt).getTime()
  if (!Number.isFinite(startMs)) return '—'
  const diff = Math.max(0, Date.now() - startMs)
  const days = Math.floor(diff / (24 * 3600 * 1000))
  const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000))
  const minutes = Math.floor((diff % (3600 * 1000)) / (60 * 1000))
  if (days > 0) return `${days}д ${hours}ч`
  if (hours > 0) return `${hours}ч ${minutes}м`
  return `${minutes}м`
}

function buildUserRecord(session, deliveredCount) {
  const brandFilters = Array.isArray(session?.brandSelections) ? session.brandSelections : []
  const customFilters = Array.isArray(session?.customFilters) ? session.customFilters : []
  const filters = []

  for (const sel of brandFilters) {
    filters.push({
      type: 'brand',
      key: `brand:${cleanText(sel?.brandKey)}:${cleanText(sel?.yearFrom)}:${cleanText(sel?.monthFrom)}`,
      label: `${cleanText(sel?.brandKey) || 'brand'} ${sel?.yearFrom || ''}${sel?.monthFrom ? `.${sel.monthFrom}` : ''}`.trim(),
    })
  }
  for (const f of customFilters) {
    filters.push({
      type: 'custom',
      key: `custom:${cleanText(f?.id || f?.query || f?.url)}`,
      label: cleanText(f?.label || f?.url || f?.query) || 'custom filter',
      url: cleanText(f?.url),
      query: cleanText(f?.query),
    })
  }

  return {
    chatId: cleanText(session?.chatId),
    username: cleanText(session?.username),
    firstName: cleanText(session?.firstName),
    lastName: cleanText(session?.lastName),
    isActive: Boolean(session?.isActive),
    parseScope: cleanText(session?.parseScope) || 'all',
    filterMode: cleanText(session?.filterMode),
    createdAt: cleanText(session?.createdAt),
    updatedAt: cleanText(session?.updatedAt),
    filters,
    filterSummary: cleanText(getFilterSummary?.(session) || ''),
    deliveredCount,
  }
}

export function startAdminServer({ stateStore, logBuffer, env, actions = {} } = {}) {
  const password = cleanText(env?.ADMIN_PASSWORD || env?.ADMIN_PANEL_PASSWORD || 'encar5628')
  const portRaw = Number(env?.ADMIN_PORT || env?.PORT || 3000)
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 3000
  const sessionTtlMs = Number(env?.ADMIN_SESSION_TTL_MS) || DEFAULT_SESSION_TTL_MS
  const sessions = new Map() // token -> expiresAt

  function issueToken() {
    const token = crypto.randomBytes(24).toString('hex')
    sessions.set(token, Date.now() + sessionTtlMs)
    pruneSessions()
    return token
  }
  function pruneSessions() {
    const now = Date.now()
    for (const [tok, exp] of sessions) {
      if (exp <= now) sessions.delete(tok)
    }
  }
  function isAuthed(req) {
    const cookies = parseCookies(req.headers.cookie)
    const tok = cookies[COOKIE_NAME]
    if (!tok) return false
    const exp = sessions.get(tok)
    if (!exp || exp <= Date.now()) {
      sessions.delete(tok)
      return false
    }
    return true
  }
  function setSessionCookie(res, token, expireNow = false) {
    const maxAge = expireNow ? 0 : Math.floor(sessionTtlMs / 1000)
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`)
  }

  async function handleApi(req, res, pathname, url) {
    if (!isAuthed(req)) {
      return jsonResponse(res, 401, { error: 'unauthorized' })
    }

    try {
      if (pathname === '/admin/api/stats' && req.method === 'GET') {
        const allSessions = stateStore.getAllSessions()
        const activeCount = allSessions.filter((s) => s.isActive).length
        const totalFilters = allSessions.reduce((sum, s) => sum + (s.brandSelections?.length || 0) + (s.customFilters?.length || 0), 0)
        const globalStats = stateStore.getGlobalStats()
        const seen = stateStore.getSeenListingsSummary()
        return jsonResponse(res, 200, {
          users: { total: allSessions.length, active: activeCount, totalFilters },
          globalStats,
          seen,
          uptime: formatUptime(globalStats.startedAt),
        })
      }

      if (pathname === '/admin/api/users' && req.method === 'GET') {
        const allSessions = stateStore.getAllSessions()
        const users = allSessions.map((s) => buildUserRecord(s, (stateStore.getDeliveredForChat(s.chatId) || []).length))
          .sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
            return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
          })
        return jsonResponse(res, 200, { users })
      }

      if (pathname === '/admin/api/filter-stats' && req.method === 'GET') {
        const stats = (stateStore.getAllFilterStats?.() || [])
          .sort((a, b) => new Date(b.lastScanAt || 0) - new Date(a.lastScanAt || 0))
        return jsonResponse(res, 200, { stats })
      }

      if (pathname === '/admin/api/deliveries' && req.method === 'GET') {
        const allSessions = stateStore.getAllSessions()
        const byUser = allSessions
          .map((s) => {
            const items = stateStore.getDeliveredForChat(s.chatId)
            const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || (s.username ? `@${s.username}` : '')
            return { chatId: s.chatId, name, items }
          })
          .filter((u) => u.items.length > 0)
          .sort((a, b) => b.items.length - a.items.length)
        return jsonResponse(res, 200, { byUser })
      }

      if (pathname === '/admin/api/logs' && req.method === 'GET') {
        const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 300))
        const sinceId = Math.max(0, Number(url.searchParams.get('sinceId')) || 0)
        const items = logBuffer ? logBuffer.tail(limit, sinceId) : []
        const lastId = items.length ? items[items.length - 1].id : sinceId
        return jsonResponse(res, 200, { items, lastId })
      }

      if (pathname.startsWith('/admin/api/user/') && req.method === 'POST') {
        const parts = pathname.split('/')
        const chatId = decodeURIComponent(parts[4] || '')
        const action = parts[5]
        if (!chatId) return jsonResponse(res, 400, { error: 'chatId required' })
        if (action === 'stop') {
          stateStore.upsertSession(chatId, { isActive: false })
          await stateStore.flush()
          logBuffer?.warn(`ADMIN_USER_STOP | chat_id=${chatId}`)
          return jsonResponse(res, 200, { ok: true })
        }
        if (action === 'start') {
          stateStore.upsertSession(chatId, { isActive: true })
          await stateStore.flush()
          actions.wakeParser?.()
          logBuffer?.warn(`ADMIN_USER_START | chat_id=${chatId}`)
          return jsonResponse(res, 200, { ok: true })
        }
        return jsonResponse(res, 404, { error: 'unknown action' })
      }

      if (pathname === '/admin/api/stop-all' && req.method === 'POST') {
        const allSessions = stateStore.getAllSessions()
        let stopped = 0
        for (const s of allSessions) {
          if (s.isActive) {
            stateStore.upsertSession(s.chatId, { isActive: false })
            stopped += 1
          }
        }
        await stateStore.flush()
        logBuffer?.warn(`ADMIN_STOP_ALL | count=${stopped}`)
        return jsonResponse(res, 200, { stopped })
      }

      if (pathname === '/admin/api/broadcast' && req.method === 'POST') {
        const body = await readBody(req)
        let payload
        try { payload = JSON.parse(body || '{}') } catch { payload = {} }
        const text = cleanText(payload?.text)
        if (!text) return jsonResponse(res, 400, { error: 'text required' })
        if (typeof actions.broadcast !== 'function') {
          return jsonResponse(res, 501, { error: 'broadcast not available' })
        }
        const result = await actions.broadcast(text)
        logBuffer?.warn(`ADMIN_BROADCAST | sent=${result?.sent || 0} | failed=${result?.failed || 0}`)
        return jsonResponse(res, 200, result || { sent: 0, failed: 0 })
      }

      if (pathname === '/admin/api/clear-seen' && req.method === 'POST') {
        const listingsBefore = Object.keys(stateStore.state.seenListings || {}).length
        const vinsBefore = Object.keys(stateStore.state.seenVins || {}).length
        stateStore.state.seenListings = {}
        stateStore.state.seenVins = {}
        stateStore.state.filterStats = {}
        await stateStore.flush()
        logBuffer?.warn(`ADMIN_CLEAR_SEEN | listings=${listingsBefore} | vins=${vinsBefore}`)
        return jsonResponse(res, 200, { listings: listingsBefore, vins: vinsBefore })
      }

      return jsonResponse(res, 404, { error: 'not found' })
    } catch (error) {
      logBuffer?.error(`ADMIN_API_ERROR | ${pathname} | ${cleanText(error?.message) || 'unknown'}`)
      return jsonResponse(res, 500, { error: 'internal error' })
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const pathname = url.pathname

      if (pathname === '/' || pathname === '/admin' || pathname === '/admin/') {
        if (isAuthed(req)) {
          return htmlResponse(res, 200, DASHBOARD_HTML)
        }
        res.writeHead(302, { Location: '/admin/login' })
        return res.end()
      }

      if (pathname === '/admin/login' && req.method === 'GET') {
        if (isAuthed(req)) {
          res.writeHead(302, { Location: '/admin' })
          return res.end()
        }
        return htmlResponse(res, 200, buildLoginPage())
      }

      if (pathname === '/admin/login' && req.method === 'POST') {
        const body = await readBody(req)
        const params = new URLSearchParams(body)
        const given = params.get('password') || ''
        if (!timingSafeEqual(given, password)) {
          return htmlResponse(res, 401, buildLoginPage('Неверный пароль'))
        }
        const token = issueToken()
        setSessionCookie(res, token)
        res.writeHead(302, { Location: '/admin' })
        return res.end()
      }

      if (pathname === '/admin/logout') {
        const cookies = parseCookies(req.headers.cookie)
        const tok = cookies[COOKIE_NAME]
        if (tok) sessions.delete(tok)
        setSessionCookie(res, '', true)
        res.writeHead(302, { Location: '/admin/login' })
        return res.end()
      }

      if (pathname.startsWith('/admin/api/')) {
        return handleApi(req, res, pathname, url)
      }

      if (pathname === '/health' || pathname === '/healthz') {
        return jsonResponse(res, 200, { ok: true })
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' })
      return res.end('Not Found')
    } catch (error) {
      logBuffer?.error(`ADMIN_HTTP_ERROR | ${cleanText(error?.message) || 'unknown'}`)
      try { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Internal error') } catch {}
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, () => {
      logBuffer?.info(`ADMIN_SERVER_LISTEN | port=${port}`)
      resolve({ server, port })
    })
  })
}
