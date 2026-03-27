// ==========================================
// 简历人才管理系统 - 主入口
// ==========================================
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import candidates from './routes/candidates'
import upload from './routes/upload'
import users from './routes/users'
import auth from './routes/auth'
import { verifyToken } from './lib/jwt'

const app = new Hono()

// CORS
app.use('/api/*', cors())

// ==========================================
// 登录相关接口（无需鉴权）
// ==========================================
app.route('/api/auth', auth)

// ==========================================
// JWT 鉴权中间件（保护所有其他 /api/* 接口）
// ==========================================
app.use('/api/*', async (c, next) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return c.json({ success: false, message: '请先登录', code: 'UNAUTHORIZED' }, 401)
  }
  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({ success: false, message: 'token已过期，请重新登录', code: 'TOKEN_EXPIRED' }, 401)
  }
  // 将用户信息挂到 context
  c.set('user', payload)
  await next()
})

// ==========================================
// 业务 API 路由（受鉴权保护）
// ==========================================
app.route('/api/candidates', candidates)
app.route('/api/upload', upload)
app.route('/api/users', users)

app.get('/api/stats', (c) => {
  return c.json({ success: true, message: 'use /api/candidates/stats/overview' })
})

// ==========================================
// 静态文件
// ==========================================
app.use('/static/*', serveStatic({ root: './public' }))

// ==========================================
// 登录页
// ==========================================
app.get('/login', (c) => c.html(getLoginHtml()))

// ==========================================
// SPA 页面（需登录后访问）
// ==========================================
const spaRoutes = ['/', '/candidates', '/candidates/*', '/upload', '/analytics', '/settings']
spaRoutes.forEach(r => app.get(r, (c) => c.html(getIndexHtml())))

// ==========================================
// 登录页 HTML
// ==========================================
function getLoginHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - 简历人才管理系统</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>">
  <script src="/static/tailwind.min.js"></script>
  <link href="/static/fa.min.css" rel="stylesheet">
  <style>
    * { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1e3a5f 100%); display: flex; align-items: center; justify-content: center; }
    .login-card { background: #fff; border-radius: 20px; padding: 44px 40px 36px; width: 400px; max-width: calc(100vw - 32px); box-shadow: 0 25px 60px rgba(0,0,0,0.3); }
    .login-input { width: 100%; padding: 12px 16px 12px 44px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 15px; outline: none; transition: border-color .2s, box-shadow .2s; background: #f8fafc; color: #1e293b; }
    .login-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); background: #fff; }
    .input-wrap { position: relative; }
    .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 15px; pointer-events: none; }
    .eye-btn { position: absolute; right: 13px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; padding: 2px 4px; }
    .eye-btn:hover { color: #2563eb; }
    .login-btn { width: 100%; padding: 13px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background .2s, transform .1s; letter-spacing: .5px; }
    .login-btn:hover { background: #1d4ed8; }
    .login-btn:active { transform: scale(.98); }
    .login-btn:disabled { background: #93c5fd; cursor: not-allowed; }
    .error-msg { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 8px; padding: 10px 14px; font-size: 13px; display: none; align-items: center; gap: 8px; }
    .error-msg.show { display: flex; }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
    .shake { animation: shake .35s ease; }
  </style>
</head>
<body>
  <div class="login-card">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px">
      <div style="width:60px;height:60px;background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 8px 20px rgba(37,99,235,.3)">
        <i class="fas fa-users" style="color:#fff;font-size:24px"></i>
      </div>
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#1e293b">简历人才管理系统</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#94a3b8">智能 HR 招聘平台</p>
    </div>

    <!-- 错误提示 -->
    <div class="error-msg" id="errorMsg">
      <i class="fas fa-exclamation-circle"></i>
      <span id="errorText"></span>
    </div>

    <!-- 表单 -->
    <div style="display:flex;flex-direction:column;gap:16px;margin-top:8px">
      <div>
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">用户名</label>
        <div class="input-wrap">
          <i class="fas fa-user input-icon"></i>
          <input class="login-input" type="text" id="username" placeholder="请输入用户名" autocomplete="username" />
        </div>
      </div>
      <div>
        <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">密码</label>
        <div class="input-wrap">
          <i class="fas fa-lock input-icon"></i>
          <input class="login-input" type="password" id="password" placeholder="请输入密码" autocomplete="current-password" />
          <button class="eye-btn" onclick="togglePwd()" id="eyeBtn" type="button">
            <i class="fas fa-eye" id="eyeIcon"></i>
          </button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
        <input type="checkbox" id="rememberMe" style="width:15px;height:15px;accent-color:#2563eb;cursor:pointer">
        <label for="rememberMe" style="font-size:13px;color:#64748b;cursor:pointer">记住登录状态（7天）</label>
      </div>
      <button class="login-btn" id="loginBtn" onclick="doLogin()">
        <i class="fas fa-sign-in-alt" style="margin-right:6px"></i>登录
      </button>
    </div>

    <p style="text-align:center;font-size:12px;color:#cbd5e1;margin:24px 0 0">
      超级管理员账号：<strong style="color:#94a3b8">admin</strong>
    </p>
  </div>

  <script>
    // 如果已有有效 token，直接跳主页
    const tk = localStorage.getItem('auth_token')
    if (tk) {
      fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + tk } })
        .then(r => r.json()).then(d => { if (d.success) location.href = '/' })
        .catch(() => {})
    }

    // 回车登录
    document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
    document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('password').focus() })

    function togglePwd() {
      const inp = document.getElementById('password')
      const icon = document.getElementById('eyeIcon')
      if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash' }
      else { inp.type = 'password'; icon.className = 'fas fa-eye' }
    }

    function showError(msg) {
      const el = document.getElementById('errorMsg')
      document.getElementById('errorText').textContent = msg
      el.classList.add('show')
      document.querySelector('.login-card').classList.add('shake')
      setTimeout(() => document.querySelector('.login-card').classList.remove('shake'), 400)
    }

    function hideError() { document.getElementById('errorMsg').classList.remove('show') }

    async function doLogin() {
      const username = document.getElementById('username').value.trim()
      const password = document.getElementById('password').value
      const btn = document.getElementById('loginBtn')

      if (!username) { showError('请输入用户名'); document.getElementById('username').focus(); return }
      if (!password) { showError('请输入密码'); document.getElementById('password').focus(); return }

      hideError()
      btn.disabled = true
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>登录中...'

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        const data = await res.json()
        if (data.success) {
          localStorage.setItem('auth_token', data.token)
          localStorage.setItem('auth_user', JSON.stringify(data.user))
          btn.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>登录成功，跳转中...'
          btn.style.background = '#16a34a'
          setTimeout(() => { location.href = '/' }, 600)
        } else {
          showError(data.message || '登录失败')
          btn.disabled = false
          btn.innerHTML = '<i class="fas fa-sign-in-alt" style="margin-right:6px"></i>登录'
          document.getElementById('password').value = ''
          document.getElementById('password').focus()
        }
      } catch (e) {
        showError('网络错误，请稍后重试')
        btn.disabled = false
        btn.innerHTML = '<i class="fas fa-sign-in-alt" style="margin-right:6px"></i>登录'
      }
    }
  </script>
