// ==========================================
// 简历人才管理系统 - 主入口
// ==========================================
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import candidates from './routes/candidates'
import upload from './routes/upload'

type Bindings = {
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 中间件
app.use('/api/*', cors())

// API路由
app.route('/api/candidates', candidates)
app.route('/api/upload', upload)

// 统计数据API（快捷路由）
app.get('/api/stats', (c) => {
  return c.json({ success: true, message: 'use /api/candidates/stats/overview' })
})

// 静态文件服务
app.use('/static/*', serveStatic({ root: './' }))

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
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; }
    .sidebar-link { @apply flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-blue-700 hover:text-white transition-all cursor-pointer; }
    .sidebar-link.active { @apply bg-blue-600 text-white; }
    .tag-skill { @apply bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full; }
    .tag-industry { @apply bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full; }
    .tag-trait { @apply bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full; }
    .tag-education { @apply bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full; }
    .animate-spin-slow { animation: spin 2s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .status-badge { @apply text-xs font-medium px-2.5 py-0.5 rounded-full; }
    .loading-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; }
    .card-hover { transition: all 0.2s; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
    .progress-bar { transition: width 0.6s ease; }
    .fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body class="bg-gray-50">

<!-- 加载遮罩 -->
<div id="loadingOverlay" class="loading-overlay hidden">
  <div class="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-4">
    <div class="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <div class="text-center">
      <p class="font-semibold text-gray-800 text-lg" id="loadingTitle">AI解析中...</p>
      <p class="text-gray-500 text-sm mt-1" id="loadingDesc">正在智能提取简历信息，请稍候</p>
    </div>
    <div class="w-full bg-gray-100 rounded-full h-2">
      <div id="loadingBar" class="bg-blue-600 h-2 rounded-full progress-bar" style="width: 0%"></div>
    </div>
  </div>
</div>

<!-- Toast通知 -->
<div id="toastContainer" class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm"></div>

<div class="flex h-screen overflow-hidden">
  <!-- 侧边栏 -->
  <aside class="w-64 bg-blue-900 text-white flex flex-col flex-shrink-0">
    <div class="p-6 border-b border-blue-800">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
          <i class="fas fa-users text-white text-lg"></i>
        </div>
        <div>
          <h1 class="font-bold text-white text-base leading-tight">简历人才管理</h1>
          <p class="text-blue-300 text-xs">智能HR招聘平台</p>
        </div>
      </div>
    </div>
    
    <nav class="p-4 flex-1 space-y-1">
      <a class="sidebar-link active" onclick="navigateTo('dashboard')" id="nav-dashboard">
        <i class="fas fa-chart-line w-5"></i>
        <span>数据看板</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('candidates')" id="nav-candidates">
        <i class="fas fa-users w-5"></i>
        <span>人才库</span>
        <span id="candidateCount" class="ml-auto bg-blue-700 text-xs px-2 py-0.5 rounded-full">-</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('upload')" id="nav-upload">
        <i class="fas fa-cloud-upload-alt w-5"></i>
        <span>导入简历</span>
      </a>
      <a class="sidebar-link" onclick="navigateTo('analytics')" id="nav-analytics">
        <i class="fas fa-chart-bar w-5"></i>
        <span>统计分析</span>
      </a>
      <div class="border-t border-blue-800 my-2"></div>
      <a class="sidebar-link" onclick="navigateTo('settings')" id="nav-settings">
        <i class="fas fa-cog w-5"></i>
        <span>系统设置</span>
      </a>
    </nav>
    
    <div class="p-4 border-t border-blue-800">
      <div class="bg-blue-800 rounded-xl p-3">
        <p class="text-xs text-blue-300 mb-1">AI解析状态</p>
        <div class="flex items-center gap-2">
          <div id="aiStatusDot" class="w-2 h-2 rounded-full bg-gray-400"></div>
          <span id="aiStatusText" class="text-sm text-gray-300">未配置</span>
        </div>
      </div>
    </div>
  </aside>

  <!-- 主内容区 -->
  <main class="flex-1 overflow-auto" id="mainContent">
    <!-- 内容通过JS动态渲染 -->
  </main>
</div>

<script>
// ==========================================
// 全局状态管理
// ==========================================
const state = {
  currentPage: 'dashboard',
  candidates: [],
  totalCandidates: 0,
  currentCandidate: null,
  searchParams: { page: 1, pageSize: 10, keyword: '', candidateStatus: '', highestEducation: '', sourceChannel: '', sortBy: 'createdAt', sortOrder: 'desc' },
  stats: null,
  openaiKey: localStorage.getItem('openai_key') || '',
  openaiBaseUrl: localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1',
  charts: {}
}

// ==========================================
// 工具函数
// ==========================================
function showToast(message, type = 'success') {
  const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' }
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }
  const toast = document.createElement('div')
  toast.className = \`\${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 fade-in max-w-sm\`
  toast.innerHTML = \`<i class="fas \${icons[type]}"></i><span class="text-sm">\${message}</span>\`
  document.getElementById('toastContainer').appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}

function showLoading(title = 'AI解析中...', desc = '正在智能提取简历信息，请稍候') {
  document.getElementById('loadingTitle').textContent = title
  document.getElementById('loadingDesc').textContent = desc
  document.getElementById('loadingOverlay').classList.remove('hidden')
  let progress = 0
  const bar = document.getElementById('loadingBar')
  const interval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 15, 90)
    bar.style.width = progress + '%'
  }, 500)
  return () => { clearInterval(interval); bar.style.width = '100%'; setTimeout(() => { document.getElementById('loadingOverlay').classList.add('hidden'); bar.style.width = '0%' }, 300) }
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  return response.json()
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch { return dateStr }
}

function getStatusBadge(status) {
  const config = {
    'active': { color: 'bg-green-100 text-green-800', label: '活跃' },
    'interviewing': { color: 'bg-blue-100 text-blue-800', label: '面试中' },
    'hired': { color: 'bg-purple-100 text-purple-800', label: '已录用' },
    'rejected': { color: 'bg-red-100 text-red-800', label: '已淘汰' },
    'blacklist': { color: 'bg-gray-100 text-gray-800', label: '黑名单' }
  }
  const cfg = config[status] || { color: 'bg-gray-100 text-gray-600', label: status || '未知' }
  return \`<span class="status-badge \${cfg.color}">\${cfg.label}</span>\`
}

function getEducationLabel(edu) {
  const labels = { '博士': '博', '硕士': '硕', '本科': '本', '大专': '专', '高中': '高' }
  return labels[edu] || edu || '-'
}

function getSalaryText(min, max) {
  if (!min && !max) return '面议'
  const fmt = (n) => n >= 1000 ? (n/1000).toFixed(0) + 'K' : n + '元'
  if (min && max) return fmt(min) + '-' + fmt(max) + '/月'
  if (min) return fmt(min) + '以上/月'
  return fmt(max) + '以下/月'
}

function getTagClass(type) {
  const classes = { 'skill': 'tag-skill', 'industry': 'tag-industry', 'trait': 'tag-trait', 'education': 'tag-education', 'company': 'tag-industry' }
  return classes[type] || 'tag-skill'
}

// ==========================================
// 路由导航
// ==========================================
function navigateTo(page, params = {}) {
  state.currentPage = page
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'))
  const navEl = document.getElementById('nav-' + page)
  if (navEl) navEl.classList.add('active')
  
  // 销毁图表
  Object.values(state.charts).forEach(chart => { try { chart.destroy() } catch {} })
  state.charts = {}
  
  const pages = { dashboard: renderDashboard, candidates: renderCandidateList, upload: renderUpload, analytics: renderAnalytics, settings: renderSettings }
  const renderFn = pages[page]
  if (renderFn) renderFn(params)
}

// ==========================================
// 数据加载
// ==========================================
async function loadCandidates(params = {}) {
  const merged = { ...state.searchParams, ...params }
  state.searchParams = merged
  
  const query = Object.entries(merged)
    .filter(([_, v]) => v !== undefined && v !== '')
    .map(([k, v]) => \`\${k}=\${encodeURIComponent(v)}\`).join('&')
  
  const res = await apiRequest(\`/api/candidates?\${query}\`)
  if (res.success) {
    state.candidates = res.data
    state.totalCandidates = res.total
    document.getElementById('candidateCount').textContent = res.total
  }
  return res
}

async function loadStats() {
  const res = await apiRequest('/api/candidates/stats/overview')
  if (res.success) state.stats = res.data
  return res.data
}

// ==========================================
// 页面：数据看板
// ==========================================
async function renderDashboard() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="p-6">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">数据看板</h2>
          <p class="text-gray-500 text-sm mt-1">实时人才库概览与招聘数据洞察</p>
        </div>
        <button onclick="navigateTo('upload')" class="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center gap-2">
          <i class="fas fa-plus"></i>导入简历
        </button>
      </div>
      
      <!-- 统计卡片 -->
      <div class="grid grid-cols-4 gap-4 mb-6" id="statCards">
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
          <div class="h-4 bg-gray-200 rounded mb-4 w-24"></div>
          <div class="h-8 bg-gray-200 rounded w-16"></div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
          <div class="h-4 bg-gray-200 rounded mb-4 w-24"></div>
          <div class="h-8 bg-gray-200 rounded w-16"></div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
          <div class="h-4 bg-gray-200 rounded mb-4 w-24"></div>
          <div class="h-8 bg-gray-200 rounded w-16"></div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
          <div class="h-4 bg-gray-200 rounded mb-4 w-24"></div>
          <div class="h-8 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
      
      <!-- 图表区域 -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-4">候选人状态分布</h3>
          <div class="relative h-48"><canvas id="statusChart"></canvas></div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-4">学历结构分析</h3>
          <div class="relative h-48"><canvas id="eduChart"></canvas></div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-4">来源渠道分布</h3>
          <div class="relative h-48"><canvas id="channelChart"></canvas></div>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-4">工作年限分布</h3>
          <div class="relative h-48"><canvas id="expChart"></canvas></div>
        </div>
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-4">热门技能 TOP 10</h3>
          <div id="skillCloud" class="flex flex-wrap gap-2 mt-2"></div>
        </div>
      </div>
      
      <!-- 最新候选人 -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-semibold text-gray-700">最新候选人</h3>
          <a onclick="navigateTo('candidates')" class="text-blue-600 text-sm hover:underline cursor-pointer">查看全部 →</a>
        </div>
        <div id="recentCandidates">
          <div class="text-center text-gray-400 py-4">加载中...</div>
        </div>
      </div>
    </div>
  \`
  
  const stats = await loadStats()
  await loadCandidates({ page: 1, pageSize: 5 })
  
  // 更新统计卡片
  document.getElementById('statCards').innerHTML = \`
    <div class="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white card-hover">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-blue-100 text-sm">人才总数</p>
          <p class="text-4xl font-bold mt-1">\${stats.total}</p>
          <p class="text-blue-200 text-xs mt-2">+\${stats.recentAdded} 近30天</p>
        </div>
        <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <i class="fas fa-users text-white text-xl"></i>
        </div>
      </div>
    </div>
    <div class="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-5 text-white card-hover">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-green-100 text-sm">面试中</p>
          <p class="text-4xl font-bold mt-1">\${stats.byStatus?.interviewing || 0}</p>
          <p class="text-green-200 text-xs mt-2">活跃候选人 \${stats.byStatus?.active || 0} 人</p>
        </div>
        <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <i class="fas fa-calendar-check text-white text-xl"></i>
        </div>
      </div>
    </div>
    <div class="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-5 text-white card-hover">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-purple-100 text-sm">已录用</p>
          <p class="text-4xl font-bold mt-1">\${stats.byStatus?.hired || 0}</p>
          <p class="text-purple-200 text-xs mt-2">录用率 \${stats.total > 0 ? Math.round((stats.byStatus?.hired||0)/stats.total*100) : 0}%</p>
        </div>
        <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <i class="fas fa-user-check text-white text-xl"></i>
        </div>
      </div>
    </div>
    <div class="bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl p-5 text-white card-hover">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-orange-100 text-sm">AI匹配均分</p>
          <p class="text-4xl font-bold mt-1">\${stats.avgMatchScore || '-'}</p>
          <p class="text-orange-200 text-xs mt-2">满分100分</p>
        </div>
        <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <i class="fas fa-robot text-white text-xl"></i>
        </div>
      </div>
    </div>
  \`
  
  // 绘制图表
  const chartColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']
  
  const drawDoughnut = (id, labels, data) => {
    const ctx = document.getElementById(id)
    if (!ctx) return
    if (state.charts[id]) state.charts[id].destroy()
    state.charts[id] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: chartColors, borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } } }
    })
  }
  
  if (stats.byStatus) {
    drawDoughnut('statusChart', 
      Object.keys(stats.byStatus).map(s => ({active:'活跃',interviewing:'面试中',hired:'已录用',rejected:'已淘汰',blacklist:'黑名单'}[s]||s)),
      Object.values(stats.byStatus)
    )
  }
  if (stats.byEducation) {
    drawDoughnut('eduChart', Object.keys(stats.byEducation), Object.values(stats.byEducation))
  }
  if (stats.byChannel) {
    drawDoughnut('channelChart', Object.keys(stats.byChannel), Object.values(stats.byChannel))
  }
  
  if (stats.byExperience) {
    const ctx = document.getElementById('expChart')
    if (ctx) {
      if (state.charts['expChart']) state.charts['expChart'].destroy()
      state.charts['expChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(stats.byExperience),
          datasets: [{ data: Object.values(stats.byExperience), backgroundColor: '#3b82f6', borderRadius: 8, borderSkipped: false }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
      })
    }
  }
  
  // 技能热词云
  if (stats.topSkills) {
    const maxCount = Math.max(...stats.topSkills.map(s => s.count))
    document.getElementById('skillCloud').innerHTML = stats.topSkills.map(s => {
      const ratio = s.count / maxCount
      const size = ratio > 0.8 ? 'text-base font-bold' : ratio > 0.5 ? 'text-sm font-semibold' : 'text-xs'
      const bg = ratio > 0.8 ? 'bg-blue-500 text-white' : ratio > 0.5 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
      return \`<span class="\${size} \${bg} px-3 py-1.5 rounded-full cursor-pointer hover:opacity-80" onclick="navigateTo('candidates', {skillKeyword:'\${s.name}'})">\${s.name} <span class="opacity-70">\${s.count}</span></span>\`
    }).join('')
  }
  
  // 最新候选人
  document.getElementById('recentCandidates').innerHTML = state.candidates.length === 0 ? 
    '<p class="text-center text-gray-400 py-4">暂无候选人数据</p>' :
    \`<table class="w-full text-sm">
      <thead><tr class="text-gray-500 border-b">
        <th class="text-left py-2 font-medium">姓名</th>
        <th class="text-left py-2 font-medium">期望职位</th>
        <th class="text-left py-2 font-medium">学历</th>
        <th class="text-left py-2 font-medium">工作年限</th>
        <th class="text-left py-2 font-medium">状态</th>
        <th class="text-left py-2 font-medium">来源</th>
        <th class="text-left py-2 font-medium">时间</th>
      </tr></thead>
      <tbody>
        \${state.candidates.map(c => \`<tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="viewCandidate(\${c.id})">
          <td class="py-3 font-medium text-gray-800">\${c.name}</td>
          <td class="py-3 text-gray-600">\${c.expectedPosition || '-'}</td>
          <td class="py-3">\${c.highestEducation || '-'}</td>
          <td class="py-3">\${c.yearsOfExperience ? c.yearsOfExperience+'年' : '-'}</td>
          <td class="py-3">\${getStatusBadge(c.candidateStatus)}</td>
          <td class="py-3 text-gray-500">\${c.sourceChannel || '-'}</td>
          <td class="py-3 text-gray-400">\${formatDate(c.createdAt)}</td>
        </tr>\`).join('')}
      </tbody>
    </table>\`
}

// ==========================================
// 页面：人才库（列表+搜索）
// ==========================================
async function renderCandidateList(params = {}) {
  if (params.skillKeyword) state.searchParams = { ...state.searchParams, skillKeyword: params.skillKeyword, keyword: '' }
  
  document.getElementById('mainContent').innerHTML = \`
    <div class="p-6">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">人才库</h2>
          <p class="text-gray-500 text-sm mt-1">管理所有候选人档案与筛选</p>
        </div>
        <button onclick="navigateTo('upload')" class="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center gap-2">
          <i class="fas fa-plus"></i>导入简历
        </button>
      </div>
      
      <!-- 搜索筛选栏 -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div class="flex gap-3 flex-wrap">
          <div class="flex-1 min-w-48 relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input type="text" id="searchKeyword" placeholder="搜索姓名、职位、邮箱..." value="\${state.searchParams.keyword || ''}"
              class="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onkeydown="if(event.key==='Enter') searchCandidates()">
          </div>
          <select id="filterStatus" class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchCandidates()">
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="interviewing">面试中</option>
            <option value="hired">已录用</option>
            <option value="rejected">已淘汰</option>
            <option value="blacklist">黑名单</option>
          </select>
          <select id="filterEdu" class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchCandidates()">
            <option value="">全部学历</option>
            <option value="博士">博士</option>
            <option value="硕士">硕士</option>
            <option value="本科">本科</option>
            <option value="大专">大专</option>
          </select>
          <select id="filterChannel" class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchCandidates()">
            <option value="">全部渠道</option>
            <option value="BOSS直聘">BOSS直聘</option>
            <option value="智联招聘">智联招聘</option>
            <option value="猎头推荐">猎头推荐</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="校园招聘">校园招聘</option>
            <option value="内推">内推</option>
          </select>
          <input type="text" id="filterSkill" placeholder="技能筛选" value="\${state.searchParams.skillKeyword || ''}"
            class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onkeydown="if(event.key==='Enter') searchCandidates()">
          <button onclick="searchCandidates()" class="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm hover:bg-blue-700 transition flex items-center gap-2">
            <i class="fas fa-search"></i>搜索
          </button>
          <button onclick="clearSearch()" class="border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      
      <!-- 候选人列表 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100" id="candidateListContainer">
        <div class="text-center py-12 text-gray-400">
          <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
          <p>加载中...</p>
        </div>
      </div>
    </div>
  \`
  
  // 恢复筛选状态
  setTimeout(() => {
    if (document.getElementById('filterStatus')) document.getElementById('filterStatus').value = state.searchParams.candidateStatus || ''
    if (document.getElementById('filterEdu')) document.getElementById('filterEdu').value = state.searchParams.highestEducation || ''
    if (document.getElementById('filterChannel')) document.getElementById('filterChannel').value = state.searchParams.sourceChannel || ''
  }, 0)
  
  await loadAndRenderCandidates()
}

async function loadAndRenderCandidates() {
  const res = await loadCandidates()
  
  const container = document.getElementById('candidateListContainer')
  if (!container) return
  
  if (!res.success || state.candidates.length === 0) {
    container.innerHTML = \`
      <div class="text-center py-16 text-gray-400">
        <i class="fas fa-search text-4xl mb-4 block"></i>
        <p class="text-lg font-medium">未找到候选人</p>
        <p class="text-sm mt-1">尝试调整筛选条件或<a onclick="navigateTo('upload')" class="text-blue-600 hover:underline cursor-pointer">导入简历</a></p>
      </div>
    \`
    return
  }
  
  const totalPages = Math.ceil(state.totalCandidates / state.searchParams.pageSize)
  
  container.innerHTML = \`
    <div class="p-4 border-b border-gray-50 flex justify-between items-center text-sm text-gray-500">
      <span>共 <strong class="text-gray-800">\${state.totalCandidates}</strong> 位候选人</span>
      <select class="border border-gray-200 rounded-lg px-2 py-1 text-sm" onchange="changeSortBy(this.value)">
        <option value="createdAt-desc">最新添加</option>
        <option value="matchScore-desc">匹配分数</option>
        <option value="yearsOfExperience-desc">工作年限</option>
        <option value="name-asc">姓名排序</option>
      </select>
    </div>
    <div class="divide-y divide-gray-50">
      \${state.candidates.map(c => renderCandidateRow(c)).join('')}
    </div>
    \${totalPages > 1 ? renderPagination(state.searchParams.page, totalPages) : ''}
  \`
}

function renderCandidateRow(c) {
  const tags = (c.tags || []).slice(0, 3)
  return \`
    <div class="p-4 hover:bg-blue-50/30 cursor-pointer transition group" onclick="viewCandidate(\${c.id})">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          \${c.name?.charAt(0) || '?'}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="font-semibold text-gray-800 text-base">\${c.name}</span>
            \${getStatusBadge(c.candidateStatus)}
            \${c.matchScore ? \`<span class="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><i class="fas fa-star text-orange-400"></i> \${c.matchScore}分</span>\` : ''}
          </div>
          <div class="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
            <span><i class="fas fa-briefcase mr-1 text-gray-300"></i>\${c.expectedPosition || '职位未知'}</span>
            <span><i class="fas fa-graduation-cap mr-1 text-gray-300"></i>\${c.highestEducation || '-'}</span>
            <span><i class="fas fa-clock mr-1 text-gray-300"></i>\${c.yearsOfExperience || 0}年经验</span>
            <span><i class="fas fa-map-marker-alt mr-1 text-gray-300"></i>\${c.location || '-'}</span>
            <span class="text-green-600"><i class="fas fa-yen-sign mr-1"></i>\${getSalaryText(c.expectedSalaryMin, c.expectedSalaryMax)}</span>
          </div>
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            \${tags.map(t => \`<span class="\${getTagClass(t.tagType)}">\${t.tagName}</span>\`).join('')}
            \${c.sourceChannel ? \`<span class="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full"><i class="fas fa-paper-plane mr-1"></i>\${c.sourceChannel}</span>\` : ''}
          </div>
        </div>
        <div class="text-right flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
          <button class="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm border border-blue-200">
            查看详情 <i class="fas fa-chevron-right ml-1"></i>
          </button>
        </div>
      </div>
    </div>
  \`
}

function renderPagination(currentPage, totalPages) {
  const pages = []
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  
  return \`
    <div class="p-4 border-t border-gray-50 flex justify-center gap-2">
      <button onclick="changePage(\${currentPage - 1})" \${currentPage <= 1 ? 'disabled' : ''} 
        class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
        <i class="fas fa-chevron-left"></i>
      </button>
      \${pages.map(p => \`<button onclick="changePage(\${p})" 
        class="px-3 py-1.5 border rounded-lg text-sm \${p === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}">\${p}</button>\`).join('')}
      <button onclick="changePage(\${currentPage + 1})" \${currentPage >= totalPages ? 'disabled' : ''} 
        class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  \`
}

function searchCandidates() {
  state.searchParams = {
    ...state.searchParams,
    keyword: document.getElementById('searchKeyword')?.value || '',
    candidateStatus: document.getElementById('filterStatus')?.value || '',
    highestEducation: document.getElementById('filterEdu')?.value || '',
    sourceChannel: document.getElementById('filterChannel')?.value || '',
    skillKeyword: document.getElementById('filterSkill')?.value || '',
    page: 1
  }
  loadAndRenderCandidates()
}

function clearSearch() {
  state.searchParams = { page: 1, pageSize: 10, keyword: '', candidateStatus: '', highestEducation: '', sourceChannel: '', skillKeyword: '', sortBy: 'createdAt', sortOrder: 'desc' }
  renderCandidateList()
}

function changePage(page) {
  if (page < 1) return
  state.searchParams.page = page
  loadAndRenderCandidates()
  document.getElementById('candidateListContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function changeSortBy(val) {
  const [sortBy, sortOrder] = val.split('-')
  state.searchParams = { ...state.searchParams, sortBy, sortOrder, page: 1 }
  loadAndRenderCandidates()
}

// ==========================================
// 候选人详情
// ==========================================
async function viewCandidate(id) {
  const res = await apiRequest(\`/api/candidates/\${id}\`)
  if (!res.success) { showToast('加载失败', 'error'); return }
  state.currentCandidate = res.data
  renderCandidateDetail(res.data)
}

function renderCandidateDetail(c) {
  const eduLabels = { '博士': '博士研究生', '硕士': '硕士研究生', '本科': '本科', '大专': '大专', '高中': '高中/中专' }
  
  document.getElementById('mainContent').innerHTML = \`
    <div class="p-6 max-w-5xl mx-auto">
      <!-- 返回按钮 -->
      <button onclick="navigateTo('candidates')" class="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition">
        <i class="fas fa-arrow-left"></i>返回人才库
      </button>
      
      <!-- 基本信息卡 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div class="flex items-start gap-6">
          <div class="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
            \${c.name?.charAt(0) || '?'}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-4 flex-wrap">
              <h2 class="text-2xl font-bold text-gray-800">\${c.name}</h2>
              \${getStatusBadge(c.candidateStatus)}
              \${c.matchScore ? \`<span class="bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-full font-medium"><i class="fas fa-star text-orange-400 mr-1"></i>匹配分 \${c.matchScore}</span>\` : ''}
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-600">
              \${c.gender ? \`<span><i class="fas fa-user text-gray-300 mr-1"></i>\${c.gender}\${c.age ? ' · ' + c.age + '岁' : ''}</span>\` : ''}
              \${c.phone ? \`<span><i class="fas fa-phone text-gray-300 mr-1"></i>\${c.phone}</span>\` : ''}
              \${c.email ? \`<span><i class="fas fa-envelope text-gray-300 mr-1"></i>\${c.email}</span>\` : ''}
              \${c.location ? \`<span><i class="fas fa-map-marker-alt text-gray-300 mr-1"></i>\${c.location}</span>\` : ''}
              \${c.sourceChannel ? \`<span><i class="fas fa-paper-plane text-gray-300 mr-1"></i>\${c.sourceChannel}</span>\` : ''}
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
              \${c.expectedPosition ? \`<span class="text-blue-700 font-medium"><i class="fas fa-briefcase text-blue-400 mr-1"></i>\${c.expectedPosition}</span>\` : ''}
              \${c.expectedCity ? \`<span class="text-gray-600"><i class="fas fa-city text-gray-300 mr-1"></i>期望城市: \${c.expectedCity}</span>\` : ''}
              \${(c.expectedSalaryMin || c.expectedSalaryMax) ? \`<span class="text-green-700"><i class="fas fa-yen-sign text-green-400 mr-1"></i>期望薪资: \${getSalaryText(c.expectedSalaryMin, c.expectedSalaryMax)}</span>\` : ''}
              \${c.yearsOfExperience ? \`<span class="text-gray-600"><i class="fas fa-clock text-gray-300 mr-1"></i>\${c.yearsOfExperience}年经验</span>\` : ''}
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <select onchange="updateStatus(\${c.id}, this.value)" class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active" \${c.candidateStatus==='active'?'selected':''}>活跃</option>
              <option value="interviewing" \${c.candidateStatus==='interviewing'?'selected':''}>面试中</option>
              <option value="hired" \${c.candidateStatus==='hired'?'selected':''}>已录用</option>
              <option value="rejected" \${c.candidateStatus==='rejected'?'selected':''}>已淘汰</option>
              <option value="blacklist" \${c.candidateStatus==='blacklist'?'selected':''}>黑名单</option>
            </select>
            <button onclick="showAddInterviewModal(\${c.id})" class="border border-blue-200 text-blue-600 rounded-xl px-3 py-2 text-sm hover:bg-blue-50 transition">
              <i class="fas fa-calendar-plus mr-1"></i>添加面试
            </button>
            <button onclick="confirmDelete(\${c.id}, '\${c.name}')" class="border border-red-200 text-red-500 rounded-xl px-3 py-2 text-sm hover:bg-red-50 transition">
              <i class="fas fa-trash mr-1"></i>删除
            </button>
          </div>
        </div>
        
        <!-- AI标签 -->
        \${c.tags?.length ? \`
          <div class="mt-4 pt-4 border-t border-gray-50">
            <p class="text-xs text-gray-400 mb-2"><i class="fas fa-robot mr-1"></i>AI智能标签</p>
            <div class="flex flex-wrap gap-2">
              \${c.tags.map(t => \`<span class="\${getTagClass(t.tagType)}">\${t.tagName}\${t.confidence ? \` <span class="opacity-60">\${t.confidence}%</span>\` : ''}</span>\`).join('')}
            </div>
          </div>
        \` : ''}
      </div>
      
      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-2 space-y-4">
          <!-- 自我评价 -->
          \${c.selfEvaluation ? \`
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-quote-left text-blue-400"></i>自我评价</h3>
            <p class="text-gray-600 text-sm leading-relaxed">\${c.selfEvaluation}</p>
          </div>\` : ''}
          
          <!-- 工作经历 -->
          \${c.workExperiences?.length ? \`
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-4 flex items-center gap-2"><i class="fas fa-building text-blue-400"></i>工作经历</h3>
            <div class="space-y-4">
              \${c.workExperiences.map(w => \`
                <div class="flex gap-4">
                  <div class="flex flex-col items-center">
                    <div class="w-3 h-3 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div class="w-0.5 bg-gray-200 flex-1 mt-1"></div>
                  </div>
                  <div class="flex-1 pb-4">
                    <div class="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <p class="font-semibold text-gray-800">\${w.companyName}</p>
                        <p class="text-blue-600 text-sm font-medium">\${w.position}\${w.department ? ' · ' + w.department : ''}</p>
                      </div>
                      <span class="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        \${w.startDate || ''} - \${w.isCurrent ? '<span class="text-green-600 font-medium">至今</span>' : (w.endDate || '')}
                      </span>
                    </div>
                    \${w.industry || w.companyType ? \`<p class="text-xs text-gray-400 mt-1">\${[w.industry, w.companyType, w.companySize].filter(Boolean).join(' · ')}</p>\` : ''}
                    \${w.description ? \`<p class="text-sm text-gray-600 mt-2 leading-relaxed">\${w.description}</p>\` : ''}
                    \${w.achievements ? \`<p class="text-sm text-green-700 mt-1 bg-green-50 rounded-lg p-2"><i class="fas fa-trophy text-yellow-500 mr-1"></i>\${w.achievements}</p>\` : ''}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>\` : ''}
          
          <!-- 项目经验 -->
          \${c.projects?.length ? \`
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-4 flex items-center gap-2"><i class="fas fa-code-branch text-blue-400"></i>项目经验</h3>
            <div class="space-y-4">
              \${c.projects.map(p => \`
                <div class="border border-gray-100 rounded-xl p-4">
                  <div class="flex justify-between items-start">
                    <p class="font-semibold text-gray-800">\${p.projectName}</p>
                    \${p.role ? \`<span class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">\${p.role}</span>\` : ''}
                  </div>
                  \${p.techStack ? \`<p class="text-xs text-gray-400 mt-1"><i class="fas fa-tools mr-1"></i>\${p.techStack}</p>\` : ''}
                  \${p.description ? \`<p class="text-sm text-gray-600 mt-2">\${p.description}</p>\` : ''}
                  \${p.achievements ? \`<p class="text-sm text-green-700 mt-1"><i class="fas fa-star text-yellow-500 mr-1"></i>\${p.achievements}</p>\` : ''}
                </div>
              \`).join('')}
            </div>
          </div>\` : ''}
          
          <!-- 面试记录 -->
          \${c.interviewRecords?.length ? \`
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-4 flex items-center gap-2"><i class="fas fa-calendar-alt text-blue-400"></i>面试记录</h3>
            <div class="space-y-3">
              \${c.interviewRecords.map(r => \`
                <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div class="text-center flex-shrink-0">
                    <div class="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-sm font-bold text-gray-600">
                      \${r.interviewRound || r.interviewType || '面'}
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="flex justify-between items-start">
                      <p class="font-medium text-gray-700">\${r.interviewRound || r.interviewType || '面试'}</p>
                      <span class="\${r.result==='通过'?'text-green-600':r.result==='淘汰'?'text-red-500':'text-gray-500'} text-sm font-medium">\${r.result || '待定'}</span>
                    </div>
                    \${r.interviewDate ? \`<p class="text-xs text-gray-400 mt-0.5"><i class="far fa-calendar mr-1"></i>\${formatDate(r.interviewDate)}</p>\` : ''}
                    \${r.feedback ? \`<p class="text-sm text-gray-600 mt-1">\${r.feedback}</p>\` : ''}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>\` : ''}
        </div>
        
        <div class="space-y-4">
          <!-- 教育背景 -->
          \${c.educations?.length ? \`
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-graduation-cap text-blue-400"></i>教育背景</h3>
            <div class="space-y-3">
              \${c.educations.map(e => \`
                <div class="border-l-2 border-blue-200 pl-3">
                  <p class="font-medium text-gray-800 text-sm">\${e.schoolName}</p>
                  <p class="text-blue-600 text-xs">\${eduLabels[e.degree] || e.degree} · \${e.major}</p>
                  <p class="text-gray-400 text-xs">\${e.startDate || ''} - \${e.endDate || ''}</p>
                  <div class="flex gap-1 mt-1">
                    \${e.is985 ? '<span class="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">985</span>' : ''}
                    \${e.is211 ? '<span class="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">211</span>' : ''}
                    \${e.isOverseas ? '<span class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">海外</span>' : ''}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>\` : ''}
          
          <!-- 技能 -->
          \${c.skills?.length ? \`
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-tools text-blue-400"></i>专业技能</h3>
            <div class="space-y-2">
              \${c.skills.map(s => \`
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <span class="text-sm text-gray-700">\${s.skillName}</span>
                    <span class="text-xs text-gray-400">\${s.proficiency || ''}\${s.yearsUsed ? ' · ' + s.yearsUsed + '年' : ''}</span>
                  </div>
                  <div class="h-1.5 bg-gray-100 rounded-full">
                    <div class="h-full bg-blue-500 rounded-full progress-bar" style="width: \${s.proficiency==='精通'?90:s.proficiency==='熟练'?70:50}%"></div>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>\` : ''}
          
          <!-- 证书荣誉 -->
          \${c.certifications?.length ? \`
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-award text-blue-400"></i>证书荣誉</h3>
            <div class="space-y-2">
              \${c.certifications.map(cert => \`
                <div class="flex items-start gap-2">
                  <i class="fas fa-medal text-yellow-500 mt-0.5 flex-shrink-0"></i>
                  <div>
                    <p class="text-sm font-medium text-gray-700">\${cert.certName}</p>
                    \${cert.issuingOrg ? \`<p class="text-xs text-gray-400">\${cert.issuingOrg}\${cert.issueDate ? ' · ' + cert.issueDate : ''}</p>\` : ''}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>\` : ''}
          
          <!-- HR备注 -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-sticky-note text-blue-400"></i>HR备注</h3>
            <textarea id="hrNotes" rows="4" placeholder="添加备注..." class="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">\${c.hrNotes || ''}</textarea>
            <button onclick="saveHrNotes(\${c.id})" class="mt-2 w-full bg-blue-600 text-white py-2 rounded-xl text-sm hover:bg-blue-700 transition">保存备注</button>
          </div>
          
          <!-- 创建信息 -->
          <div class="bg-gray-50 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
            <p><i class="fas fa-clock mr-1"></i>导入时间: \${formatDate(c.createdAt)}</p>
            <p><i class="fas fa-edit mr-1"></i>更新时间: \${formatDate(c.updatedAt)}</p>
            \${c.resumeFileName ? \`<p><i class="fas fa-file mr-1"></i>原始文件: \${c.resumeFileName}</p>\` : ''}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 面试记录弹窗 -->
    <div id="interviewModal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 class="font-bold text-gray-800 text-lg mb-4">添加面试记录</h3>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <select id="itype" class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="电话">电话面试</option>
              <option value="视频">视频面试</option>
              <option value="现场">现场面试</option>
            </select>
            <select id="iround" class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="初筛">初筛</option>
              <option value="一面">一面</option>
              <option value="二面">二面</option>
              <option value="HR面">HR面</option>
              <option value="终面">终面</option>
            </select>
          </div>
          <input type="datetime-local" id="idate" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <input type="text" id="iinterviewer" placeholder="面试官姓名" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <select id="iresult" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="待定">待定</option>
            <option value="通过">通过</option>
            <option value="淘汰">淘汰</option>
          </select>
          <textarea id="ifeedback" placeholder="面试反馈..." rows="3" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="document.getElementById('interviewModal').classList.add('hidden')" class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">取消</button>
          <button onclick="submitInterview()" class="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm hover:bg-blue-700">确认添加</button>
        </div>
      </div>
    </div>
  \`
}

async function updateStatus(id, status) {
  const res = await apiRequest(\`/api/candidates/\${id}/status\`, {
    method: 'PATCH',
    body: JSON.stringify({ candidateStatus: status })
  })
  if (res.success) showToast('状态更新成功', 'success')
  else showToast(res.message, 'error')
}

async function saveHrNotes(id) {
  const notes = document.getElementById('hrNotes').value
  const res = await apiRequest(\`/api/candidates/\${id}/notes\`, {
    method: 'PATCH',
    body: JSON.stringify({ hrNotes: notes })
  })
  if (res.success) showToast('备注保存成功', 'success')
  else showToast(res.message, 'error')
}

function showAddInterviewModal(id) {
  window._interviewCandidateId = id
  document.getElementById('interviewModal').classList.remove('hidden')
}

async function submitInterview() {
  const id = window._interviewCandidateId
  const data = {
    interviewType: document.getElementById('itype').value,
    interviewRound: document.getElementById('iround').value,
    interviewDate: document.getElementById('idate').value,
    interviewer: document.getElementById('iinterviewer').value,
    result: document.getElementById('iresult').value,
    feedback: document.getElementById('ifeedback').value
  }
  const res = await apiRequest(\`/api/candidates/\${id}/interviews\`, {
    method: 'POST', body: JSON.stringify(data)
  })
  if (res.success) {
    showToast('面试记录添加成功', 'success')
    document.getElementById('interviewModal').classList.add('hidden')
    viewCandidate(id)
  } else {
    showToast(res.message, 'error')
  }
}

function confirmDelete(id, name) {
  if (!confirm(\`确定要删除候选人「\${name}」吗？此操作不可恢复。\`)) return
  apiRequest(\`/api/candidates/\${id}\`, { method: 'DELETE' }).then(res => {
    if (res.success) { showToast('删除成功', 'success'); navigateTo('candidates') }
    else showToast(res.message, 'error')
  })
}

// ==========================================
// 页面：导入简历
// ==========================================
function renderUpload() {
  const hasApiKey = !!state.openaiKey
  
  document.getElementById('mainContent').innerHTML = \`
    <div class="p-6 max-w-4xl mx-auto">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800">导入简历</h2>
        <p class="text-gray-500 text-sm mt-1">上传简历文件或粘贴文本，AI自动提取结构化信息</p>
      </div>
      
      \${!hasApiKey ? \`
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5"></i>
        <div>
          <p class="font-medium text-amber-700">AI功能未配置</p>
          <p class="text-sm text-amber-600 mt-1">需要配置OpenAI API Key才能使用AI智能解析功能。请前往<a onclick="navigateTo('settings')" class="underline cursor-pointer">系统设置</a>配置。</p>
        </div>
      </div>
      \` : \`
      <div class="bg-green-50 border border-green-200 rounded-2xl p-3 mb-6 flex items-center gap-3">
        <i class="fas fa-check-circle text-green-500"></i>
        <p class="text-sm text-green-700">AI解析已就绪，支持PDF、Word、TXT、HTML、图片格式</p>
      </div>
      \`}
      
      <!-- 上传方式Tab -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="flex border-b border-gray-100">
          <button onclick="switchUploadTab('file')" id="tab-file" class="flex-1 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600 flex items-center justify-center gap-2">
            <i class="fas fa-file-upload"></i>上传文件
          </button>
          <button onclick="switchUploadTab('text')" id="tab-text" class="flex-1 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2">
            <i class="fas fa-paste"></i>粘贴文本
          </button>
        </div>
        
        <!-- 文件上传 -->
        <div id="uploadFilePanel" class="p-6">
          <div id="dropZone" class="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
            onclick="document.getElementById('fileInput').click()"
            ondragover="event.preventDefault();this.classList.add('border-blue-400','bg-blue-50')"
            ondragleave="this.classList.remove('border-blue-400','bg-blue-50')"
            ondrop="handleFileDrop(event)">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-cloud-upload-alt text-blue-500 text-2xl"></i>
            </div>
            <p class="font-semibold text-gray-700 text-lg">点击或拖拽上传简历</p>
            <p class="text-gray-400 text-sm mt-2">支持 PDF、Word(.docx)、TXT、HTML、JPG/PNG 格式，最大10MB</p>
            <p class="text-xs text-gray-300 mt-4">AI将自动解析：姓名、联系方式、教育背景、工作经历、技能标签等</p>
          </div>
          <input type="file" id="fileInput" class="hidden" accept=".pdf,.doc,.docx,.txt,.html,.htm,.jpg,.jpeg,.png,.webp" onchange="handleFileSelect(this)">
          
          <!-- 选中文件预览 -->
          <div id="selectedFile" class="hidden mt-4 p-4 bg-gray-50 rounded-xl flex items-center gap-3">
            <i class="fas fa-file-alt text-blue-500 text-xl flex-shrink-0"></i>
            <div class="flex-1">
              <p class="font-medium text-gray-700" id="selectedFileName"></p>
              <p class="text-xs text-gray-400" id="selectedFileSize"></p>
            </div>
            <button onclick="clearSelectedFile()" class="text-gray-400 hover:text-red-500 transition">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- 渠道选择 -->
          <div class="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">简历来源渠道</label>
              <select id="fileSourceChannel" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="手动上传">手动上传</option>
                <option value="BOSS直聘">BOSS直聘</option>
                <option value="智联招聘">智联招聘</option>
                <option value="猎头推荐">猎头推荐</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="校园招聘">校园招聘</option>
                <option value="内推">内推</option>
              </select>
            </div>
          </div>
          
          <button id="uploadBtn" onclick="uploadFile()" disabled
            class="mt-4 w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <i class="fas fa-robot"></i>开始AI解析
          </button>
        </div>
        
        <!-- 文本粘贴 -->
        <div id="uploadTextPanel" class="p-6 hidden">
          <div>
            <label class="text-sm font-medium text-gray-700 block mb-2">粘贴简历文本</label>
            <textarea id="resumeText" rows="12" placeholder="将简历文本粘贴到这里...&#10;&#10;例如：&#10;张三&#10;手机：13800138000&#10;邮箱：zhangsan@email.com&#10;&#10;教育背景：北京大学 计算机科学 本科 2018-2022..." 
              class="w-full border border-gray-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"></textarea>
            <div class="flex justify-between text-xs text-gray-400 mt-1">
              <span>支持任何格式的简历文本</span>
              <span id="textCount">0 字符</span>
            </div>
          </div>
          
          <div class="mt-4">
            <label class="text-sm font-medium text-gray-700 block mb-1">简历来源渠道</label>
            <select id="textSourceChannel" class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48">
              <option value="文本导入">文本导入</option>
              <option value="BOSS直聘">BOSS直聘</option>
              <option value="智联招聘">智联招聘</option>
              <option value="猎头推荐">猎头推荐</option>
              <option value="内推">内推</option>
            </select>
          </div>
          
          <button onclick="parseText()" 
            class="mt-4 w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2">
            <i class="fas fa-robot"></i>开始AI解析
          </button>
        </div>
      </div>
      
      <!-- 解析结果 -->
      <div id="parseResult" class="hidden mt-4"></div>
      
      <!-- 解析说明 -->
      <div class="mt-6 bg-gray-50 rounded-2xl p-5">
        <h4 class="font-semibold text-gray-700 mb-3 text-sm">AI解析能力说明</h4>
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div class="flex items-start gap-2">
            <i class="fas fa-check-circle text-green-500 mt-0.5 flex-shrink-0"></i>
            <div>
              <p class="font-medium text-gray-700">基本信息提取</p>
              <p class="text-gray-400 text-xs mt-1">姓名、联系方式、位置、求职意向</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <i class="fas fa-check-circle text-green-500 mt-0.5 flex-shrink-0"></i>
            <div>
              <p class="font-medium text-gray-700">经历结构化</p>
              <p class="text-gray-400 text-xs mt-1">教育、工作、项目经历自动分类</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <i class="fas fa-check-circle text-green-500 mt-0.5 flex-shrink-0"></i>
            <div>
              <p class="font-medium text-gray-700">智能标签生成</p>
              <p class="text-gray-400 text-xs mt-1">自动生成技能、行业、特质标签</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  \`
  
  // 绑定文本计数
  setTimeout(() => {
    const ta = document.getElementById('resumeText')
    if (ta) ta.addEventListener('input', () => {
      document.getElementById('textCount').textContent = ta.value.length + ' 字符'
    })
  }, 100)
}

function switchUploadTab(tab) {
  document.getElementById('uploadFilePanel').classList.toggle('hidden', tab !== 'file')
  document.getElementById('uploadTextPanel').classList.toggle('hidden', tab !== 'text')
  document.getElementById('tab-file').className = \`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 \${tab==='file' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}\`
  document.getElementById('tab-text').className = \`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 \${tab==='text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}\`
}

function handleFileSelect(input) {
  const file = input.files[0]
  if (!file) return
  window._selectedFile = file
  document.getElementById('selectedFile').classList.remove('hidden')
  document.getElementById('selectedFileName').textContent = file.name
  document.getElementById('selectedFileSize').textContent = (file.size / 1024).toFixed(1) + ' KB'
  document.getElementById('uploadBtn').disabled = false
}

function handleFileDrop(event) {
  event.preventDefault()
  document.getElementById('dropZone').classList.remove('border-blue-400', 'bg-blue-50')
  const file = event.dataTransfer.files[0]
  if (file) {
    window._selectedFile = file
    document.getElementById('selectedFile').classList.remove('hidden')
    document.getElementById('selectedFileName').textContent = file.name
    document.getElementById('selectedFileSize').textContent = (file.size / 1024).toFixed(1) + ' KB'
    document.getElementById('uploadBtn').disabled = false
  }
}

function clearSelectedFile() {
  window._selectedFile = null
  document.getElementById('selectedFile').classList.add('hidden')
  document.getElementById('fileInput').value = ''
  document.getElementById('uploadBtn').disabled = true
}

async function uploadFile() {
  if (!window._selectedFile) { showToast('请先选择文件', 'warning'); return }
  if (!state.openaiKey) { showToast('请先配置OpenAI API Key', 'error'); navigateTo('settings'); return }
  
  const stopLoading = showLoading('AI正在解析简历...', '正在提取文本并智能识别信息，通常需要10-30秒')
  
  try {
    const formData = new FormData()
    formData.append('file', window._selectedFile)
    formData.append('sourceChannel', document.getElementById('fileSourceChannel').value)
    
    const res = await fetch('/api/upload/resume', {
      method: 'POST',
      headers: { 'X-OpenAI-Key': state.openaiKey, 'X-OpenAI-Base-URL': state.openaiBaseUrl },
      body: formData
    })
    
    stopLoading()
    const data = await res.json()
    
    if (data.success) {
      showParseResult(data.data.candidate, data.message)
      showToast(data.message, 'success')
    } else {
      showToast(data.message || '解析失败', 'error')
    }
  } catch (e) {
    stopLoading()
    showToast('上传失败: ' + e.message, 'error')
  }
}

async function parseText() {
  const text = document.getElementById('resumeText').value.trim()
  if (!text) { showToast('请输入简历文本', 'warning'); return }
  if (text.length < 20) { showToast('简历文本内容过短', 'warning'); return }
  if (!state.openaiKey) { showToast('请先配置OpenAI API Key', 'error'); navigateTo('settings'); return }
  
  const stopLoading = showLoading('AI正在分析简历...', '正在智能提取简历结构化信息')
  
  try {
    const res = await apiRequest('/api/upload/text', {
      method: 'POST',
      headers: { 'X-OpenAI-Key': state.openaiKey, 'X-OpenAI-Base-URL': state.openaiBaseUrl },
      body: JSON.stringify({
        text,
        sourceChannel: document.getElementById('textSourceChannel').value
      })
    })
    
    stopLoading()
    
    if (res.success) {
      showParseResult(res.data.candidate, res.message)
      showToast(res.message, 'success')
    } else {
      showToast(res.message || '解析失败', 'error')
    }
  } catch (e) {
    stopLoading()
    showToast('解析失败: ' + e.message, 'error')
  }
}

function showParseResult(candidate, message) {
  const container = document.getElementById('parseResult')
  container.classList.remove('hidden')
  container.innerHTML = \`
    <div class="bg-green-50 border border-green-200 rounded-2xl p-5 fade-in">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
          <i class="fas fa-check text-white"></i>
        </div>
        <div>
          <p class="font-semibold text-green-800">解析成功！</p>
          <p class="text-sm text-green-600">\${message}</p>
        </div>
      </div>
      
      <div class="bg-white rounded-xl p-4 space-y-3">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-400">姓名</p>
            <p class="font-semibold text-gray-800">\${candidate.name}</p>
          </div>
          \${candidate.phone ? \`<div><p class="text-xs text-gray-400">电话</p><p class="font-medium text-gray-700">\${candidate.phone}</p></div>\` : ''}
          \${candidate.email ? \`<div><p class="text-xs text-gray-400">邮箱</p><p class="font-medium text-gray-700">\${candidate.email}</p></div>\` : ''}
          \${candidate.highestEducation ? \`<div><p class="text-xs text-gray-400">学历</p><p class="font-medium text-gray-700">\${candidate.highestEducation}</p></div>\` : ''}
          \${candidate.yearsOfExperience ? \`<div><p class="text-xs text-gray-400">工作年限</p><p class="font-medium text-gray-700">\${candidate.yearsOfExperience}年</p></div>\` : ''}
          \${candidate.expectedPosition ? \`<div><p class="text-xs text-gray-400">期望职位</p><p class="font-medium text-gray-700">\${candidate.expectedPosition}</p></div>\` : ''}
        </div>
        
        \${candidate.tags?.length ? \`
          <div class="pt-3 border-t border-gray-100">
            <p class="text-xs text-gray-400 mb-2">AI生成标签</p>
            <div class="flex flex-wrap gap-2">
              \${candidate.tags.map(t => \`<span class="\${getTagClass(t.tagType)}">\${t.tagName}</span>\`).join('')}
            </div>
          </div>
        \` : ''}
      </div>
      
      <div class="flex gap-3 mt-4">
        <button onclick="viewCandidate(\${candidate.id})" class="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm hover:bg-blue-700 transition">
          <i class="fas fa-eye mr-1"></i>查看完整档案
        </button>
        <button onclick="navigateTo('candidates')" class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
          <i class="fas fa-list mr-1"></i>返回人才库
        </button>
      </div>
    </div>
  \`
  container.scrollIntoView({ behavior: 'smooth' })
}

// ==========================================
// 页面：统计分析
// ==========================================
async function renderAnalytics() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800">统计分析</h2>
        <p class="text-gray-500 text-sm mt-1">招聘数据深度洞察与人才库分析报告</p>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 class="font-semibold text-gray-700 mb-4">人才库规模趋势</h3>
          <div class="relative h-64"><canvas id="trendChart"></canvas></div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 class="font-semibold text-gray-700 mb-4">学历结构分布</h3>
          <div class="relative h-64"><canvas id="eduPieChart"></canvas></div>
        </div>
      </div>
      
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 class="font-semibold text-gray-700 mb-4">候选人状态漏斗</h3>
          <div id="funnelChart" class="space-y-3"></div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 class="font-semibold text-gray-700 mb-4">来源渠道分析</h3>
          <div class="relative h-48"><canvas id="channelBarChart"></canvas></div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 class="font-semibold text-gray-700 mb-4">工作年限分布</h3>
          <div class="relative h-48"><canvas id="expPieChart"></canvas></div>
        </div>
      </div>
      
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 class="font-semibold text-gray-700 mb-4">热门技能排行</h3>
        <div id="skillRanking" class="space-y-2"></div>
      </div>
    </div>
  \`
  
  const stats = await loadStats()
  const chartColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']

  // 漏斗图
  const funnelData = [
    { label: '活跃候选人', value: stats.byStatus?.active || 0, color: 'bg-blue-500' },
    { label: '面试中', value: stats.byStatus?.interviewing || 0, color: 'bg-green-500' },
    { label: '已录用', value: stats.byStatus?.hired || 0, color: 'bg-purple-500' },
    { label: '已淘汰', value: stats.byStatus?.rejected || 0, color: 'bg-red-400' }
  ]
  const maxVal = Math.max(...funnelData.map(d => d.value), 1)
  document.getElementById('funnelChart').innerHTML = funnelData.map(d => \`
    <div>
      <div class="flex justify-between text-sm mb-1">
        <span class="text-gray-600">\${d.label}</span>
        <span class="font-semibold text-gray-800">\${d.value}</span>
      </div>
      <div class="h-6 bg-gray-100 rounded-full overflow-hidden">
        <div class="\${d.color} h-full rounded-full transition-all" style="width: \${(d.value/maxVal*100).toFixed(1)}%"></div>
      </div>
    </div>
  \`).join('')

  // 技能排行
  if (stats.topSkills) {
    const maxSkillCount = Math.max(...stats.topSkills.map(s => s.count))
    document.getElementById('skillRanking').innerHTML = stats.topSkills.map((s, i) => \`
      <div class="flex items-center gap-3">
        <span class="w-6 h-6 \${i < 3 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'} rounded-full flex items-center justify-center text-xs font-bold">\${i+1}</span>
        <span class="w-24 text-sm text-gray-700">\${s.name}</span>
        <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 rounded-full" style="width: \${(s.count/maxSkillCount*100).toFixed(1)}%"></div>
        </div>
        <span class="text-sm text-gray-500 w-8 text-right">\${s.count}</span>
      </div>
    \`).join('')
  }
  
  // 图表
  if (stats.byEducation) {
    const ctx = document.getElementById('eduPieChart')
    if (ctx) {
      state.charts['eduPie'] = new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(stats.byEducation), datasets: [{ data: Object.values(stats.byEducation), backgroundColor: chartColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 12 } } } } }
      })
    }
  }
  
  if (stats.byChannel) {
    const ctx = document.getElementById('channelBarChart')
    if (ctx) {
      state.charts['channelBar'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(stats.byChannel),
          datasets: [{ data: Object.values(stats.byChannel), backgroundColor: '#3b82f6', borderRadius: 6, borderSkipped: false }]
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false } } } }
      })
    }
  }
  
  if (stats.byExperience) {
    const ctx = document.getElementById('expPieChart')
    if (ctx) {
      state.charts['expPie'] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(stats.byExperience), datasets: [{ data: Object.values(stats.byExperience), backgroundColor: chartColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } } } }
      })
    }
  }
  
  // 趋势图（模拟数据）
  const trendCtx = document.getElementById('trendChart')
  if (trendCtx) {
    const labels = ['10月', '11月', '12月', '1月', '2月', '3月']
    state.charts['trend'] = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '新增候选人',
          data: [8, 15, 12, 20, 18, stats.recentAdded || 5],
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f615',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }
    })
  }
}

// ==========================================
// 页面：系统设置
// ==========================================
function renderSettings() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="p-6 max-w-2xl mx-auto">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800">系统设置</h2>
        <p class="text-gray-500 text-sm mt-1">配置AI解析功能和系统参数</p>
      </div>
      
      <!-- AI配置 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h3 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <i class="fas fa-robot text-blue-500"></i>AI解析配置
        </h3>
        <p class="text-gray-400 text-sm mb-4">配置OpenAI API Key以启用智能简历解析功能</p>
        
        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium text-gray-700 block mb-1.5">OpenAI API Key <span class="text-red-500">*</span></label>
            <div class="relative">
              <input type="password" id="apiKeyInput" value="\${state.openaiKey}" placeholder="sk-..." 
                class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-24 font-mono">
              <button onclick="toggleApiKeyVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                <i id="eyeIcon" class="fas fa-eye"></i>
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-1">API Key保存在浏览器本地，不会上传到服务器</p>
          </div>
          
          <div>
            <label class="text-sm font-medium text-gray-700 block mb-1.5">API Base URL</label>
            <input type="text" id="apiBaseUrlInput" value="\${state.openaiBaseUrl}" 
              placeholder="https://api.openai.com/v1"
              class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <p class="text-xs text-gray-400 mt-1">如使用中转服务商，修改此URL（默认: https://api.openai.com/v1）</p>
          </div>
          
          <div class="flex gap-3">
            <button onclick="saveApiSettings()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition">
              <i class="fas fa-save mr-2"></i>保存配置
            </button>
            <button onclick="testApiConnection()" class="border border-gray-200 text-gray-600 px-6 py-3 rounded-xl text-sm hover:bg-gray-50 transition">
              <i class="fas fa-plug mr-1"></i>测试连接
            </button>
          </div>
        </div>
      </div>
      
      <!-- 系统信息 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-info-circle text-blue-500"></i>系统信息
        </h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-gray-400 text-xs mb-1">系统版本</p>
            <p class="font-medium text-gray-700">v1.0.0</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-gray-400 text-xs mb-1">运行环境</p>
            <p class="font-medium text-gray-700">Cloudflare Workers</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-gray-400 text-xs mb-1">AI模型</p>
            <p class="font-medium text-gray-700">GPT-4o (OpenAI)</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-gray-400 text-xs mb-1">数据存储</p>
            <p class="font-medium text-gray-700">内存存储（演示模式）</p>
          </div>
        </div>
      </div>
      
      <!-- Java后端说明 -->
      <div class="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <h4 class="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <i class="fab fa-java text-blue-600 text-lg"></i>连接Java后端说明
        </h4>
        <p class="text-sm text-blue-700 mb-3">当前为演示模式（内存存储）。接入生产Java+MySQL后端：</p>
        <ol class="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>使用 migrations/001_initial_schema.sql 在MySQL中建表</li>
          <li>在Java Spring Boot中实现对应的REST API（同路径）</li>
          <li>修改 src/routes/ 中的接口调用地址到Java服务</li>
          <li>或直接在Java中提供完整前后端，本前端可独立使用</li>
        </ol>
      </div>
    </div>
  \`
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('apiKeyInput')
  const icon = document.getElementById('eyeIcon')
  if (input.type === 'password') {
    input.type = 'text'
    icon.className = 'fas fa-eye-slash'
  } else {
    input.type = 'password'
    icon.className = 'fas fa-eye'
  }
}

function saveApiSettings() {
  state.openaiKey = document.getElementById('apiKeyInput').value.trim()
  state.openaiBaseUrl = document.getElementById('apiBaseUrlInput').value.trim() || 'https://api.openai.com/v1'
  localStorage.setItem('openai_key', state.openaiKey)
  localStorage.setItem('openai_base_url', state.openaiBaseUrl)
  updateAiStatus()
  showToast('配置保存成功！', 'success')
}

async function testApiConnection() {
  const key = document.getElementById('apiKeyInput').value.trim()
  const baseUrl = document.getElementById('apiBaseUrlInput').value.trim() || 'https://api.openai.com/v1'
  if (!key) { showToast('请先输入API Key', 'warning'); return }
  
  showToast('正在测试连接...', 'info')
  try {
    const res = await apiRequest('/api/upload/config', {
      method: 'POST',
      body: JSON.stringify({ openaiKey: key, openaiBaseUrl: baseUrl })
    })
    if (res.success) showToast('连接测试成功！', 'success')
    else showToast(res.message, 'error')
  } catch (e) {
    showToast('连接测试失败: ' + e.message, 'error')
  }
}

function updateAiStatus() {
  const dot = document.getElementById('aiStatusDot')
  const text = document.getElementById('aiStatusText')
  if (state.openaiKey) {
    dot.className = 'w-2 h-2 rounded-full bg-green-400'
    text.className = 'text-sm text-green-300'
    text.textContent = 'AI就绪'
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-gray-400'
    text.className = 'text-sm text-gray-300'
    text.textContent = '未配置'
  }
}

// ==========================================
// 请求拦截：自动添加API Key头
// ==========================================
const originalFetch = window.fetch
window.fetch = function(url, options = {}) {
  if (typeof url === 'string' && url.startsWith('/api/upload/') && state.openaiKey) {
    options.headers = {
      ...options.headers,
      'X-OpenAI-Key': state.openaiKey,
      'X-OpenAI-Base-URL': state.openaiBaseUrl
    }
  }
  return originalFetch(url, options)
}

// ==========================================
// 初始化
// ==========================================
updateAiStatus()
navigateTo('dashboard')
</script>
</body>
</html>`
}

export default app
