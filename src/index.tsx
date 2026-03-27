// ==========================================
// 简历人才管理系统 - 主入口
// ==========================================
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import candidates from './routes/candidates'
import upload from './routes/upload'
import users from './routes/users'

const app = new Hono()

// 中间件
app.use('/api/*', cors())

// API路由
app.route('/api/candidates', candidates)
app.route('/api/upload', upload)
app.route('/api/users', users)

// 统计数据API（快捷路由）
app.get('/api/stats', (c) => {
  return c.json({ success: true, message: 'use /api/candidates/stats/overview' })
})

// 静态文件服务
app.use('/static/*', serveStatic({ root: './public' }))

// 所有前端路由都返回 index.html（SPA模式）
app.get('/', (c) => c.html(getIndexHtml()))
app.get('/candidates', (c) => c.html(getIndexHtml()))
app.get('/candidates/*', (c) => c.html(getIndexHtml()))
app.get('/upload', (c) => c.html(getIndexHtml()))
app.get('/analytics', (c) => c.html(getIndexHtml()))
app.get('/settings', (c) => c.html(getIndexHtml()))

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
    /* 侧边栏菜单项 - 不使用@apply，确保CDN兼容性 */
    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      color: #cbd5e1;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    }
    .sidebar-link:hover { background: #1d4ed8; color: #fff; }
    .sidebar-link.active { background: #2563eb; color: #fff; }
    .sidebar-link .menu-icon { flex-shrink: 0; width: 18px; text-align: center; font-size: 14px; }
    .sidebar-link .menu-text { flex: 1; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sidebar-link .menu-badge { flex-shrink: 0; background: #1e40af; font-size: 11px; border-radius: 9999px; padding: 1px 7px; }
    .sidebar-link .menu-arrow { flex-shrink: 0; font-size: 11px; opacity: 0.6; transition: transform 0.2s; }
    .sidebar-link.open .menu-arrow { transform: rotate(90deg); }
    /* 二级子菜单 */
    .sub-menu { overflow: hidden; max-height: 0; transition: max-height 0.25s ease; }
    .sub-menu.open { max-height: 200px; }
    .sub-link {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px 8px 38px;
      border-radius: 8px;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
      white-space: nowrap;
      font-size: 13px;
      box-sizing: border-box;
      width: 100%;
    }
    .sub-link:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
    .sub-link.active { background: rgba(37,99,235,0.5); color: #fff; }
    .sub-link .sub-icon { flex-shrink: 0; width: 16px; text-align: center; font-size: 12px; }
    /* 标签样式 */
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



<!-- Toast通知 -->
<div id="toastContainer" class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm"></div>

<div class="flex h-screen overflow-hidden">
  <!-- 侧边栏：固定宽度260px -->
  <aside style="width:260px;min-width:260px;flex-shrink:0;background:#1e3a5f;display:flex;flex-direction:column;overflow:hidden">
    <!-- 头部品牌区 -->
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
    
    <!-- 导航菜单 -->
    <nav style="padding:12px 10px;flex:1;display:flex;flex-direction:column;gap:3px;overflow-y:auto">
      <a class="sidebar-link active" onclick="navigateTo('dashboard')" id="nav-dashboard">
        <i class="fas fa-chart-line menu-icon"></i>
        <span class="menu-text">数据看板</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('candidates')" id="nav-candidates">
        <i class="fas fa-users menu-icon"></i>
        <span class="menu-text">人才库</span>
        <span id="candidateCount" class="menu-badge">-</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('archive')" id="nav-archive">
        <i class="fas fa-search menu-icon"></i>
        <span class="menu-text">档案查询</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('upload')" id="nav-upload">
        <i class="fas fa-cloud-upload-alt menu-icon"></i>
        <span class="menu-text">导入简历</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('analytics')" id="nav-analytics">
        <i class="fas fa-chart-bar menu-icon"></i>
        <span class="menu-text">统计分析</span>
      </a>
      <div style="height:1px;background:rgba(255,255,255,0.1);margin:6px 4px"></div>
      <!-- 系统设置：一级菜单（可折叠） -->
      <div>
        <a class="sidebar-link" onclick="toggleSettingsMenu()" id="nav-settings">
          <i class="fas fa-cog menu-icon"></i>
          <span class="menu-text">系统设置</span>
          <i class="fas fa-chevron-right menu-arrow" id="settings-arrow"></i>
        </a>
        <!-- 二级子菜单 -->
        <div class="sub-menu" id="settings-submenu">
          <a class="sub-link" onclick="navigateToSettings('ai')" id="nav-settings-ai">
            <i class="fas fa-robot sub-icon"></i>
            <span>AI 配置</span>
          </a>
          <a class="sub-link" onclick="navigateToSettings('users')" id="nav-settings-users">
            <i class="fas fa-users-cog sub-icon"></i>
            <span>用户管理</span>
          </a>
          <a class="sub-link" onclick="navigateToSettings('system')" id="nav-settings-system">
            <i class="fas fa-info-circle sub-icon"></i>
            <span>系统信息</span>
          </a>
        </div>
      </div>
    </nav>
    
    <!-- AI状态 -->
    <div style="padding:10px 10px 14px;border-top:1px solid rgba(255,255,255,0.1)">
      <div style="background:rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px">
        <div style="font-size:11px;color:#93c5fd;margin-bottom:6px">AI解析状态</div>
        <div style="display:flex;align-items:center;gap:7px">
          <div id="aiStatusDot" style="width:8px;height:8px;border-radius:50%;background:#9ca3af;flex-shrink:0"></div>
          <span id="aiStatusText" style="font-size:12px;color:#d1d5db;white-space:nowrap">未配置</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- 主内容区 -->
  <main class="flex-1 overflow-auto" id="mainContent">
    <!-- 内容通过JS动态渲染 -->
  </main>
</div>

<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
