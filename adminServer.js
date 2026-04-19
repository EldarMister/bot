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
    ? `<div class="login-alert">${errorText.replace(/</g, '&lt;')}</div>`
    : ''
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Encar Bot Admin</title>
<style>
  :root{
    --bg:#06111d;
    --bg-alt:#0a1828;
    --panel:#0f2033;
    --line:rgba(146,173,203,.18);
    --text:#eff6ff;
    --muted:#9eb1c8;
    --accent:#4da2ff;
    --accent-2:#17c3b2;
    --warm:#ffb44d;
    --danger:#ff7a7a;
    --shadow:0 28px 70px rgba(1,8,18,.55);
  }
  *{box-sizing:border-box}
  body{
    margin:0;
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    color:var(--text);
    font-family:"Trebuchet MS","Segoe UI Variable Text","Segoe UI",sans-serif;
    background:
      radial-gradient(circle at top left, rgba(77,162,255,.22), transparent 32%),
      radial-gradient(circle at bottom right, rgba(255,180,77,.18), transparent 28%),
      linear-gradient(160deg, var(--bg) 0%, var(--bg-alt) 55%, #071523 100%);
    overflow:hidden;
  }
  body::before,
  body::after{
    content:"";
    position:fixed;
    width:42vw;
    height:42vw;
    border-radius:50%;
    filter:blur(60px);
    opacity:.24;
    pointer-events:none;
  }
  body::before{top:-12vw;right:-10vw;background:rgba(77,162,255,.45)}
  body::after{bottom:-18vw;left:-10vw;background:rgba(23,195,178,.28)}
  .login-card{
    position:relative;
    z-index:1;
    width:min(420px,100%);
    border:1px solid var(--line);
    border-radius:28px;
    box-shadow:var(--shadow);
    backdrop-filter:blur(18px);
    overflow:hidden;
    padding:30px;
    background:linear-gradient(180deg, rgba(14,28,44,.94), rgba(10,20,32,.92));
  }
  .login-card::after{
    content:"";
    position:absolute;
    inset:18px;
    border-radius:22px;
    border:1px solid rgba(255,255,255,.05);
    pointer-events:none;
  }
  .login-badge{
    display:inline-flex;
    align-items:center;
    gap:8px;
    width:max-content;
    padding:8px 12px;
    border-radius:999px;
    background:rgba(255,180,77,.12);
    color:#ffd69c;
    font-size:12px;
    letter-spacing:.1em;
    text-transform:uppercase;
  }
  .login-card h2{
    margin:10px 0 8px;
    font-size:28px;
    letter-spacing:-.03em;
  }
  .login-card p{
    margin:0;
    color:var(--muted);
    line-height:1.6;
    font-size:14px;
  }
  .field{
    display:grid;
    gap:8px;
  }
  .field span{
    font-size:13px;
    color:#bfd0e3;
  }
  .field input{
    width:100%;
    padding:15px 16px;
    border-radius:16px;
    border:1px solid var(--line);
    background:rgba(6,17,29,.6);
    color:var(--text);
    font-size:15px;
    outline:none;
    transition:border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }
  .field input:focus{
    border-color:rgba(77,162,255,.7);
    box-shadow:0 0 0 4px rgba(77,162,255,.12);
    transform:translateY(-1px);
  }
  .login-alert{
    padding:12px 14px;
    border-radius:16px;
    border:1px solid rgba(255,122,122,.28);
    background:rgba(78,19,29,.5);
    color:#ffd6d6;
    font-size:13px;
  }
  .submit{
    border:0;
    border-radius:16px;
    padding:15px 18px;
    background:linear-gradient(135deg, var(--accent), #2f74ff 58%, var(--accent-2));
    color:#fff;
    font-size:15px;
    font-weight:700;
    cursor:pointer;
    transition:transform .18s ease, box-shadow .18s ease, filter .18s ease;
    box-shadow:0 16px 30px rgba(43,110,255,.28);
  }
  .submit:hover{
    transform:translateY(-1px);
    filter:brightness(1.04);
  }
  .login-foot{
    color:var(--muted);
    font-size:12px;
    line-height:1.5;
  }
  @media (max-width:640px){
    body{padding:16px}
    .login-card{padding:22px}
  }
</style>
</head>
<body>
  <form class="login-card" method="POST" action="/admin/login">
    <div>
      <div class="login-badge">Restricted Access</div>
      <h2>Вход в панель</h2>
      <p>Используй пароль администратора, чтобы открыть управление ботом и служебные действия.</p>
    </div>
    ${errHtml}
    <label class="field">
      <span>Пароль</span>
      <input type="password" name="password" placeholder="Введите пароль" autofocus required/>
    </label>
    <button class="submit" type="submit">Открыть панель</button>
    <div class="login-foot">Сессия хранится локально и предназначена только для этой админ‑панели.</div>
  </form>
</body>
</html>`
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Encar Bot Admin</title>
<style>
  :root{
    --bg:#06111d;
    --bg-alt:#081726;
    --panel:#102236;
    --panel-soft:rgba(16,34,54,.78);
    --line:rgba(150,178,210,.16);
    --line-strong:rgba(150,178,210,.3);
    --text:#eff6ff;
    --muted:#9db0c7;
    --accent:#4da2ff;
    --accent-2:#18c3b3;
    --warm:#ffb44d;
    --danger:#ff7a7a;
    --danger-strong:#d54e60;
    --success:#21c087;
    --warning:#ffb44d;
    --shadow:0 24px 60px rgba(1,8,18,.42);
    --radius-xl:28px;
    --radius-lg:22px;
  }
  *{box-sizing:border-box}
  body{
    margin:0;
    color:var(--text);
    font-family:"Trebuchet MS","Segoe UI Variable Text","Segoe UI",sans-serif;
    background:
      radial-gradient(circle at top left, rgba(77,162,255,.2), transparent 28%),
      radial-gradient(circle at bottom right, rgba(255,180,77,.16), transparent 24%),
      linear-gradient(180deg, var(--bg) 0%, var(--bg-alt) 100%);
  }
  body::before,
  body::after{
    content:"";
    position:fixed;
    width:36vw;
    height:36vw;
    border-radius:50%;
    filter:blur(70px);
    pointer-events:none;
    opacity:.18;
  }
  body::before{top:-12vw;right:-6vw;background:rgba(77,162,255,.6)}
  body::after{bottom:-14vw;left:-8vw;background:rgba(24,195,179,.38)}
  .app-shell{
    position:relative;
    z-index:1;
    min-height:100vh;
  }
  .topbar{
    position:sticky;
    top:0;
    z-index:20;
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:16px;
    padding:24px clamp(18px,3vw,34px);
    backdrop-filter:blur(18px);
    background:rgba(6,17,29,.72);
    border-bottom:1px solid var(--line);
  }
  .eyebrow{
    display:inline-flex;
    align-items:center;
    gap:10px;
    padding:8px 12px;
    border-radius:999px;
    background:rgba(77,162,255,.12);
    color:#d0e5ff;
    font-size:11px;
    letter-spacing:.16em;
    text-transform:uppercase;
  }
  .eyebrow::before{
    content:"";
    width:9px;
    height:9px;
    border-radius:50%;
    background:linear-gradient(135deg,var(--accent),var(--accent-2));
    box-shadow:0 0 0 6px rgba(77,162,255,.12);
  }
  .title-row{
    display:flex;
    align-items:center;
    gap:12px;
    margin-top:14px;
    flex-wrap:wrap;
  }
  .title-row h1{
    margin:0;
    font-size:clamp(28px,4vw,42px);
    letter-spacing:-.05em;
    line-height:.95;
  }
  .status-pill{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 12px;
    border-radius:999px;
    background:rgba(33,192,135,.12);
    color:#bff8df;
    font-size:12px;
    font-weight:700;
    letter-spacing:.08em;
    text-transform:uppercase;
  }
  .status-pill::before{
    content:"";
    width:8px;
    height:8px;
    border-radius:50%;
    background:var(--success);
    box-shadow:0 0 0 5px rgba(33,192,135,.12);
  }
  .subline{
    margin:10px 0 0;
    color:var(--muted);
    font-size:14px;
    line-height:1.6;
  }
  .topbar-actions{
    display:flex;
    gap:10px;
    align-items:center;
    flex-wrap:wrap;
    justify-content:flex-end;
  }
  button,
  .btn{
    appearance:none;
    border:0;
    border-radius:14px;
    padding:11px 16px;
    background:rgba(16,34,54,.92);
    color:var(--text);
    cursor:pointer;
    font-size:14px;
    font-weight:700;
    text-decoration:none;
    transition:transform .18s ease, background .18s ease, box-shadow .18s ease, border-color .18s ease;
    border:1px solid transparent;
  }
  button:hover,
  .btn:hover{
    transform:translateY(-1px);
    background:rgba(22,46,72,.96);
  }
  button.primary,
  .btn.primary{
    background:linear-gradient(135deg, var(--accent), #2f74ff 58%, var(--accent-2));
    box-shadow:0 14px 28px rgba(43,110,255,.24);
  }
  button.primary:hover,
  .btn.primary:hover{
    filter:brightness(1.05);
  }
  button.ghost,
  .btn.ghost{
    background:rgba(255,255,255,.04);
    border-color:var(--line);
  }
  button.danger,
  .btn.danger{
    background:linear-gradient(135deg, rgba(213,78,96,.96), rgba(159,33,59,.92));
    box-shadow:0 12px 26px rgba(159,33,59,.24);
  }
  button.small,
  .btn.small{
    padding:8px 12px;
    font-size:12px;
    border-radius:12px;
  }
  main{
    width:min(1480px, calc(100% - 32px));
    margin:0 auto;
    padding:24px 0 36px;
  }
  .hero-grid{
    display:grid;
    grid-template-columns:minmax(0,1.45fr) minmax(320px,.9fr);
    gap:18px;
    margin-bottom:18px;
  }
  .surface{
    position:relative;
    overflow:hidden;
    border:1px solid var(--line);
    border-radius:var(--radius-xl);
    background:linear-gradient(180deg, rgba(16,34,54,.9), rgba(10,22,35,.88));
    box-shadow:var(--shadow);
    backdrop-filter:blur(14px);
  }
  .surface::after{
    content:"";
    position:absolute;
    inset:16px;
    border-radius:20px;
    border:1px solid rgba(255,255,255,.04);
    pointer-events:none;
  }
  .hero-card{
    padding:24px;
  }
  .hero-kicker,
  .section-kicker{
    color:#a9c3df;
    letter-spacing:.16em;
    font-size:11px;
    text-transform:uppercase;
  }
  .hero-head{
    display:flex;
    justify-content:space-between;
    gap:20px;
    align-items:flex-start;
    margin-top:12px;
    flex-wrap:wrap;
  }
  .hero-head h2{
    margin:0;
    font-size:30px;
    line-height:1;
    letter-spacing:-.045em;
  }
  .hero-head p{
    margin:10px 0 0;
    color:var(--muted);
    line-height:1.6;
    max-width:62ch;
  }
  .hero-meta{
    display:grid;
    gap:10px;
    min-width:230px;
  }
  .hero-meta-card{
    padding:14px 16px;
    border-radius:18px;
    background:rgba(6,17,29,.34);
    border:1px solid var(--line);
  }
  .hero-meta-card strong{
    display:block;
    font-size:13px;
    color:#d8eaff;
  }
  .hero-meta-card span{
    display:block;
    margin-top:5px;
    color:var(--muted);
    font-size:12px;
    line-height:1.5;
  }
  .tab-grid{
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:10px;
    margin-top:16px;
  }
  .tab{
    width:100%;
    text-align:left;
    padding:14px 16px;
    border-radius:18px;
    background:rgba(7,17,29,.38);
    border:1px solid var(--line);
    color:#d5e6fb;
  }
  .tab-label{
    display:block;
    font-size:14px;
    font-weight:700;
  }
  .tab-desc{
    display:block;
    margin-top:4px;
    color:var(--muted);
    font-size:12px;
    line-height:1.4;
  }
  .tab.active{
    background:linear-gradient(135deg, rgba(77,162,255,.18), rgba(24,195,179,.14));
    border-color:rgba(77,162,255,.48);
    box-shadow:inset 0 0 0 1px rgba(77,162,255,.12);
  }
  .stats-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
    gap:14px;
    margin-bottom:18px;
  }
  .stat{
    padding:18px;
    border-radius:24px;
    background:linear-gradient(180deg, rgba(16,34,54,.92), rgba(9,20,31,.88));
    border:1px solid var(--line);
    box-shadow:var(--shadow);
    position:relative;
    overflow:hidden;
  }
  .stat::before{
    content:"";
    position:absolute;
    top:0;
    left:0;
    right:0;
    height:4px;
    opacity:.92;
  }
  .stat.tone-1::before{background:linear-gradient(90deg,var(--accent),#78bcff)}
  .stat.tone-2::before{background:linear-gradient(90deg,var(--accent-2),#6ae4d6)}
  .stat.tone-3::before{background:linear-gradient(90deg,var(--warm),#ffd47f)}
  .stat.tone-4::before{background:linear-gradient(90deg,#f18cd8,#ffd47f)}
  .stat .label{
    color:#9ab0c9;
    font-size:11px;
    letter-spacing:.12em;
    text-transform:uppercase;
  }
  .stat .value{
    margin-top:12px;
    font-size:31px;
    letter-spacing:-.05em;
    font-weight:800;
    line-height:.95;
  }
  .stat .note{
    margin-top:8px;
    color:var(--muted);
    font-size:12px;
    line-height:1.45;
  }
  .panel-stack{
    display:grid;
    gap:16px;
  }
  .panel{
    min-height:240px;
    padding:22px;
  }
  .section-head{
    display:flex;
    justify-content:space-between;
    gap:14px;
    align-items:flex-start;
    margin-bottom:18px;
    flex-wrap:wrap;
  }
  .section-head h2{
    margin:8px 0 0;
    font-size:26px;
    line-height:1;
    letter-spacing:-.04em;
  }
  .section-head p{
    margin:10px 0 0;
    color:var(--muted);
    font-size:14px;
    line-height:1.55;
    max-width:70ch;
  }
  .toolbar-meta,
  .section-toolbar{
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
  }
  .section-pill,
  .pill{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 11px;
    border-radius:999px;
    background:rgba(77,162,255,.12);
    color:#d4e9ff;
    font-size:12px;
    font-weight:700;
  }
  .section-pill.warn{background:rgba(255,180,77,.12);color:#ffdeae}
  .section-pill.soft{background:rgba(255,255,255,.06);color:#dce9f7}
  .table-shell{
    overflow:auto;
    border-radius:20px;
    border:1px solid var(--line);
    background:rgba(7,17,29,.3);
  }
  table{
    width:100%;
    border-collapse:collapse;
    font-size:13px;
    min-width:920px;
  }
  th,td{
    text-align:left;
    padding:14px 16px;
    border-bottom:1px solid rgba(150,178,210,.12);
    vertical-align:top;
  }
  th{
    position:sticky;
    top:0;
    background:rgba(10,22,35,.96);
    color:#9db1c8;
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:.14em;
    z-index:1;
  }
  tbody tr:hover td{
    background:rgba(255,255,255,.02);
  }
  tbody tr:last-child td{
    border-bottom:0;
  }
  code,
  .mono{
    font-family:"Cascadia Code","IBM Plex Mono","Consolas",monospace;
    font-size:12px;
  }
  .stack{
    display:grid;
    gap:5px;
  }
  .muted{
    color:var(--muted);
    font-size:12px;
    line-height:1.45;
  }
  .badge{
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:7px 11px;
    border-radius:999px;
    font-size:12px;
    font-weight:700;
  }
  .badge::before{
    content:"";
    width:8px;
    height:8px;
    border-radius:50%;
  }
  .badge.on{
    background:rgba(33,192,135,.12);
    color:#bff8df;
  }
  .badge.on::before{background:var(--success)}
  .badge.off{
    background:rgba(255,180,77,.12);
    color:#ffdca3;
  }
  .badge.off::before{background:var(--warning)}
  .badge.warn{
    background:rgba(255,122,122,.12);
    color:#ffd3d3;
  }
  .badge.warn::before{background:var(--danger)}
  .chip-cloud{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
  }
  .chip{
    display:inline-flex;
    align-items:center;
    padding:7px 10px;
    background:rgba(6,17,29,.42);
    border:1px solid var(--line);
    border-radius:12px;
    font-size:11px;
    font-family:"Cascadia Code","IBM Plex Mono","Consolas",monospace;
    color:#dceaf8;
  }
  .group-stack{
    display:grid;
    gap:14px;
  }
  .group-card{
    border-radius:22px;
    border:1px solid var(--line);
    background:rgba(7,17,29,.26);
    padding:18px;
  }
  .group-head{
    display:flex;
    justify-content:space-between;
    gap:12px;
    align-items:flex-start;
    margin-bottom:14px;
    flex-wrap:wrap;
  }
  .group-title{
    margin:0;
    font-size:18px;
  }
  .logs{
    border-radius:20px;
    border:1px solid var(--line);
    background:#040b13;
    min-height:380px;
    max-height:62vh;
    overflow:auto;
    padding:14px;
    font-family:"Cascadia Code","IBM Plex Mono","Consolas",monospace;
    font-size:12px;
    line-height:1.56;
  }
  .log-line{
    margin:0;
    padding:4px 0;
    white-space:pre-wrap;
    word-break:break-word;
  }
  .log-info{color:#dbe8f6}
  .log-warn{color:#ffd08a}
  .log-error{color:#ffb0b0}
  .log-ts{
    color:#667f9d;
    margin-right:10px;
  }
  .row{
    display:flex;
    gap:12px;
    align-items:center;
    flex-wrap:wrap;
  }
  textarea,
  input[type=text]{
    width:100%;
    border-radius:18px;
    border:1px solid var(--line);
    background:rgba(6,17,29,.45);
    color:var(--text);
    padding:14px 16px;
    font-size:14px;
    font-family:inherit;
    outline:none;
  }
  textarea:focus,
  input[type=text]:focus{
    border-color:rgba(77,162,255,.6);
    box-shadow:0 0 0 4px rgba(77,162,255,.1);
  }
  textarea{min-height:140px;resize:vertical}
  .link{
    color:#8cc7ff;
    text-decoration:none;
    font-weight:700;
  }
  .link:hover{text-decoration:underline}
  .action-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
    gap:14px;
  }
  .action-card{
    padding:18px;
    border-radius:22px;
    border:1px solid var(--line);
    background:rgba(7,17,29,.26);
  }
  .action-card h3{
    margin:0 0 8px;
    font-size:18px;
  }
  .action-card p{
    margin:0 0 14px;
    color:var(--muted);
    line-height:1.6;
    font-size:13px;
  }
  .empty-state{
    display:grid;
    place-items:center;
    min-height:220px;
    border-radius:22px;
    border:1px dashed rgba(150,178,210,.2);
    background:rgba(7,17,29,.18);
    text-align:center;
    padding:24px;
  }
  .empty-state strong{
    display:block;
    font-size:18px;
    margin-bottom:8px;
  }
  .empty-state span{
    color:var(--muted);
    font-size:14px;
    line-height:1.6;
    max-width:48ch;
  }
  @media (max-width:1120px){
    .hero-grid{grid-template-columns:1fr}
  }
  @media (max-width:820px){
    .topbar{
      position:static;
      flex-direction:column;
      align-items:stretch;
    }
    main{width:min(100%, calc(100% - 20px));padding-top:14px}
    .topbar-actions{justify-content:flex-start}
    .tab-grid{grid-template-columns:1fr}
    .stats-grid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
    .panel{padding:18px}
  }
</style>
</head>
<body>
<div class="app-shell">
  <header class="topbar">
    <div>
      <div class="eyebrow">Encar Bot Control</div>
      <div class="title-row">
        <h1>Админ‑панель</h1>
        <span class="status-pill">Online</span>
      </div>
      <p class="subline" id="status-line">Загружаем сводку по боту и пользователям…</p>
    </div>
    <div class="topbar-actions">
      <button class="ghost" onclick="refreshAll()">Обновить</button>
      <a class="btn" href="/admin/logout">Выйти</a>
    </div>
  </header>
  <main>
    <section class="hero-grid">
      <article class="surface hero-card">
        <div class="hero-kicker">Оперативная сводка</div>
        <div class="hero-head">
          <div>
            <h2>Мониторинг Encar Bot</h2>
            <p>Пользователи, фильтры, доставки и ручные действия собраны в одном интерфейсе без визуального мусора и времянок.</p>
          </div>
          <div class="hero-meta" id="hero-meta">
            <div class="hero-meta-card">
              <strong>Статус панели</strong>
              <span>Подключаем API и собираем первую сводку…</span>
            </div>
          </div>
        </div>
      </article>
      <aside class="surface hero-card">
        <div class="hero-kicker">Разделы</div>
        <div class="tab-grid">
          <button class="tab active" data-tab="users" type="button">
            <span class="tab-label">Пользователи</span>
            <span class="tab-desc">Сессии, фильтры и ручное управление</span>
          </button>
          <button class="tab" data-tab="filters" type="button">
            <span class="tab-label">Фильтры</span>
            <span class="tab-desc">Нагрузка, свежие объявления и ошибки</span>
          </button>
          <button class="tab" data-tab="deliveries" type="button">
            <span class="tab-label">Доставки</span>
            <span class="tab-desc">История отправленных машин по чатам</span>
          </button>
          <button class="tab" data-tab="logs" type="button">
            <span class="tab-label">Логи</span>
            <span class="tab-desc">Поток событий и диагностика в реальном времени</span>
          </button>
          <button class="tab" data-tab="actions" type="button">
            <span class="tab-label">Действия</span>
            <span class="tab-desc">Broadcast, stop all и очистка состояния</span>
          </button>
        </div>
      </aside>
    </section>
    <section class="stats-grid" id="stats"></section>
    <section class="panel-stack">
      <div class="surface panel" id="panel-users"></div>
      <div class="surface panel" id="panel-filters" style="display:none"></div>
      <div class="surface panel" id="panel-deliveries" style="display:none"></div>
      <div class="surface panel" id="panel-logs" style="display:none"></div>
      <div class="surface panel" id="panel-actions" style="display:none"></div>
    </section>
  </main>
</div>
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
const tabMeta = {
  users: {
    kicker: 'Пользователи',
    title: 'Сессии и ручное управление',
    subtitle: 'Смотри, кто сейчас активен, какие фильтры висят на пользователях и кому нужно вручную включить или остановить парсинг.',
  },
  filters: {
    kicker: 'Фильтры',
    title: 'Нагрузка и качество выдачи',
    subtitle: 'По каждому фильтру видны сканы, объём обработанных объявлений, свежие попадания, дубли VIN и сетевые ошибки.',
  },
  deliveries: {
    kicker: 'Доставки',
    title: 'Отправленные объявления',
    subtitle: 'История доставок сгруппирована по пользователям, чтобы быстро проверить, что именно уже ушло в Telegram.',
  },
  logs: {
    kicker: 'Логи',
    title: 'Поток событий в реальном времени',
    subtitle: 'Сервисные события, сетевые ошибки и ручные действия администратора в терминальном представлении без отдельного tail.',
  },
  actions: {
    kicker: 'Действия',
    title: 'Глобальные команды',
    subtitle: 'Рассылка всем активным пользователям, массовая остановка парсинга и жёсткий сброс seen‑состояния.',
  },
}

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
function fmtPrice(krw){if(!krw)return'—';return new Intl.NumberFormat('ru-RU').format(Math.round(krw/10000))+' ×10k ₩'}
function renderEmptyState(title, body){
  return \`<div class="empty-state"><div><strong>\${esc(title)}</strong><span>\${esc(body)}</span></div></div>\`
}
function renderPanelFrame(tab, content, toolbar=''){
  const meta = tabMeta[tab]
  return \`<div class="section-head">
    <div>
      <div class="section-kicker">\${esc(meta.kicker)}</div>
      <h2>\${esc(meta.title)}</h2>
      <p>\${esc(meta.subtitle)}</p>
    </div>
    \${toolbar ? \`<div class="section-toolbar">\${toolbar}</div>\` : ''}
  </div>\${content}\`
}
function setStatusLine(text){
  const node = document.getElementById('status-line')
  if(node) node.textContent = text
}
function setHeroMeta(cards){
  const node = document.getElementById('hero-meta')
  if(!node) return
  node.innerHTML = cards.map((card)=>\`<div class="hero-meta-card"><strong>\${esc(card.title)}</strong><span>\${esc(card.body)}</span></div>\`).join('')
}

async function api(path, opts){
  const r = await fetch(path, Object.assign({credentials:'same-origin'}, opts||{}))
  if (r.status === 401){location.href='/admin/login';return null}
  return r.json()
}

async function loadStats(){
  const s = await api('/admin/api/stats'); if(!s) return
  const grid = document.getElementById('stats')
  const cards = [
    { label:'Пользователи', value:fmtNum(s.users.total), note:'Всего зарегистрированных сессий', tone:1 },
    { label:'Активные', value:fmtNum(s.users.active), note:'Сейчас участвуют в парсинге', tone:2 },
    { label:'Фильтры', value:fmtNum(s.users.totalFilters), note:'Брендовые и кастомные фильтры', tone:3 },
    { label:'Доставки', value:fmtNum(s.globalStats.totalDelivered), note:'Отправленных машин за всё время', tone:4 },
    { label:'Сканирования', value:fmtNum(s.globalStats.totalScans), note:'Полные циклы обхода', tone:1 },
    { label:'Страницы', value:fmtNum(s.globalStats.totalPages), note:'Страниц обработано суммарно', tone:2 },
    { label:'Проверено', value:fmtNum(s.globalStats.totalListingsChecked), note:'Объявлений прошло через фильтры', tone:3 },
    { label:'Seen listings', value:fmtNum(s.seen.total), note:'Ключей объявлений в памяти', tone:4 },
    { label:'VIN в памяти', value:fmtNum(s.seen.vinsTracked), note:'Трекер дубликатов по VIN', tone:1 },
    { label:'Uptime', value:s.uptime, note:'Текущее время работы процесса', tone:2 },
  ]
  grid.innerHTML = cards.map((card)=>\`<article class="stat tone-\${card.tone}"><div class="label">\${esc(card.label)}</div><div class="value">\${esc(card.value)}</div><div class="note">\${esc(card.note)}</div></article>\`).join('')
  setStatusLine('Последнее обновление: '+new Date().toLocaleString('ru-RU')+' • активных пользователей: '+fmtNum(s.users.active))
  setHeroMeta([
    { title:'Текущий uptime', body:s.uptime },
    { title:'Активных фильтров', body:fmtNum(s.users.totalFilters)+' в работе или ожидании' },
    { title:'Seen + VIN', body:fmtNum(s.seen.total)+' ключей и '+fmtNum(s.seen.vinsTracked)+' VIN в памяти' },
  ])
}

async function loadUsers(){
  const d = await api('/admin/api/users'); if(!d) return
  const activeUsers = d.users.filter((u)=>u.isActive).length
  const rows = d.users.map((u)=>{
    const name = [u.firstName,u.lastName].filter(Boolean).join(' ') || (u.username?'@'+u.username:'') || '—'
    const filters = u.filters.length
      ? \`<div class="chip-cloud">\${u.filters.map((f)=>\`<div class="chip" title="\${esc(f.key)}">\${esc(f.label)}</div>\`).join('')}</div>\`
      : '<span class="muted">Фильтров пока нет</span>'
    const status = u.isActive ? '<span class="badge on">Активен</span>' : '<span class="badge off">Пауза</span>'
    const summary = u.filterSummary ? \`<div class="muted">\${esc(u.filterSummary)}</div>\` : ''
    return \`<tr>
      <td><code>\${esc(u.chatId)}</code></td>
      <td><div class="stack"><strong>\${esc(name)}</strong>\${u.username?\`<div class="muted">@\${esc(u.username)}</div>\`:''}\${summary}</div></td>
      <td>\${status}</td>
      <td>\${filters}</td>
      <td class="muted">\${fmtDate(u.updatedAt)}</td>
      <td><span class="section-pill soft">\${fmtNum(u.deliveredCount)}</span></td>
      <td>
        \${u.isActive
          ? \`<button class="danger small" onclick="stopUser('\${esc(u.chatId)}')">Остановить</button>\`
          : \`<button class="primary small" onclick="startUser('\${esc(u.chatId)}')">Запустить</button>\`}
      </td>
    </tr>\`
  }).join('')
  const content = rows
    ? \`<div class="table-shell"><table>
      <thead><tr><th>chat_id</th><th>Имя</th><th>Статус</th><th>Фильтры</th><th>Обновлено</th><th>Доставлено</th><th></th></tr></thead>
      <tbody>\${rows}</tbody></table></div>\`
    : renderEmptyState('Пользователей пока нет', 'Когда бот создаст первые сессии, они появятся здесь вместе с фильтрами и последней активностью.')
  panels.users.innerHTML = renderPanelFrame('users', content, \`<div class="toolbar-meta"><span class="section-pill">\${fmtNum(d.users.length)} всего</span><span class="section-pill soft">\${fmtNum(activeUsers)} активных</span></div>\`)
}

async function loadFilters(){
  const d = await api('/admin/api/filter-stats'); if(!d) return
  const noisy = d.stats.filter((s)=>Number(s.networkErrors)||0).length
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
  const content = rows
    ? \`<div class="table-shell"><table>
      <thead><tr><th>Фильтр</th><th>Сканы</th><th>Страницы</th><th>Проверено</th><th>Свежие</th><th>Отфильтровано</th><th>VIN‑дубли</th><th>Ошибки сети</th><th>Последний скан</th><th>Последняя свежая</th></tr></thead>
      <tbody>\${rows}</tbody></table></div>\`
    : renderEmptyState('Фильтр-статистика пуста', 'После первого прохода парсера здесь появятся метрики по нагрузке и качеству выдачи для каждого фильтра.')
  panels.filters.innerHTML = renderPanelFrame('filters', content, \`<div class="toolbar-meta"><span class="section-pill">\${fmtNum(d.stats.length)} фильтров</span><span class="section-pill \${noisy ? 'warn' : 'soft'}">\${fmtNum(noisy)} с ошибками сети</span></div>\`)
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
      <td>\${it.link?\`<a class="link" href="\${esc(it.link)}" target="_blank" rel="noreferrer">Открыть</a>\`:''}</td>
    </tr>\`).join('')
    return \`<section class="group-card">
      <div class="group-head">
        <div>
          <h3 class="group-title">\${esc(u.name||'Без имени')}</h3>
          <div class="muted">chat_id \${esc(u.chatId)}</div>
        </div>
        <span class="section-pill">\${fmtNum(u.items.length)} доставок</span>
      </div>
      <div class="table-shell">
        <table>
          <thead><tr><th>ID</th><th>Машина</th><th>Год</th><th>Пробег</th><th>Цена</th><th>Фильтр</th><th>Доставлено</th><th></th></tr></thead>
          <tbody>\${list}</tbody>
        </table>
      </div>
    </section>\`
  }).join('')
  const content = sections
    ? \`<div class="group-stack">\${sections}</div>\`
    : renderEmptyState('Доставок ещё нет', 'Когда бот начнёт отправлять новые объявления пользователям, здесь появится история по каждому чату.')
  panels.deliveries.innerHTML = renderPanelFrame('deliveries', content, \`<div class="toolbar-meta"><span class="section-pill">\${fmtNum(d.byUser.length)} пользователей с доставками</span></div>\`)
}

async function loadLogsInitial(){
  const d = await api('/admin/api/logs?limit=300'); if(!d) return
  lastLogId = d.lastId || 0
  panels.logs.innerHTML = renderPanelFrame('logs', \`<div class="row" style="margin-bottom:14px">
    <button class="ghost small" onclick="clearLogsView()">Очистить окно</button>
    <span class="section-pill soft" id="log-status">streaming…</span>
  </div>
  <div class="logs" id="logs-container"></div>\`, \`<div class="toolbar-meta"><span class="section-pill">\${fmtNum(d.items.length)} строк</span></div>\`)
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
  panels.actions.innerHTML = renderPanelFrame('actions', \`<div class="action-grid">
    <section class="action-card">
      <h3>Рассылка всем активным</h3>
      <p>Отправь единое сообщение всем пользователям, у которых парсинг сейчас включён.</p>
      <textarea id="broadcast-text" placeholder="Текст сообщения для активных пользователей..."></textarea>
      <div class="row" style="margin-top:12px">
        <button class="primary" onclick="doBroadcast()">Отправить рассылку</button>
        <span id="broadcast-status" class="muted"></span>
      </div>
    </section>
    <section class="action-card">
      <h3>Остановить всех</h3>
      <p>Массово отключает парсинг у всех активных пользователей. Используй, когда нужно быстро погасить нагрузку.</p>
      <button class="danger" onclick="stopAll()">Выключить парсинг у всех</button>
    </section>
    <section class="action-card">
      <h3>Сбросить seen‑состояние</h3>
      <p>После очистки бот снова увидит старые объявления как новые. Это приведёт к повторным уведомлениям, поэтому действие опасное.</p>
      <button class="danger" onclick="clearSeen()">Сбросить seen + VIN + статистику</button>
    </section>
  </div>\`)
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
  if(!confirm('Остановить парсинг у всех пользователей?'))return
  const r = await api('/admin/api/stop-all', {method:'POST'})
  alert('Остановлено: '+(r?.stopped||0))
  await refreshAll()
}
async function clearSeen(){
  if(!confirm('Точно сбросить всю историю? Это приведёт к повторным уведомлениям.'))return
  const r = await api('/admin/api/clear-seen', {method:'POST'})
  alert('Сброшено. Было: listings='+(r?.listings||0)+', vins='+(r?.vins||0))
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
</body>
</html>`

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
      try {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal error')
      } catch {}
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