</body>
</html>`
}

// ==========================================
// 主应用 HTML（外壳，JS 在 /static/app.js）
// ==========================================
function getIndexHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>简历人才管理系统</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📋</text></svg>">
  <script src="/static/tailwind.min.js"></script>
  <link href="/static/fa.min.css" rel="stylesheet">
  <script src="/static/chart.min.js"></script>
  <style>
    * { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; }
    .sidebar-link {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border-radius: 10px; color: #cbd5e1; cursor: pointer; transition: all 0.15s;
      text-decoration: none; white-space: nowrap; overflow: hidden; width: 100%; box-sizing: border-box;
    }
    .sidebar-link:hover { background: #1d4ed8; color: #fff; }
    .sidebar-link.active { background: #2563eb; color: #fff; }
    .sidebar-link .menu-icon { flex-shrink: 0; width: 18px; text-align: center; font-size: 14px; }
    .sidebar-link .menu-text { flex: 1; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sidebar-link .menu-badge { flex-shrink: 0; background: #1e40af; font-size: 11px; border-radius: 9999px; padding: 1px 7px; }
    .sidebar-link .menu-arrow { flex-shrink: 0; font-size: 11px; opacity: 0.6; transition: transform 0.2s; }
    .sidebar-link.open .menu-arrow { transform: rotate(90deg); }
    .sub-menu { overflow: hidden; max-height: 0; transition: max-height 0.25s ease; }
    .sub-menu.open { max-height: 200px; }
    .sub-link {
      display: flex; align-items: center; gap: 8px; padding: 8px 14px 8px 38px;
      border-radius: 8px; color: #94a3b8; cursor: pointer; transition: all 0.15s;
      text-decoration: none; white-space: nowrap; font-size: 13px; box-sizing: border-box; width: 100%;
    }
    .sub-link:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
    .sub-link.active { background: rgba(37,99,235,0.5); color: #fff; }
    .sub-link .sub-icon { flex-shrink: 0; width: 16px; text-align: center; font-size: 12px; }
    .tag-skill { background: #dbeafe; color: #1d4ed8; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .tag-industry { background: #dcfce7; color: #15803d; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .tag-trait { background: #f3e8ff; color: #7e22ce; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .tag-education { background: #fef9c3; color: #a16207; font-size: 12px; padding: 1px 8px; border-radius: 9999px; }
    .status-badge { font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 9999px; }
    .loading-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.55); z-index: 99999; display: flex; align-items: center; justify-content: center; pointer-events: all; }
    .card-hover { transition: all 0.2s; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    .progress-bar { transition: width 0.6s ease; }
    .fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  </style>
</head>
<body class="bg-gray-50">

<div id="toastContainer" class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm"></div>

<div class="flex h-screen overflow-hidden">
  <aside style="width:260px;min-width:260px;flex-shrink:0;background:#1e3a5f;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:18px 16px 16px;border-bottom:1px solid rgba(255,255,255,0.1)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:38px;height:38px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-users" style="color:#fff;font-size:16px"></i>
        </div>
        <div style="min-width:0">
          <div style="font-weight:700;color:#fff;font-size:14px;white-space:nowrap;line-height:1.3">简历人才管理</div>
          <div style="color:#93c5fd;font-size:11px;white-space:nowrap;line-height:1.3">智能HR招聘平台</div>
        </div>
      </div>
    </div>

    <nav style="padding:12px 10px;flex:1;display:flex;flex-direction:column;gap:3px;overflow-y:auto">
      <a class="sidebar-link active" onclick="navigateTo('dashboard')" id="nav-dashboard">
        <i class="fas fa-chart-line menu-icon"></i><span class="menu-text">数据看板</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('candidates')" id="nav-candidates">
        <i class="fas fa-users menu-icon"></i><span class="menu-text">人才库</span>
        <span id="candidateCount" class="menu-badge">-</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('archive')" id="nav-archive">
        <i class="fas fa-search menu-icon"></i><span class="menu-text">档案查询</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('upload')" id="nav-upload">
        <i class="fas fa-cloud-upload-alt menu-icon"></i><span class="menu-text">导入简历</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('analytics')" id="nav-analytics">
        <i class="fas fa-chart-bar menu-icon"></i><span class="menu-text">统计分析</span>
      </a>
      <div style="height:1px;background:rgba(255,255,255,0.1);margin:6px 4px"></div>
      <div>
        <a class="sidebar-link" onclick="toggleSettingsMenu()" id="nav-settings">
          <i class="fas fa-cog menu-icon"></i><span class="menu-text">系统设置</span>
          <i class="fas fa-chevron-right menu-arrow" id="settings-arrow"></i>
        </a>
        <div class="sub-menu" id="settings-submenu">
          <a class="sub-link" onclick="navigateToSettings('ai')" id="nav-settings-ai">
            <i class="fas fa-robot sub-icon"></i><span>AI 配置</span>
          </a>
          <a class="sub-link" onclick="navigateToSettings('users')" id="nav-settings-users">
            <i class="fas fa-users-cog sub-icon"></i><span>用户管理</span>
          </a>
          <a class="sub-link" onclick="navigateToSettings('system')" id="nav-settings-system">
            <i class="fas fa-info-circle sub-icon"></i><span>系统信息</span>
          </a>
        </div>
      </div>
    </nav>

    <!-- 当前登录用户 + 退出 -->
    <div style="padding:10px 10px 14px;border-top:1px solid rgba(255,255,255,0.1)">
      <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:8px">
        <div style="font-size:11px;color:#93c5fd;margin-bottom:6px">AI解析状态</div>
        <div style="display:flex;align-items:center;gap:7px">
          <div id="aiStatusDot" style="width:8px;height:8px;border-radius:50%;background:#9ca3af;flex-shrink:0"></div>
          <span id="aiStatusText" style="font-size:12px;color:#d1d5db;white-space:nowrap">未配置</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px">
        <div style="display:flex;align-items:center;gap:7px;min-width:0">
          <div style="width:26px;height:26px;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:#fff;font-weight:700" id="userAvatar">?</div>
          <div style="min-width:0">
            <div style="font-size:12px;color:#e2e8f0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px" id="userDisplayName">-</div>
            <div style="font-size:10px;color:#94a3b8" id="userRoleBadge">-</div>
          </div>
        </div>
        <button onclick="doLogout()" title="退出登录" style="background:rgba(255,255,255,0.08);border:none;border-radius:7px;padding:5px 8px;cursor:pointer;color:#94a3b8;transition:all .15s" onmouseover="this.style.background='rgba(239,68,68,.2)';this.style.color='#fca5a5'" onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.color='#94a3b8'">
          <i class="fas fa-sign-out-alt" style="font-size:13px"></i>
        </button>
      </div>
    </div>
  </aside>

  <main class="flex-1 overflow-auto" id="mainContent"></main>
</div>

<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
