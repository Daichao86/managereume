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
  charts: {},
  currentUser: null,   // 当前登录用户信息
  authToken: localStorage.getItem('auth_token') || ''
}

// ==========================================
// 认证工具函数
// ==========================================
function getAuthToken() {
  return state.authToken || localStorage.getItem('auth_token') || ''
}

function redirectToLogin() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  state.authToken = ''
  state.currentUser = null
  window.location.href = '/login'
}

function doLogout() {
  if (!confirm('确认退出登录？')) return
  fetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getAuthToken() }
  }).catch(() => {})
  redirectToLogin()
}

// 更新侧边栏用户信息显示
function updateUserDisplay(user) {
  if (!user) return
  state.currentUser = user
  const nameEl  = document.getElementById('userDisplayName')
  const roleEl  = document.getElementById('userRoleBadge')
  const avatarEl = document.getElementById('userAvatar')
  const ROLE_LABELS = { admin: '超级管理员', hr: 'HR招聘专员', interviewer: '面试官', viewer: '只读查看' }
  if (nameEl)  nameEl.textContent  = user.realName || user.username || '-'
  if (roleEl)  roleEl.textContent  = ROLE_LABELS[user.role] || user.role || '-'
  if (avatarEl) avatarEl.textContent = (user.realName || user.username || '?').charAt(0).toUpperCase()
}

// 登录状态检查（页面初始化时调用）
async function checkAuthAndInit() {
  const token = getAuthToken()
  if (!token) {
    redirectToLogin()
    return
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    const data = await res.json()
    if (!data.success) {
      redirectToLogin()
      return
    }
    updateUserDisplay(data.user)
    // 认证通过，初始化页面
    updateAiStatus()
    navigateTo('dashboard')
  } catch (e) {
    console.error('认证检查失败:', e)
    redirectToLogin()
  }
}

// ==========================================
// 工具函数
// ==========================================
function showToast(message, type = 'success') {
  const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' }
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }
  const toast = document.createElement('div')
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 fade-in max-w-sm`
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span class="text-sm">${message}</span>`
  document.getElementById('toastContainer').appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}

function showLoading(title = 'AI解析中...', desc = '正在智能提取简历信息，请稍候') {
  // 移除旧遮罩（防止重复叠加）
  const old = document.getElementById('loadingOverlay')
  if (old) old.remove()

  // 动态创建遮罩并挂在 body 末尾，确保不受任何 overflow/transform 影响
  const overlay = document.createElement('div')
  overlay.id = 'loadingOverlay'
  overlay.className = 'loading-overlay'
  // 用 DOM API 构建内容，避免模板字符串在 TSX 大字符串内嵌套的解析问题
  const card = document.createElement('div')
  card.style.cssText = 'background:#fff;border-radius:18px;padding:32px;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:0 25px 60px rgba(0,0,0,0.25);max-width:320px;width:calc(100% - 32px)'
  const spinner = document.createElement('div')
  spinner.style.cssText = 'width:56px;height:56px;border:4px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite'
  const textBox = document.createElement('div')
  textBox.style.cssText = 'text-align:center'
  const titleEl = document.createElement('p')
  titleEl.id = 'loadingTitle'
  titleEl.style.cssText = 'font-weight:600;color:#1e293b;font-size:17px;margin:0'
  titleEl.textContent = title
  const descEl = document.createElement('p')
  descEl.id = 'loadingDesc'
  descEl.style.cssText = 'color:#64748b;font-size:13px;margin:6px 0 0'
  descEl.textContent = desc
  textBox.appendChild(titleEl)
  textBox.appendChild(descEl)
  const barWrap = document.createElement('div')
  barWrap.style.cssText = 'width:100%;background:#f1f5f9;border-radius:999px;height:6px;overflow:hidden'
  const barEl = document.createElement('div')
  barEl.id = 'loadingBar'
  barEl.style.cssText = 'background:#2563eb;height:100%;border-radius:999px;width:0%;transition:width 0.4s ease'
  barWrap.appendChild(barEl)
  const hint = document.createElement('p')
  hint.style.cssText = 'color:#94a3b8;font-size:11px;margin:0'
  hint.textContent = '请勿关闭页面，通常需要10~30秒'
  card.appendChild(spinner)
  card.appendChild(textBox)
  card.appendChild(barWrap)
  card.appendChild(hint)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  let progress = 0
  const bar = document.getElementById('loadingBar')
  const interval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 12, 90)
    bar.style.width = progress + '%'
  }, 600)

  // 安全超时：最多 3 分钟自动关闭，防止因网络异常永久卡住
  const safeTimer = setTimeout(() => {
    clearInterval(interval)
    const el = document.getElementById('loadingOverlay')
    if (el) el.remove()
    showToast('请求超时，请检查网络后重试', 'error')
  }, 180000)

  return () => {
    clearInterval(interval)
    clearTimeout(safeTimer)
    const el = document.getElementById('loadingBar')
    if (el) el.style.width = '100%'
    setTimeout(() => {
      const overlay = document.getElementById('loadingOverlay')
      if (overlay) overlay.remove()
    }, 350)
  }
}

async function apiRequest(url, options = {}) {
  try {
    const token = getAuthToken()
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...options.headers
      },
      ...options
    })
    // 收到 401 说明 token 失效，自动跳转登录
    if (response.status === 401) {
      const data = await response.json().catch(() => ({}))
      const code = data.code || ''
      if (code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED') {
        showToast(data.message || '登录已过期，请重新登录', 'warning')
        setTimeout(redirectToLogin, 1200)
        return { success: false, message: data.message || '未授权' }
      }
    }
    if (!response.ok) {
      try {
        return await response.json()
      } catch {
        return { success: false, message: 'HTTP ' + response.status + ': ' + response.statusText }
      }
    }
    return response.json()
  } catch (e) {
    console.error('[apiRequest] 请求失败:', url, e.message)
    return { success: false, message: '网络请求失败: ' + e.message, data: null }
  }
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
  return `<span class="status-badge ${cfg.color}">${cfg.label}</span>`
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
  // 清除所有一级激活态
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'))
  // 清除所有二级激活态
  document.querySelectorAll('.sub-link').forEach(el => el.classList.remove('active'))
  const navEl = document.getElementById('nav-' + page)
  if (navEl) navEl.classList.add('active')

  // 如果跳到 settings 页（非子菜单调用时），展开子菜单并默认高亮 AI 配置
  if (page === 'settings') {
    openSettingsMenu()
    const firstSub = document.getElementById('nav-settings-ai')
    if (firstSub) firstSub.classList.add('active')
  } else {
    // 跳到其他页时，收起设置子菜单
    closeSettingsMenu()
  }

  // 销毁图表
  Object.values(state.charts).forEach(chart => { try { chart.destroy() } catch {} })
  state.charts = {}

  const pages = { dashboard: renderDashboard, candidates: renderCandidateList, archive: renderArchiveSearch, upload: renderUpload, analytics: renderAnalytics, settings: renderSettings }
  const renderFn = pages[page]
  if (renderFn) renderFn(params)
}

// 打开设置子菜单
function openSettingsMenu() {
  const submenu = document.getElementById('settings-submenu')
  const arrow   = document.getElementById('settings-arrow')
  const parent  = document.getElementById('nav-settings')
  if (submenu) submenu.classList.add('open')
  if (arrow)   arrow.style.transform = 'rotate(90deg)'
  if (parent)  parent.classList.add('open')
}

// 收起设置子菜单
function closeSettingsMenu() {
  const submenu = document.getElementById('settings-submenu')
  const arrow   = document.getElementById('settings-arrow')
  const parent  = document.getElementById('nav-settings')
  if (submenu) submenu.classList.remove('open')
  if (arrow)   arrow.style.transform = ''
  if (parent)  { parent.classList.remove('open'); parent.classList.remove('active') }
  // 清除子菜单高亮
  document.querySelectorAll('.sub-link').forEach(el => el.classList.remove('active'))
}

// 一级菜单点击：切换展开/收起
function toggleSettingsMenu() {
  const submenu = document.getElementById('settings-submenu')
  if (submenu && submenu.classList.contains('open')) {
    closeSettingsMenu()
  } else {
    // 清除其他一级激活
    document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'))
    document.getElementById('nav-settings')?.classList.add('active')
    openSettingsMenu()
    // 默认进入 AI 配置
    navigateToSettings('ai')
  }
}

// 二级子菜单导航
function navigateToSettings(tab) {
  // 父菜单激活
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'))
  document.getElementById('nav-settings')?.classList.add('active')
  openSettingsMenu()
  // 子菜单高亮
  document.querySelectorAll('.sub-link').forEach(el => el.classList.remove('active'))
  document.getElementById('nav-settings-' + tab)?.classList.add('active')
  // 销毁图表
  Object.values(state.charts).forEach(chart => { try { chart.destroy() } catch {} })
  state.charts = {}
  state.currentPage = 'settings'
  renderSettings(tab)
}

// ==========================================
// 数据加载
// ==========================================
async function loadCandidates(params = {}) {
  const merged = { ...state.searchParams, ...params }
  state.searchParams = merged
  
  const query = Object.entries(merged)
    .filter(([_, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  
  const res = await apiRequest(`/api/candidates?${query}`)
  if (res.success) {
    state.candidates = res.data || []
    state.totalCandidates = res.total || 0
    const el = document.getElementById('candidateCount')
    if (el) el.textContent = res.total || 0
  } else {
    // 数据库未连接时显示空列表，不卡死
    state.candidates = []
    state.totalCandidates = 0
    const el = document.getElementById('candidateCount')
    if (el) el.textContent = '0'
    if (res.message) console.warn('[loadCandidates]', res.message)
  }
  return res
}

async function loadStats() {
  const res = await apiRequest('/api/candidates/stats/overview')
  if (res.success && res.data) {
    state.stats = res.data
    return res.data
  }
  // 返回空统计，让看板正常渲染
  const empty = { total: 0, recentAdded: 0, avgMatchScore: 0, byStatus: {}, byEducation: {}, byChannel: {}, byExperience: {}, topSkills: [] }
  state.stats = empty
  if (res.message) console.warn('[loadStats]', res.message)
  return empty
}

// ==========================================
// 页面：数据看板
// ==========================================
async function renderDashboard() {
  document.getElementById('mainContent').innerHTML = `
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
  `
  
  const stats = await loadStats()
  // 看板用独立请求获取最近候选人，避免污染 state.searchParams（否则切换到列表页时 pageSize 会变成5）
  const recentRes = await apiRequest('/api/candidates?page=1&pageSize=5&sortBy=createdAt&sortOrder=desc')
  const recentCandidates = recentRes.success ? recentRes.data : []
  
  // 更新统计卡片
  document.getElementById('statCards').innerHTML = `
    <div class="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-5 text-white card-hover">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-blue-100 text-sm">人才总数</p>
          <p class="text-4xl font-bold mt-1">${stats.total}</p>
          <p class="text-blue-200 text-xs mt-2">+${stats.recentAdded} 近30天</p>
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
          <p class="text-4xl font-bold mt-1">${stats.byStatus?.interviewing || 0}</p>
          <p class="text-green-200 text-xs mt-2">活跃候选人 ${stats.byStatus?.active || 0} 人</p>
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
          <p class="text-4xl font-bold mt-1">${stats.byStatus?.hired || 0}</p>
          <p class="text-purple-200 text-xs mt-2">录用率 ${stats.total > 0 ? Math.round((stats.byStatus?.hired||0)/stats.total*100) : 0}%</p>
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
          <p class="text-4xl font-bold mt-1">${stats.avgMatchScore || '-'}</p>
          <p class="text-orange-200 text-xs mt-2">满分100分</p>
        </div>
        <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <i class="fas fa-robot text-white text-xl"></i>
        </div>
      </div>
    </div>
  `
  
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
  if (stats.topSkills && stats.topSkills.length > 0) {
    const maxCount = Math.max(...stats.topSkills.map(s => s.count)) || 1
    document.getElementById('skillCloud').innerHTML = stats.topSkills.map(s => {
      const ratio = s.count / maxCount
      const size = ratio > 0.8 ? 'text-base font-bold' : ratio > 0.5 ? 'text-sm font-semibold' : 'text-xs'
      const bg = ratio > 0.8 ? 'bg-blue-500 text-white' : ratio > 0.5 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
      return `<span class="${size} ${bg} px-3 py-1.5 rounded-full cursor-pointer hover:opacity-80" onclick="navigateTo('candidates', {skillKeyword:'${s.name}'})">${s.name} <span class="opacity-70">${s.count}</span></span>`
    }).join('')
  }
  
  // 最新候选人
  document.getElementById('recentCandidates').innerHTML = recentCandidates.length === 0 ? 
    '<p class="text-center text-gray-400 py-4">暂无候选人数据</p>' :
    `<table class="w-full text-sm">
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
        ${recentCandidates.map(c => `<tr class="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onclick="viewCandidate(${c.id})">
          <td class="py-3 font-medium text-gray-800">${c.name}</td>
          <td class="py-3 text-gray-600">${c.expectedPosition || '-'}</td>
          <td class="py-3">${c.highestEducation || '-'}</td>
          <td class="py-3">${c.yearsOfExperience ? c.yearsOfExperience+'年' : '-'}</td>
          <td class="py-3">${getStatusBadge(c.candidateStatus)}</td>
          <td class="py-3 text-gray-500">${c.sourceChannel || '-'}</td>
          <td class="py-3 text-gray-400">${formatDate(c.createdAt)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
}

// ==========================================
// 页面：档案查询（多条件联合搜索）
// ==========================================
// 档案查询独立的搜索状态，不影响人才库
const archiveState = {
  params: {
    page: 1, pageSize: 20,
    keyword: '', name: '', phone: '', email: '', gender: '',
    minAge: '', maxAge: '',
    location: '', expectedPosition: '', expectedCity: '',
    currentStatus: '', candidateStatus: '', highestEducation: '',
    minExperience: '', maxExperience: '',
    minSalary: '', maxSalary: '',
    sourceChannel: '', skillKeyword: '', companyKeyword: '',
    schoolKeyword: '', majorKeyword: '', industryKeyword: '',
    hasResume: '', minMatchScore: '',
    sortBy: 'createdAt', sortOrder: 'desc'
  },
  results: [],
  total: 0,
  loading: false
}

async function renderArchiveSearch() {
  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-col h-full bg-gray-50" style="height:calc(100vh - 0px)">

      <!-- 页面头部 -->
      <div class="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-search text-blue-500"></i>档案查询
          </h2>
          <p class="text-gray-400 text-xs mt-0.5">多维度联合查询，精准定位人才档案</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="archiveClearAll()" class="text-sm border border-gray-200 text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-50 transition flex items-center gap-1.5">
            <i class="fas fa-undo text-xs"></i>重置条件
          </button>
          <button onclick="archiveSearch(1)" class="text-sm bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-1.5">
            <i class="fas fa-search text-xs"></i>开始查询
          </button>
        </div>
      </div>

      <!-- 搜索条件区 -->
      <div class="flex-shrink-0 overflow-y-auto bg-white border-b border-gray-100 px-6 py-4 space-y-4">

        <!-- 第一行：全文搜索 -->
        <div class="flex items-center gap-3">
          <label class="text-xs font-semibold text-gray-400 w-16 flex-shrink-0">全文搜索</label>
          <div class="flex-1 relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs"></i>
            <input type="text" id="aq-keyword" placeholder="搜索姓名、职位、邮箱、城市、备注..." value="${archiveState.params.keyword}"
              class="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
        </div>

        <!-- 分隔线 + 分组标题 -->
        <div class="flex items-center gap-3">
          <span class="text-[11px] font-bold text-blue-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
            <i class="fas fa-user"></i>基本信息
          </span>
          <div class="flex-1 h-px bg-gray-100"></div>
        </div>

        <!-- 第二行：个人信息 -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">姓名</label>
            <input type="text" id="aq-name" placeholder="模糊匹配" value="${archiveState.params.name}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">手机号</label>
            <input type="text" id="aq-phone" placeholder="部分匹配" value="${archiveState.params.phone}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">邮箱</label>
            <input type="text" id="aq-email" placeholder="部分匹配" value="${archiveState.params.email}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">性别</label>
            <select id="aq-gender" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">不限</option>
              <option value="男" ${archiveState.params.gender==='男'?'selected':''}>男</option>
              <option value="女" ${archiveState.params.gender==='女'?'selected':''}>女</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">年龄区间</label>
            <div class="flex items-center gap-1">
              <input type="number" id="aq-minAge" placeholder="最小" min="16" max="70" value="${archiveState.params.minAge}"
                class="border border-gray-200 rounded-lg px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400">
              <span class="text-gray-300 text-xs">-</span>
              <input type="number" id="aq-maxAge" placeholder="最大" min="16" max="70" value="${archiveState.params.maxAge}"
                class="border border-gray-200 rounded-lg px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">现居城市</label>
            <input type="text" id="aq-location" placeholder="如: 北京、上海" value="${archiveState.params.location}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
        </div>

        <!-- 职业意向分组 -->
        <div class="flex items-center gap-3">
          <span class="text-[11px] font-bold text-green-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
            <i class="fas fa-briefcase"></i>职业意向
          </span>
          <div class="flex-1 h-px bg-gray-100"></div>
        </div>

        <!-- 第三行：职业信息 -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">求职状态</label>
            <select id="aq-currentStatus" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">不限</option>
              <option value="在职-考虑机会" ${archiveState.params.currentStatus==='在职-考虑机会'?'selected':''}>在职-考虑机会</option>
              <option value="在职-急找" ${archiveState.params.currentStatus==='在职-急找'?'selected':''}>在职-急找</option>
              <option value="离职-找工作" ${archiveState.params.currentStatus==='离职-找工作'?'selected':''}>离职-找工作</option>
              <option value="应届生" ${archiveState.params.currentStatus==='应届生'?'selected':''}>应届生</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">档案状态</label>
            <select id="aq-candidateStatus" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">不限</option>
              <option value="active" ${archiveState.params.candidateStatus==='active'?'selected':''}>活跃</option>
              <option value="interviewing" ${archiveState.params.candidateStatus==='interviewing'?'selected':''}>面试中</option>
              <option value="hired" ${archiveState.params.candidateStatus==='hired'?'selected':''}>已录用</option>
              <option value="rejected" ${archiveState.params.candidateStatus==='rejected'?'selected':''}>已淘汰</option>
              <option value="blacklist" ${archiveState.params.candidateStatus==='blacklist'?'selected':''}>黑名单</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">意向职位</label>
            <input type="text" id="aq-expectedPosition" placeholder="如: Java工程师" value="${archiveState.params.expectedPosition}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">期望城市</label>
            <input type="text" id="aq-expectedCity" placeholder="如: 北京、深圳" value="${archiveState.params.expectedCity}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">工作年限</label>
            <div class="flex items-center gap-1">
              <input type="number" id="aq-minExp" placeholder="最少" min="0" max="50" value="${archiveState.params.minExperience}"
                class="border border-gray-200 rounded-lg px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400">
              <span class="text-gray-300 text-xs">-</span>
              <input type="number" id="aq-maxExp" placeholder="最多" min="0" max="50" value="${archiveState.params.maxExperience}"
                class="border border-gray-200 rounded-lg px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">期望薪资(元/月)</label>
            <div class="flex items-center gap-1">
              <input type="number" id="aq-minSalary" placeholder="最低" min="0" value="${archiveState.params.minSalary}"
                class="border border-gray-200 rounded-lg px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400">
              <span class="text-gray-300 text-xs">-</span>
              <input type="number" id="aq-maxSalary" placeholder="最高" min="0" value="${archiveState.params.maxSalary}"
                class="border border-gray-200 rounded-lg px-2 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
          </div>
        </div>

        <!-- 教育背景分组 -->
        <div class="flex items-center gap-3">
          <span class="text-[11px] font-bold text-yellow-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
            <i class="fas fa-graduation-cap"></i>教育背景
          </span>
          <div class="flex-1 h-px bg-gray-100"></div>
        </div>

        <!-- 第四行：教育信息 -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">最高学历</label>
            <select id="aq-highestEdu" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">不限</option>
              <option value="博士" ${archiveState.params.highestEducation==='博士'?'selected':''}>博士</option>
              <option value="硕士" ${archiveState.params.highestEducation==='硕士'?'selected':''}>硕士</option>
              <option value="本科" ${archiveState.params.highestEducation==='本科'?'selected':''}>本科</option>
              <option value="大专" ${archiveState.params.highestEducation==='大专'?'selected':''}>大专</option>
              <option value="高中" ${archiveState.params.highestEducation==='高中'?'selected':''}>高中/中专</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">毕业院校</label>
            <input type="text" id="aq-school" placeholder="如: 清华、北大" value="${archiveState.params.schoolKeyword}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">所学专业</label>
            <input type="text" id="aq-major" placeholder="如: 计算机、金融" value="${archiveState.params.majorKeyword}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
        </div>

        <!-- 工作经历分组 -->
        <div class="flex items-center gap-3">
          <span class="text-[11px] font-bold text-purple-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
            <i class="fas fa-building"></i>工作经历
          </span>
          <div class="flex-1 h-px bg-gray-100"></div>
        </div>

        <!-- 第五行：工作经历 -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">技能/技术栈</label>
            <input type="text" id="aq-skill" placeholder="逗号分隔多个技能" value="${archiveState.params.skillKeyword}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">任职公司</label>
            <input type="text" id="aq-company" placeholder="公司名模糊匹配" value="${archiveState.params.companyKeyword}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">所属行业</label>
            <input type="text" id="aq-industry" placeholder="如: 互联网、金融" value="${archiveState.params.industryKeyword}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">来源渠道</label>
            <select id="aq-channel" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">不限</option>
              <option value="BOSS直聘" ${archiveState.params.sourceChannel==='BOSS直聘'?'selected':''}>BOSS直聘</option>
              <option value="智联招聘" ${archiveState.params.sourceChannel==='智联招聘'?'selected':''}>智联招聘</option>
              <option value="猎头推荐" ${archiveState.params.sourceChannel==='猎头推荐'?'selected':''}>猎头推荐</option>
              <option value="LinkedIn" ${archiveState.params.sourceChannel==='LinkedIn'?'selected':''}>LinkedIn</option>
              <option value="校园招聘" ${archiveState.params.sourceChannel==='校园招聘'?'selected':''}>校园招聘</option>
              <option value="内推" ${archiveState.params.sourceChannel==='内推'?'selected':''}>内推</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">匹配分 ≥</label>
            <input type="number" id="aq-minScore" placeholder="如: 80" min="0" max="100" value="${archiveState.params.minMatchScore}"
              class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-[11px] text-gray-400">简历原件</label>
            <select id="aq-hasResume" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="">不限</option>
              <option value="true" ${archiveState.params.hasResume==='true'?'selected':''}>有简历文件</option>
              <option value="false" ${archiveState.params.hasResume==='false'?'selected':''}>无简历文件</option>
            </select>
          </div>
        </div>

        <!-- 备注关键词 -->
        <div class="grid grid-cols-1 gap-3">
          <div class="flex items-center gap-3">
            <label class="text-[11px] text-gray-400 w-16 flex-shrink-0">HR备注</label>
            <input type="text" id="aq-hrNotes" placeholder="搜索HR备注内容..." value="${archiveState.params.hrNotesKeyword || ''}"
              class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              onkeydown="if(event.key==='Enter') archiveSearch(1)">
          </div>
        </div>

      </div>

      <!-- 结果区 -->
      <div class="flex-1 overflow-auto px-6 py-4">
        <div id="archiveResults">
          <div class="flex flex-col items-center justify-center py-20 text-gray-300">
            <i class="fas fa-search text-5xl mb-4 opacity-30"></i>
            <p class="text-base font-medium text-gray-400">设置查询条件，点击「开始查询」</p>
            <p class="text-sm text-gray-300 mt-1">支持多个条件联合过滤，精准定位档案</p>
          </div>
        </div>
      </div>
    </div>
  `
}

// 收集档案查询条件并执行搜索
async function archiveSearch(page = 1) {
  const get = (id) => (document.getElementById(id)?.value || '').trim()
  archiveState.params = {
    ...archiveState.params,
    page,
    keyword: get('aq-keyword'),
    name: get('aq-name'),
    phone: get('aq-phone'),
    email: get('aq-email'),
    gender: get('aq-gender'),
    minAge: get('aq-minAge'),
    maxAge: get('aq-maxAge'),
    location: get('aq-location'),
    currentStatus: get('aq-currentStatus'),
    candidateStatus: get('aq-candidateStatus'),
    expectedPosition: get('aq-expectedPosition'),
    expectedCity: get('aq-expectedCity'),
    minExperience: get('aq-minExp'),
    maxExperience: get('aq-maxExp'),
    minSalary: get('aq-minSalary'),
    maxSalary: get('aq-maxSalary'),
    highestEducation: get('aq-highestEdu'),
    schoolKeyword: get('aq-school'),
    majorKeyword: get('aq-major'),
    skillKeyword: get('aq-skill'),
    companyKeyword: get('aq-company'),
    industryKeyword: get('aq-industry'),
    sourceChannel: get('aq-channel'),
    minMatchScore: get('aq-minScore'),
    hasResume: get('aq-hasResume'),
    hrNotesKeyword: get('aq-hrNotes')
  }

  const resultsDiv = document.getElementById('archiveResults')
  if (!resultsDiv) return
  resultsDiv.innerHTML = `
    <div class="flex items-center justify-center py-12 text-gray-400">
      <i class="fas fa-spinner fa-spin mr-2"></i>查询中...
    </div>
  `

  // 构建查询参数
  const p = archiveState.params
  const query = Object.entries(p)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')

  const res = await apiRequest(`/api/candidates?${query}`)
  if (!res.success) {
    resultsDiv.innerHTML = '<p class="text-center py-8 text-red-400">查询失败，请重试</p>'
    return
  }

  archiveState.results = res.data || []
  archiveState.total = res.total || 0
  const totalPages = Math.ceil(archiveState.total / archiveState.params.pageSize)

  // 生成条件摘要标签
  const chips = []
  if (p.keyword) chips.push(`全文: "${p.keyword}"`)
  if (p.name) chips.push(`姓名: ${p.name}`)
  if (p.phone) chips.push(`手机: ${p.phone}`)
  if (p.email) chips.push(`邮箱: ${p.email}`)
  if (p.gender) chips.push(`性别: ${p.gender}`)
  if (p.minAge || p.maxAge) chips.push(`年龄: ${p.minAge||'?'}-${p.maxAge||'?'}岁`)
  if (p.location) chips.push(`城市: ${p.location}`)
  if (p.currentStatus) chips.push(`求职状态: ${p.currentStatus}`)
  if (p.candidateStatus) chips.push(`档案状态: ${p.candidateStatus}`)
  if (p.expectedPosition) chips.push(`意向职位: ${p.expectedPosition}`)
  if (p.expectedCity) chips.push(`期望城市: ${p.expectedCity}`)
  if (p.minExperience || p.maxExperience) chips.push(`工作年限: ${p.minExperience||'0'}-${p.maxExperience||'∞'}年`)
  if (p.minSalary || p.maxSalary) chips.push(`薪资: ${p.minSalary||'?'}-${p.maxSalary||'?'}元`)
  if (p.highestEducation) chips.push(`学历: ${p.highestEducation}`)
  if (p.schoolKeyword) chips.push(`院校: ${p.schoolKeyword}`)
  if (p.majorKeyword) chips.push(`专业: ${p.majorKeyword}`)
  if (p.skillKeyword) chips.push(`技能: ${p.skillKeyword}`)
  if (p.companyKeyword) chips.push(`公司: ${p.companyKeyword}`)
  if (p.industryKeyword) chips.push(`行业: ${p.industryKeyword}`)
  if (p.sourceChannel) chips.push(`渠道: ${p.sourceChannel}`)
  if (p.minMatchScore) chips.push(`匹配分≥${p.minMatchScore}`)
  if (p.hasResume === 'true') chips.push('有简历原件')
  if (p.hasResume === 'false') chips.push('无简历原件')
  if (p.hrNotesKeyword) chips.push(`备注: ${p.hrNotesKeyword}`)

  if (archiveState.results.length === 0) {
    resultsDiv.innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 p-6">
        ${chips.length ? `<div class="flex flex-wrap gap-2 mb-4">
          ${chips.map(c => `<span class="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1 rounded-full">${c}</span>`).join('')}
        </div>` : ''}
        <div class="text-center py-10 text-gray-400">
          <i class="fas fa-user-slash text-4xl mb-3 block opacity-40"></i>
          <p class="font-medium">未找到符合条件的档案</p>
          <p class="text-sm mt-1 text-gray-300">请尝试放宽查询条件</p>
        </div>
      </div>
    `
    return
  }

  resultsDiv.innerHTML = `
    <!-- 结果统计 + 条件标签 -->
    <div class="bg-white rounded-2xl border border-gray-100 p-4 mb-3 flex items-center gap-4 flex-wrap">
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-sm font-bold text-gray-800">找到 <span class="text-blue-600 text-lg">${archiveState.total}</span> 条档案</span>
        ${totalPages > 1 ? `<span class="text-xs text-gray-400">第 ${p.page}/${totalPages} 页，每页 ${p.pageSize} 条</span>` : ''}
      </div>
      ${chips.length ? `<div class="flex flex-wrap gap-1.5 flex-1">
        ${chips.map(c => `<span class="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">${c}</span>`).join('')}
      </div>` : ''}
      <div class="flex items-center gap-2 flex-shrink-0 ml-auto">
        <label class="text-xs text-gray-400">排序:</label>
        <select class="text-xs border border-gray-200 rounded-lg px-2 py-1" onchange="archiveChangeSortBy(this.value)">
          <option value="createdAt-desc" ${p.sortBy+'-'+p.sortOrder==='createdAt-desc'?'selected':''}>最新添加</option>
          <option value="matchScore-desc" ${p.sortBy+'-'+p.sortOrder==='matchScore-desc'?'selected':''}>匹配分数</option>
          <option value="yearsOfExperience-desc" ${p.sortBy+'-'+p.sortOrder==='yearsOfExperience-desc'?'selected':''}>工作年限</option>
          <option value="name-asc" ${p.sortBy+'-'+p.sortOrder==='name-asc'?'selected':''}>姓名排序</option>
        </select>
      </div>
    </div>

    <!-- 结果表格 -->
    <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">姓名</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">性别/年龄</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">联系方式</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">意向职位</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">学历</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">经验</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">期望薪资</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">城市</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">技能标签</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">状态</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">匹配分</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">来源</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">导入时间</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${archiveState.results.map(c => renderArchiveRow(c)).join('')}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? renderArchivePagination(p.page, totalPages) : ''}
    </div>
  `
}

function renderArchiveRow(c) {
  const skills = (c.skills || []).slice(0, 3)
  return `
    <tr class="hover:bg-blue-50/20 transition cursor-pointer group" onclick="viewCandidate(${c.id})">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            ${c.name?.charAt(0) || '?'}
          </div>
          <span class="font-semibold text-gray-800 whitespace-nowrap">${c.name}</span>
        </div>
      </td>
      <td class="px-4 py-3 text-gray-500 whitespace-nowrap">
        ${c.gender || '-'}${c.age ? ' · ' + c.age + '岁' : ''}
      </td>
      <td class="px-4 py-3">
        <div class="text-gray-600 text-xs leading-5">
          ${c.phone ? `<div>${c.phone}</div>` : ''}
          ${c.email ? `<div class="text-gray-400 truncate max-w-32" title="${c.email}">${c.email}</div>` : ''}
          ${!c.phone && !c.email ? '-' : ''}
        </div>
      </td>
      <td class="px-4 py-3 text-gray-700 text-xs whitespace-nowrap max-w-32 truncate" title="${c.expectedPosition || ''}">
        ${c.expectedPosition || '-'}
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <span class="text-xs bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-0.5 rounded-full">${c.highestEducation || '-'}</span>
      </td>
      <td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
        ${c.yearsOfExperience ? c.yearsOfExperience + '年' : '-'}
      </td>
      <td class="px-4 py-3 text-green-600 text-xs whitespace-nowrap font-medium">
        ${getSalaryText(c.expectedSalaryMin, c.expectedSalaryMax)}
      </td>
      <td class="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
        ${c.location || '-'}
      </td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-1">
          ${skills.map(s => `<span class="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">${s.skillName}</span>`).join('')}
          ${skills.length === 0 ? '<span class="text-gray-300 text-xs">-</span>' : ''}
        </div>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        ${getStatusBadge(c.candidateStatus)}
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        ${c.matchScore ? `<span class="text-orange-600 font-bold text-sm">${c.matchScore}</span><span class="text-gray-300 text-xs">分</span>` : '<span class="text-gray-300 text-xs">-</span>'}
      </td>
      <td class="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
        ${c.sourceChannel || '-'}
      </td>
      <td class="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
        ${formatDate(c.createdAt)}
      </td>
      <td class="px-4 py-3">
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onclick="event.stopPropagation();viewCandidate(${c.id})"
            class="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 whitespace-nowrap">
            <i class="fas fa-eye"></i>
          </button>
          <button onclick="event.stopPropagation();showEditCandidateModal(${c.id})"
            class="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 whitespace-nowrap">
            <i class="fas fa-edit"></i>
          </button>
        </div>
      </td>
    </tr>
  `
}

function renderArchivePagination(currentPage, totalPages) {
  const pages = []
  const start = Math.max(1, currentPage - 3)
  const end = Math.min(totalPages, currentPage + 3)
  for (let i = start; i <= end; i++) pages.push(i)
  return `
    <div class="px-4 py-3 border-t border-gray-50 flex items-center justify-between text-sm">
      <span class="text-xs text-gray-400">第 ${currentPage} / ${totalPages} 页</span>
      <div class="flex gap-1.5">
        <button onclick="archiveSearch(1)" ${currentPage<=1?'disabled':''} 
          class="px-2 py-1.5 border border-gray-200 rounded-lg text-xs disabled:opacity-30 hover:bg-gray-50">
          <i class="fas fa-angle-double-left"></i>
        </button>
        <button onclick="archiveSearch(${currentPage-1})" ${currentPage<=1?'disabled':''} 
          class="px-2 py-1.5 border border-gray-200 rounded-lg text-xs disabled:opacity-30 hover:bg-gray-50">
          <i class="fas fa-chevron-left"></i>
        </button>
        ${pages.map(p => `<button onclick="archiveSearch(${p})"
          class="px-3 py-1.5 border rounded-lg text-xs ${p===currentPage?'bg-blue-600 text-white border-blue-600':'border-gray-200 hover:bg-gray-50'}">${p}</button>`).join('')}
        <button onclick="archiveSearch(${currentPage+1})" ${currentPage>=totalPages?'disabled':''} 
          class="px-2 py-1.5 border border-gray-200 rounded-lg text-xs disabled:opacity-30 hover:bg-gray-50">
          <i class="fas fa-chevron-right"></i>
        </button>
        <button onclick="archiveSearch(${totalPages})" ${currentPage>=totalPages?'disabled':''} 
          class="px-2 py-1.5 border border-gray-200 rounded-lg text-xs disabled:opacity-30 hover:bg-gray-50">
          <i class="fas fa-angle-double-right"></i>
        </button>
      </div>
    </div>
  `
}

function archiveChangeSortBy(val) {
  const [sortBy, sortOrder] = val.split('-')
  archiveState.params.sortBy = sortBy
  archiveState.params.sortOrder = sortOrder
  archiveSearch(1)
}

function archiveClearAll() {
  archiveState.params = {
    page: 1, pageSize: 20,
    keyword: '', name: '', phone: '', email: '', gender: '',
    minAge: '', maxAge: '',
    location: '', expectedPosition: '', expectedCity: '',
    currentStatus: '', candidateStatus: '', highestEducation: '',
    minExperience: '', maxExperience: '',
    minSalary: '', maxSalary: '',
    sourceChannel: '', skillKeyword: '', companyKeyword: '',
    schoolKeyword: '', majorKeyword: '', industryKeyword: '',
    hasResume: '', minMatchScore: '',
    hrNotesKeyword: '',
    sortBy: 'createdAt', sortOrder: 'desc'
  }
  renderArchiveSearch()
}

// ==========================================
// 页面：人才库（左右分栏：列表+预览）
// ==========================================
async function renderCandidateList(params = {}) {
  if (params.skillKeyword) state.searchParams = { ...state.searchParams, skillKeyword: params.skillKeyword, keyword: '' }
  // 重置预览状态
  window._previewCandidateId = null

  document.getElementById('mainContent').innerHTML = `
    <div class="flex flex-col h-full" style="height:calc(100vh - 56px)">
      <!-- 顶部工具栏 -->
      <div class="flex-shrink-0 px-4 pt-4 pb-3 flex flex-wrap gap-3 items-center bg-white border-b border-gray-100">
        <div class="flex items-center gap-2 mr-auto">
          <h2 class="text-lg font-bold text-gray-800">人才库</h2>
          <span id="candidateCountBadge" class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">-</span>
        </div>
        <div class="flex gap-2 flex-wrap">
          <!-- 搜索框 -->
          <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input type="text" id="searchKeyword" placeholder="搜索姓名、职位..." value="${state.searchParams.keyword || ''}"
              class="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
              onkeydown="if(event.key==='Enter') searchCandidates()">
          </div>
          <select id="filterStatus" class="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchCandidates()">
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="interviewing">面试中</option>
            <option value="hired">已录用</option>
            <option value="rejected">已淘汰</option>
            <option value="blacklist">黑名单</option>
          </select>
          <select id="filterEdu" class="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchCandidates()">
            <option value="">全部学历</option>
            <option value="博士">博士</option>
            <option value="硕士">硕士</option>
            <option value="本科">本科</option>
            <option value="大专">大专</option>
          </select>
          <select id="filterChannel" class="border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchCandidates()">
            <option value="">全部渠道</option>
            <option value="BOSS直聘">BOSS直聘</option>
            <option value="智联招聘">智联招聘</option>
            <option value="猎头推荐">猎头推荐</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="校园招聘">校园招聘</option>
            <option value="内推">内推</option>
          </select>
          <input type="text" id="filterSkill" placeholder="技能" value="${state.searchParams.skillKeyword || ''}"
            class="border border-gray-200 rounded-xl px-2 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onkeydown="if(event.key==='Enter') searchCandidates()">
          <button onclick="searchCandidates()" class="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-blue-700 transition">
            <i class="fas fa-search"></i>
          </button>
          <button onclick="clearSearch()" class="border border-gray-200 text-gray-500 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 transition" title="清除筛选">
            <i class="fas fa-times"></i>
          </button>
          <button onclick="showCreateCandidateModal()" class="border border-blue-200 text-blue-600 px-3 py-2 rounded-xl text-sm hover:bg-blue-50 transition" title="手动新增">
            <i class="fas fa-user-plus"></i>
          </button>
          <button onclick="navigateTo('upload')" class="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-blue-700 transition" title="导入简历">
            <i class="fas fa-cloud-upload-alt"></i>
          </button>
        </div>
      </div>

      <!-- 左右分栏主体 -->
      <div class="flex flex-1 overflow-hidden">
        <!-- 左侧：候选人列表 -->
        <div class="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col bg-white overflow-hidden">
          <!-- 排序栏 -->
          <div class="px-3 py-2 border-b border-gray-50 flex justify-between items-center flex-shrink-0">
            <span id="listCountLabel" class="text-xs text-gray-400">加载中...</span>
            <select class="text-xs border border-gray-200 rounded-lg px-2 py-1" onchange="changeSortBy(this.value)">
              <option value="createdAt-desc">最新添加</option>
              <option value="matchScore-desc">匹配分数</option>
              <option value="yearsOfExperience-desc">工作年限</option>
              <option value="name-asc">姓名排序</option>
            </select>
          </div>
          <!-- 滚动列表 -->
          <div class="flex-1 overflow-y-auto" id="candidateListContainer">
            <div class="text-center py-12 text-gray-400">
              <i class="fas fa-spinner fa-spin text-xl mb-2 block"></i>
              <p class="text-sm">加载中...</p>
            </div>
          </div>
        </div>

        <!-- 右侧：预览面板 -->
        <div class="flex-1 overflow-hidden flex flex-col bg-gray-50" id="previewPanel">
          <!-- 空状态 -->
          <div id="previewEmpty" class="flex-1 flex flex-col items-center justify-center text-gray-300">
            <i class="fas fa-hand-pointer text-5xl mb-4 opacity-30"></i>
            <p class="text-base font-medium text-gray-400">点击左侧候选人</p>
            <p class="text-sm text-gray-300 mt-1">预览简历原件与个人信息</p>
          </div>
          <!-- 预览内容区（点击后显示） -->
          <div id="previewContent" class="hidden flex-1 flex flex-col overflow-hidden">
            <!-- 预览头部 -->
            <div id="previewHeader" class="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
            </div>
            <!-- 预览主体（简历文件或信息） -->
            <div id="previewBody" class="flex-1 overflow-hidden flex">
            </div>
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
  `

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
  const countLabel = document.getElementById('listCountLabel')
  const badge = document.getElementById('candidateCountBadge')
  if (!container) return

  if (!res.success || state.candidates.length === 0) {
    if (countLabel) countLabel.textContent = '暂无候选人'
    if (badge) badge.textContent = '0'
    container.innerHTML = `
      <div class="text-center py-16 text-gray-400 px-4">
        <i class="fas fa-search text-3xl mb-3 block"></i>
        <p class="text-sm font-medium">未找到候选人</p>
        <p class="text-xs mt-1">尝试调整筛选条件或<a onclick="navigateTo('upload')" class="text-blue-600 hover:underline cursor-pointer">导入简历</a></p>
      </div>
    `
    return
  }

  const totalPages = Math.ceil(state.totalCandidates / state.searchParams.pageSize)
  if (countLabel) countLabel.textContent = `共 ${state.totalCandidates} 位`
  if (badge) badge.textContent = state.totalCandidates

  container.innerHTML = `
    <div class="divide-y divide-gray-50">
      ${state.candidates.map(c => renderCandidateRow(c)).join('')}
    </div>
    ${totalPages > 1 ? renderPagination(state.searchParams.page, totalPages) : ''}
  `
}

function renderCandidateRow(c) {
  const tags = (c.tags || []).slice(0, 2)
  const isSelected = window._previewCandidateId === c.id
  return `
    <div class="px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50 hover:border-blue-200'}"
      onclick="previewCandidate(${c.id})" id="candidateRow-${c.id}">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          ${c.name?.charAt(0) || '?'}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-semibold text-gray-800 text-sm">${c.name}</span>
            ${getStatusBadge(c.candidateStatus)}
          </div>
          <div class="text-xs text-gray-400 mt-0.5 truncate">
            ${c.expectedPosition || '职位未知'} · ${c.highestEducation || '-'} · ${c.yearsOfExperience || 0}年
          </div>
          ${tags.length ? `<div class="flex gap-1 mt-1 flex-wrap">${tags.map(t => `<span class="${getTagClass(t.tagType)} !text-[10px] !py-0">${t.tagName}</span>`).join('')}</div>` : ''}
        </div>
        ${c.matchScore ? `<div class="flex-shrink-0 text-right"><span class="text-xs text-orange-500 font-medium">${c.matchScore}</span><div class="text-[9px] text-gray-300">分</div></div>` : ''}
      </div>
    </div>
  `
}

// 左侧点击 → 右侧预览（不跳转详情页）
async function previewCandidate(id) {
  // 高亮选中行
  if (window._previewCandidateId) {
    const prev = document.getElementById(`candidateRow-${window._previewCandidateId}`)
    if (prev) {
      prev.classList.remove('bg-blue-50', 'border-blue-500')
      prev.classList.add('border-transparent')
    }
  }
  window._previewCandidateId = id
  const row = document.getElementById(`candidateRow-${id}`)
  if (row) {
    row.classList.add('bg-blue-50', 'border-blue-500')
    row.classList.remove('border-transparent', 'hover:border-blue-200')
  }

  // 显示预览区
  document.getElementById('previewEmpty')?.classList.add('hidden')
  document.getElementById('previewContent')?.classList.remove('hidden')
  document.getElementById('previewContent')?.classList.add('flex')

  // 先加载头部（候选人基础信息）
  const res = await apiRequest(`/api/candidates/${id}`)
  if (!res.success) { showToast('加载失败', 'error'); return }
  const c = res.data

  // 渲染预览头部
  const header = document.getElementById('previewHeader')
  if (header) {
    header.innerHTML = `
      <div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
        ${c.name?.charAt(0) || '?'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-gray-800">${c.name}</span>
          ${getStatusBadge(c.candidateStatus)}
          ${c.matchScore ? `<span class="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><i class="fas fa-star text-orange-400"></i> ${c.matchScore}分</span>` : ''}
        </div>
        <div class="text-xs text-gray-500 mt-0.5">
          ${[c.expectedPosition, c.highestEducation, c.yearsOfExperience ? c.yearsOfExperience+'年经验' : '', c.location].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button onclick="showAddInterviewModal(${c.id})" class="text-xs border border-blue-200 text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition whitespace-nowrap">
          <i class="fas fa-calendar-plus mr-1"></i>面试
        </button>
        <button onclick="showEditCandidateModal(${c.id})" class="text-xs border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition whitespace-nowrap">
          <i class="fas fa-edit mr-1"></i>编辑
        </button>
        <button onclick="viewCandidate(${c.id})" class="text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition whitespace-nowrap">
          <i class="fas fa-external-link-alt mr-1"></i>完整档案
        </button>
      </div>
    `
  }

  // 渲染预览主体：左侧信息摘要 + 右侧简历文件
  const body = document.getElementById('previewBody')
  if (body) {
    body.innerHTML = `
      <!-- 左侧信息摘要 -->
      <div class="w-56 flex-shrink-0 overflow-y-auto border-r border-gray-100 bg-white p-3 space-y-3 text-sm">
        <!-- 联系方式 -->
        ${c.phone || c.email ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">联系方式</p>
          ${c.phone ? `<p class="text-gray-600 text-xs flex items-center gap-1.5"><i class="fas fa-phone text-gray-300 w-3"></i>${c.phone}</p>` : ''}
          ${c.email ? `<p class="text-gray-600 text-xs flex items-center gap-1.5 mt-0.5 break-all"><i class="fas fa-envelope text-gray-300 w-3"></i>${c.email}</p>` : ''}
          ${c.location ? `<p class="text-gray-600 text-xs flex items-center gap-1.5 mt-0.5"><i class="fas fa-map-marker-alt text-gray-300 w-3"></i>${c.location}</p>` : ''}
        </div>` : ''}

        <!-- 薪资期望 -->
        ${(c.expectedSalaryMin || c.expectedSalaryMax) ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">薪资期望</p>
          <p class="text-green-600 font-medium text-xs">${getSalaryText(c.expectedSalaryMin, c.expectedSalaryMax)}</p>
        </div>` : ''}

        <!-- AI标签 -->
        ${c.tags?.length ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">AI标签</p>
          <div class="flex flex-wrap gap-1">
            ${c.tags.slice(0,6).map(t => `<span class="${getTagClass(t.tagType)} !text-[10px]">${t.tagName}</span>`).join('')}
          </div>
        </div>` : ''}

        <!-- 技能 -->
        ${c.skills?.length ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">专业技能</p>
          <div class="space-y-1.5">
            ${c.skills.slice(0, 6).map(s => `
              <div>
                <div class="flex justify-between items-center mb-0.5">
                  <span class="text-xs text-gray-700">${s.skillName}</span>
                  <span class="text-[10px] text-gray-400">${s.proficiency || ''}</span>
                </div>
                <div class="h-1 bg-gray-100 rounded-full">
                  <div class="h-full bg-blue-400 rounded-full" style="width:${s.proficiency==='精通'?90:s.proficiency==='熟练'?70:50}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- 教育背景 -->
        ${c.educations?.length ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">教育背景</p>
          ${c.educations.map(e => `
            <div class="border-l-2 border-blue-200 pl-2 mb-2">
              <p class="text-xs font-medium text-gray-800">${e.schoolName}</p>
              <p class="text-[10px] text-blue-600">${e.degree} · ${e.major}</p>
              <p class="text-[10px] text-gray-400">${e.startDate || ''} - ${e.endDate || ''}</p>
            </div>
          `).join('')}
        </div>` : ''}

        <!-- 工作经历摘要 -->
        ${c.workExperiences?.length ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">工作经历</p>
          ${c.workExperiences.slice(0,3).map(w => `
            <div class="mb-2">
              <p class="text-xs font-medium text-gray-800">${w.companyName}</p>
              <p class="text-[10px] text-blue-600">${w.position}</p>
              <p class="text-[10px] text-gray-400">${w.startDate || ''} - ${w.isCurrent ? '至今' : (w.endDate || '')}</p>
            </div>
          `).join('')}
        </div>` : ''}

        <!-- 自我评价 -->
        ${c.selfEvaluation ? `
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">自我评价</p>
          <p class="text-xs text-gray-600 leading-relaxed line-clamp-4">${c.selfEvaluation}</p>
        </div>` : ''}

        <!-- 渠道/来源 -->
        ${c.sourceChannel ? `
        <div class="pt-2 border-t border-gray-50">
          <p class="text-[10px] text-gray-400"><i class="fas fa-paper-plane mr-1"></i>来源: ${c.sourceChannel}</p>
          <p class="text-[10px] text-gray-400 mt-0.5"><i class="fas fa-clock mr-1"></i>导入: ${formatDate(c.createdAt)}</p>
        </div>` : ''}
      </div>

      <!-- 右侧简历文件预览 -->
      <div class="flex-1 overflow-hidden flex flex-col bg-gray-100" id="resumePreviewZone-${c.id}">
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center text-gray-300">
            <i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>
            <p class="text-sm">加载简历文件...</p>
          </div>
        </div>
      </div>
    `
    // 异步加载简历文件到右侧预览区
    loadResumePreviewZone(c.id)
  }
}

// 在右侧预览区渲染简历文件（内嵌，不弹窗）
async function loadResumePreviewZone(candidateId) {
  const zone = document.getElementById(`resumePreviewZone-${candidateId}`)
  if (!zone) return
  try {
    const res = await apiRequest(`/api/candidates/${candidateId}/resume/info`)
    if (!res.hasFile) {
      zone.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center text-gray-300 p-6">
          <i class="fas fa-file-upload text-4xl mb-3 opacity-40"></i>
          <p class="text-sm text-gray-400 font-medium mb-1">暂无简历原件</p>
          <p class="text-xs text-gray-300 mb-4">上传 PDF 或图片格式的简历</p>
          <label class="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition">
            <i class="fas fa-upload"></i>上传简历
            <input type="file" class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onchange="uploadResumeFile(${candidateId}, this)">
          </label>
        </div>
      `
    } else {
      const f = res.data
      const isImage = f.fileType?.startsWith('image/')
      const isPdf = f.fileType === 'application/pdf' || f.fileName?.toLowerCase().endsWith('.pdf')
      const iconClass = isPdf ? 'fa-file-pdf text-red-400' : isImage ? 'fa-file-image text-green-400' : 'fa-file-word text-blue-400'
      const sizeText = f.fileSize > 1024*1024 ? (f.fileSize/1024/1024).toFixed(1)+' MB' : (f.fileSize/1024).toFixed(0)+' KB'
      const previewUrl = `/api/candidates/${candidateId}/resume`

      if (isPdf || isImage) {
        // 直接内嵌预览
        zone.innerHTML = `
          <div class="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 text-xs text-gray-500">
            <i class="fas ${iconClass}"></i>
            <span class="flex-1 truncate font-medium text-gray-700">${f.fileName}</span>
            <span class="text-gray-400">${sizeText}</span>
            <a href="${previewUrl}?download=1" download="${f.fileName}"
              class="ml-1 text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <i class="fas fa-download"></i>下载
            </a>
            <label class="ml-1 text-orange-500 hover:text-orange-600 flex items-center gap-1 cursor-pointer">
              <i class="fas fa-sync-alt"></i>替换
              <input type="file" class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onchange="uploadResumeFile(${candidateId}, this)">
            </label>
          </div>
          <div class="flex-1 overflow-hidden bg-gray-800 flex items-center justify-center">
            ${isImage
              ? `<img src="${previewUrl}" class="max-w-full max-h-full object-contain" style="max-height:calc(100vh - 160px)">`
              : `<iframe src="${previewUrl}" class="w-full h-full border-0" style="min-height:0"></iframe>`
            }
          </div>
        `
        zone.classList.add('flex', 'flex-col')
      } else {
        // 不可预览的格式（如 Word）
        zone.innerHTML = `
          <div class="flex-1 flex flex-col items-center justify-center text-gray-300 p-6">
            <div class="w-16 h-16 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
              <i class="fas ${iconClass} text-3xl"></i>
            </div>
            <p class="text-sm text-gray-700 font-medium mb-1">${f.fileName}</p>
            <p class="text-xs text-gray-400 mb-4">${sizeText} · ${formatDate(f.uploadedAt)}</p>
            <p class="text-xs text-gray-300 mb-4">该格式暂不支持在线预览</p>
            <div class="flex gap-2">
              <a href="${previewUrl}?download=1" download="${f.fileName}"
                class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-1.5">
                <i class="fas fa-download"></i>下载查看
              </a>
              <label class="border border-orange-200 text-orange-600 hover:bg-orange-50 text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer">
                <i class="fas fa-sync-alt"></i>替换文件
                <input type="file" class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onchange="uploadResumeFile(${candidateId}, this)">
              </label>
            </div>
          </div>
        `
      }
    }
  } catch(e) {
    if (zone) zone.innerHTML = `<div class="flex-1 flex items-center justify-center"><p class="text-xs text-red-400">加载失败</p></div>`
  }
}

function renderPagination(currentPage, totalPages) {
  const pages = []
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  for (let i = start; i <= end; i++) pages.push(i)
  
  return `
    <div class="p-4 border-t border-gray-50 flex justify-center gap-2">
      <button onclick="changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} 
        class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
        <i class="fas fa-chevron-left"></i>
      </button>
      ${pages.map(p => `<button onclick="changePage(${p})" 
        class="px-3 py-1.5 border rounded-lg text-sm ${p === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}">${p}</button>`).join('')}
      <button onclick="changePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} 
        class="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
        <i class="fas fa-chevron-right"></i>
      </button>
    </div>
  `
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
  const res = await apiRequest(`/api/candidates/${id}`)
  if (!res.success) { showToast('加载失败', 'error'); return }
  state.currentCandidate = res.data
  renderCandidateDetail(res.data)
}

function renderCandidateDetail(c) {
  const eduLabels = { '博士': '博士研究生', '硕士': '硕士研究生', '本科': '本科', '大专': '大专', '高中': '高中/中专' }
  
  document.getElementById('mainContent').innerHTML = `
    <div class="p-6 max-w-5xl mx-auto">
      <!-- 返回按钮 -->
      <button onclick="navigateTo('candidates')" class="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition">
        <i class="fas fa-arrow-left"></i>返回人才库
      </button>
      
      <!-- 基本信息卡 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div class="flex items-start gap-6">
          <div class="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
            ${c.name?.charAt(0) || '?'}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-4 flex-wrap">
              <h2 class="text-2xl font-bold text-gray-800">${c.name}</h2>
              ${getStatusBadge(c.candidateStatus)}
              ${c.matchScore ? `<span class="bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-full font-medium"><i class="fas fa-star text-orange-400 mr-1"></i>匹配分 ${c.matchScore}</span>` : ''}
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-gray-600">
              ${c.gender ? `<span><i class="fas fa-user text-gray-300 mr-1"></i>${c.gender}${c.age ? ' · ' + c.age + '岁' : ''}</span>` : ''}
              ${c.phone ? `<span><i class="fas fa-phone text-gray-300 mr-1"></i>${c.phone}</span>` : ''}
              ${c.email ? `<span><i class="fas fa-envelope text-gray-300 mr-1"></i>${c.email}</span>` : ''}
              ${c.location ? `<span><i class="fas fa-map-marker-alt text-gray-300 mr-1"></i>${c.location}</span>` : ''}
              ${c.sourceChannel ? `<span><i class="fas fa-paper-plane text-gray-300 mr-1"></i>${c.sourceChannel}</span>` : ''}
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
              ${c.expectedPosition ? `<span class="text-blue-700 font-medium"><i class="fas fa-briefcase text-blue-400 mr-1"></i>${c.expectedPosition}</span>` : ''}
              ${c.expectedCity ? `<span class="text-gray-600"><i class="fas fa-city text-gray-300 mr-1"></i>期望城市: ${c.expectedCity}</span>` : ''}
              ${(c.expectedSalaryMin || c.expectedSalaryMax) ? `<span class="text-green-700"><i class="fas fa-yen-sign text-green-400 mr-1"></i>期望薪资: ${getSalaryText(c.expectedSalaryMin, c.expectedSalaryMax)}</span>` : ''}
              ${c.yearsOfExperience ? `<span class="text-gray-600"><i class="fas fa-clock text-gray-300 mr-1"></i>${c.yearsOfExperience}年经验</span>` : ''}
            </div>
          </div>
          <div class="flex flex-col gap-2" style="min-width:120px">
            <select onchange="updateStatus(${c.id}, this.value)" class="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active" ${c.candidateStatus==='active'?'selected':''}>活跃</option>
              <option value="interviewing" ${c.candidateStatus==='interviewing'?'selected':''}>面试中</option>
              <option value="hired" ${c.candidateStatus==='hired'?'selected':''}>已录用</option>
              <option value="rejected" ${c.candidateStatus==='rejected'?'selected':''}>已淘汰</option>
              <option value="blacklist" ${c.candidateStatus==='blacklist'?'selected':''}>黑名单</option>
            </select>
            <button onclick="showEditCandidateModal(${c.id})" class="border border-green-200 text-green-600 rounded-xl px-3 py-2 text-sm hover:bg-green-50 transition">
              <i class="fas fa-edit mr-1"></i>编辑档案
            </button>
            <button onclick="showAddInterviewModal(${c.id})" class="border border-blue-200 text-blue-600 rounded-xl px-3 py-2 text-sm hover:bg-blue-50 transition">
              <i class="fas fa-calendar-plus mr-1"></i>添加面试
            </button>
            <button onclick="confirmDelete(${c.id}, '${c.name}')" class="border border-red-200 text-red-500 rounded-xl px-3 py-2 text-sm hover:bg-red-50 transition">
              <i class="fas fa-trash mr-1"></i>删除
            </button>
          </div>
        </div>
        
        <!-- AI标签 -->
        ${c.tags?.length ? `
          <div class="mt-4 pt-4 border-t border-gray-50">
            <p class="text-xs text-gray-400 mb-2"><i class="fas fa-robot mr-1"></i>AI智能标签</p>
            <div class="flex flex-wrap gap-2">
              ${c.tags.map(t => `<span class="${getTagClass(t.tagType)}">${t.tagName}${t.confidence ? ` <span class="opacity-60">${t.confidence}%</span>` : ''}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="grid grid-cols-3 gap-4">
        <div class="col-span-2 space-y-4">
          <!-- 自我评价 -->
          ${c.selfEvaluation ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-quote-left text-blue-400"></i>自我评价</h3>
            <p class="text-gray-600 text-sm leading-relaxed">${c.selfEvaluation}</p>
          </div>` : ''}
          
          <!-- 工作经历 -->
          ${c.workExperiences?.length ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-4 flex items-center gap-2"><i class="fas fa-building text-blue-400"></i>工作经历</h3>
            <div class="space-y-4">
              ${c.workExperiences.map(w => `
                <div class="flex gap-4">
                  <div class="flex flex-col items-center">
                    <div class="w-3 h-3 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div class="w-0.5 bg-gray-200 flex-1 mt-1"></div>
                  </div>
                  <div class="flex-1 pb-4">
                    <div class="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <p class="font-semibold text-gray-800">${w.companyName}</p>
                        <p class="text-blue-600 text-sm font-medium">${w.position}${w.department ? ' · ' + w.department : ''}</p>
                      </div>
                      <span class="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        ${w.startDate || ''} - ${w.isCurrent ? '<span class="text-green-600 font-medium">至今</span>' : (w.endDate || '')}
                      </span>
                    </div>
                    ${w.industry || w.companyType ? `<p class="text-xs text-gray-400 mt-1">${[w.industry, w.companyType, w.companySize].filter(Boolean).join(' · ')}</p>` : ''}
                    ${w.description ? `<p class="text-sm text-gray-600 mt-2 leading-relaxed">${w.description}</p>` : ''}
                    ${w.achievements ? `<p class="text-sm text-green-700 mt-1 bg-green-50 rounded-lg p-2"><i class="fas fa-trophy text-yellow-500 mr-1"></i>${w.achievements}</p>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
          
          <!-- 项目经验 -->
          ${c.projects?.length ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-4 flex items-center gap-2"><i class="fas fa-code-branch text-blue-400"></i>项目经验</h3>
            <div class="space-y-4">
              ${c.projects.map(p => `
                <div class="border border-gray-100 rounded-xl p-4">
                  <div class="flex justify-between items-start">
                    <p class="font-semibold text-gray-800">${p.projectName}</p>
                    ${p.role ? `<span class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">${p.role}</span>` : ''}
                  </div>
                  ${p.techStack ? `<p class="text-xs text-gray-400 mt-1"><i class="fas fa-tools mr-1"></i>${p.techStack}</p>` : ''}
                  ${p.description ? `<p class="text-sm text-gray-600 mt-2">${p.description}</p>` : ''}
                  ${p.achievements ? `<p class="text-sm text-green-700 mt-1"><i class="fas fa-star text-yellow-500 mr-1"></i>${p.achievements}</p>` : ''}
                </div>
              `).join('')}
            </div>
          </div>` : ''}
          
          <!-- 面试记录 -->
          ${c.interviewRecords?.length ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-4 flex items-center gap-2"><i class="fas fa-calendar-alt text-blue-400"></i>面试记录</h3>
            <div class="space-y-3">
              ${c.interviewRecords.map(r => `
                <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div class="text-center flex-shrink-0">
                    <div class="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-sm font-bold text-gray-600">
                      ${r.interviewRound || r.interviewType || '面'}
                    </div>
                  </div>
                  <div class="flex-1">
                    <div class="flex justify-between items-start">
                      <p class="font-medium text-gray-700">${r.interviewRound || r.interviewType || '面试'}</p>
                      <span class="${r.result==='通过'?'text-green-600':r.result==='淘汰'?'text-red-500':'text-gray-500'} text-sm font-medium">${r.result || '待定'}</span>
                    </div>
                    ${r.interviewDate ? `<p class="text-xs text-gray-400 mt-0.5"><i class="far fa-calendar mr-1"></i>${formatDate(r.interviewDate)}</p>` : ''}
                    ${r.feedback ? `<p class="text-sm text-gray-600 mt-1">${r.feedback}</p>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
        </div>
        
        <div class="space-y-4">
          <!-- 教育背景 -->
          ${c.educations?.length ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-graduation-cap text-blue-400"></i>教育背景</h3>
            <div class="space-y-3">
              ${c.educations.map(e => `
                <div class="border-l-2 border-blue-200 pl-3">
                  <p class="font-medium text-gray-800 text-sm">${e.schoolName}</p>
                  <p class="text-blue-600 text-xs">${eduLabels[e.degree] || e.degree} · ${e.major}</p>
                  <p class="text-gray-400 text-xs">${e.startDate || ''} - ${e.endDate || ''}</p>
                  <div class="flex gap-1 mt-1">
                    ${e.is985 ? '<span class="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">985</span>' : ''}
                    ${e.is211 ? '<span class="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">211</span>' : ''}
                    ${e.isOverseas ? '<span class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">海外</span>' : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
          
          <!-- 技能 -->
          ${c.skills?.length ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-tools text-blue-400"></i>专业技能</h3>
            <div class="space-y-2">
              ${c.skills.map(s => `
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <span class="text-sm text-gray-700">${s.skillName}</span>
                    <span class="text-xs text-gray-400">${s.proficiency || ''}${s.yearsUsed ? ' · ' + s.yearsUsed + '年' : ''}</span>
                  </div>
                  <div class="h-1.5 bg-gray-100 rounded-full">
                    <div class="h-full bg-blue-500 rounded-full progress-bar" style="width: ${s.proficiency==='精通'?90:s.proficiency==='熟练'?70:50}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
          
          <!-- 证书荣誉 -->
          ${c.certifications?.length ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-award text-blue-400"></i>证书荣誉</h3>
            <div class="space-y-2">
              ${c.certifications.map(cert => `
                <div class="flex items-start gap-2">
                  <i class="fas fa-medal text-yellow-500 mt-0.5 flex-shrink-0"></i>
                  <div>
                    <p class="text-sm font-medium text-gray-700">${cert.certName}</p>
                    ${cert.issuingOrg ? `<p class="text-xs text-gray-400">${cert.issuingOrg}${cert.issueDate ? ' · ' + cert.issueDate : ''}</p>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
          
          <!-- HR备注 -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2"><i class="fas fa-sticky-note text-blue-400"></i>HR备注</h3>
            <textarea id="hrNotes" rows="4" placeholder="添加备注..." class="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${c.hrNotes || ''}</textarea>
            <button onclick="saveHrNotes(${c.id})" class="mt-2 w-full bg-blue-600 text-white py-2 rounded-xl text-sm hover:bg-blue-700 transition">保存备注</button>
          </div>
          
          <!-- 简历原文件 -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5" id="resumeFileCard-${c.id}">
            <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i class="fas fa-file-pdf text-red-400"></i>简历原件
            </h3>
            <div id="resumeFileContent-${c.id}">
              <div class="text-center py-4 text-gray-400 text-sm">
                <i class="fas fa-spinner fa-spin text-lg mb-2 block"></i>加载中...
              </div>
            </div>
          </div>
          
          <!-- 创建信息 -->
          <div class="bg-gray-50 rounded-2xl p-4 text-xs text-gray-400 space-y-1">
            <p><i class="fas fa-clock mr-1"></i>导入时间: ${formatDate(c.createdAt)}</p>
            <p><i class="fas fa-edit mr-1"></i>更新时间: ${formatDate(c.updatedAt)}</p>
            ${c.resumeFileName ? `<p><i class="fas fa-file mr-1"></i>原始文件: ${c.resumeFileName}</p>` : ''}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 简历预览弹窗 -->
    <div id="resumePreviewModal" class="hidden fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div class="flex items-center justify-between px-5 py-3 bg-gray-900 text-white flex-shrink-0">
        <div class="flex items-center gap-3">
          <i class="fas fa-file-alt text-blue-400"></i>
          <span id="previewModalTitle" class="font-medium text-sm">简历预览</span>
        </div>
        <div class="flex items-center gap-2">
          <button id="previewDownloadBtn" class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg flex items-center gap-2 transition">
            <i class="fas fa-download"></i>下载
          </button>
          <button onclick="document.getElementById('resumePreviewModal').classList.add('hidden');document.getElementById('previewIframe').src=''" 
            class="w-8 h-8 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-hidden bg-gray-800 flex items-center justify-center">
        <iframe id="previewIframe" src="" class="w-full h-full border-0" style="min-height:0"></iframe>
        <img id="previewImg" src="" class="hidden max-w-full max-h-full object-contain" style="max-height:calc(100vh - 60px)">
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
  `
  
  // 异步加载简历文件信息
  loadResumeFileInfo(c.id)
}

async function loadResumeFileInfo(candidateId) {
  const container = document.getElementById(`resumeFileContent-${candidateId}`)
  if (!container) return
  
  try {
    const res = await apiRequest(`/api/candidates/${candidateId}/resume/info`)
    if (!res.hasFile) {
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <i class="fas fa-file-upload text-gray-300 text-xl"></i>
          </div>
          <p class="text-gray-400 text-xs mb-3">暂无简历文件</p>
          <label class="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition">
            <i class="fas fa-upload"></i>上传简历
            <input type="file" class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" 
              onchange="uploadResumeFile(${candidateId}, this)">
          </label>
        </div>
      `
    } else {
      const f = res.data
      const isImage = f.fileType?.startsWith('image/')
      const isPdf = f.fileType === 'application/pdf' || f.fileName?.toLowerCase().endsWith('.pdf')
      const iconClass = isPdf ? 'fa-file-pdf text-red-400' : isImage ? 'fa-file-image text-green-400' : 'fa-file-word text-blue-400'
      const sizeText = f.fileSize > 1024*1024 ? (f.fileSize/1024/1024).toFixed(1)+' MB' : (f.fileSize/1024).toFixed(0)+' KB'
      
      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div class="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center flex-shrink-0">
              <i class="fas ${iconClass} text-lg"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate" title="${f.fileName}">${f.fileName}</p>
              <p class="text-xs text-gray-400 mt-0.5">${sizeText} · ${formatDate(f.uploadedAt)}</p>
            </div>
          </div>
          
          ${(isPdf || isImage) ? `
          <button onclick="previewResumeFile(${candidateId}, '${f.fileName}', '${f.fileType}')" 
            class="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
            <i class="fas fa-eye"></i>预览简历
          </button>` : ''}
          
          <div class="grid grid-cols-2 gap-2">
            <a href="/api/candidates/${candidateId}/resume?download=1" download="${f.fileName}"
              class="py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5">
              <i class="fas fa-download text-xs"></i>下载
            </a>
            <label class="py-2 border border-orange-200 hover:bg-orange-50 text-orange-600 rounded-xl text-sm font-medium transition flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fas fa-sync-alt text-xs"></i>替换
              <input type="file" class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" 
                onchange="uploadResumeFile(${candidateId}, this)">
            </label>
          </div>
          
          <button onclick="deleteResumeFile(${candidateId})"
            class="w-full py-1.5 text-red-400 hover:text-red-600 text-xs transition flex items-center justify-center gap-1">
            <i class="fas fa-trash text-xs"></i>删除文件
          </button>
        </div>
      `
    }
  } catch(e) {
    container.innerHTML = '<p class="text-xs text-red-400 text-center py-3">加载失败</p>'
  }
}

async function previewResumeFile(candidateId, fileName, fileType) {
  const modal = document.getElementById('resumePreviewModal')
  const iframe = document.getElementById('previewIframe')
  const img = document.getElementById('previewImg')
  const title = document.getElementById('previewModalTitle')
  const dlBtn = document.getElementById('previewDownloadBtn')
  
  title.textContent = fileName
  dlBtn.onclick = () => { window.location.href = `/api/candidates/${candidateId}/resume?download=1` }
  
  const isImage = fileType?.startsWith('image/')
  const previewUrl = `/api/candidates/${candidateId}/resume`
  
  if (isImage) {
    iframe.classList.add('hidden')
    img.classList.remove('hidden')
    img.src = previewUrl
  } else {
    img.classList.add('hidden')
    iframe.classList.remove('hidden')
    iframe.src = previewUrl
  }
  
  modal.classList.remove('hidden')
}

async function uploadResumeFile(candidateId, input) {
  const file = input.files[0]
  if (!file) return
  
  const stopLoading = showLoading('上传简历文件...', '正在保存原始简历文件')
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    const res = await fetch(`/api/candidates/${candidateId}/resume`, {
      method: 'POST',
      body: formData
    })
    const data = await res.json()
    stopLoading()
    
    if (data.success) {
      showToast('简历文件上传成功！', 'success')
      // 根据当前视图刷新不同区域
      if (document.getElementById('resumeFileContent-' + candidateId)) {
        loadResumeFileInfo(candidateId)
      } else if (document.getElementById('resumePreviewZone-' + candidateId)) {
        loadResumePreviewZone(candidateId)
      }
    } else {
      showToast(data.message || '上传失败', 'error')
    }
  } catch(e) {
    stopLoading()
    showToast('上传失败: ' + e.message, 'error')
  }
  input.value = ''
}

async function deleteResumeFile(candidateId) {
  if (!confirm('确定要删除该简历文件吗？')) return
  const res = await apiRequest(`/api/candidates/${candidateId}/resume`, { method: 'DELETE' })
  if (res.success) {
    showToast('文件已删除', 'success')
    if (document.getElementById('resumeFileContent-' + candidateId)) {
      loadResumeFileInfo(candidateId)
    } else if (document.getElementById('resumePreviewZone-' + candidateId)) {
      loadResumePreviewZone(candidateId)
    }
  } else {
    showToast(res.message || '删除失败', 'error')
  }
}

async function updateStatus(id, status) {
  const res = await apiRequest(`/api/candidates/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ candidateStatus: status })
  })
  if (res.success) showToast('状态更新成功', 'success')
  else showToast(res.message, 'error')
}

async function saveHrNotes(id) {
  const notes = document.getElementById('hrNotes').value
  const res = await apiRequest(`/api/candidates/${id}/notes`, {
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
  const res = await apiRequest(`/api/candidates/${id}/interviews`, {
    method: 'POST', body: JSON.stringify(data)
  })
  if (res.success) {
    showToast('面试记录添加成功', 'success')
    document.getElementById('interviewModal').classList.add('hidden')
    // 在列表预览模式下刷新预览，在详情页模式下跳转详情
    if (document.getElementById('previewPanel')) {
      previewCandidate(id)
    } else {
      viewCandidate(id)
    }
  } else {
    showToast(res.message, 'error')
  }
}

function confirmDelete(id, name) {
  if (!confirm(`确定要删除候选人「${name}」吗？此操作不可恢复。`)) return
  apiRequest(`/api/candidates/${id}`, { method: 'DELETE' }).then(res => {
    if (res.success) { showToast('删除成功', 'success'); navigateTo('candidates') }
    else showToast(res.message, 'error')
  })
}

// ==========================================
// 手动新增 / 编辑候选人 - 通用表单弹窗
// ==========================================
function buildCandidateFormModal(title, candidate) {
  const c = candidate || {}
  // 移除旧弹窗
  document.getElementById('candidateFormModal')?.remove()
  const modal = document.createElement('div')
  modal.id = 'candidateFormModal'
  modal.className = 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4'
  modal.style.background = 'rgba(0,0,0,0.6)'
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full" style="max-width:760px">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 class="font-bold text-gray-800 text-lg">${title}</h3>
        <button onclick="document.getElementById('candidateFormModal').remove()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-6 space-y-5">
        <!-- Tab -->
        <div class="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onclick="switchFormTab('basic')" id="ftab-basic" class="flex-1 py-2 text-sm font-medium rounded-lg bg-white shadow-sm text-blue-600">基本信息</button>
          <button onclick="switchFormTab('edu')" id="ftab-edu" class="flex-1 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700">教育经历</button>
          <button onclick="switchFormTab('work')" id="ftab-work" class="flex-1 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700">工作经历</button>
          <button onclick="switchFormTab('skill')" id="ftab-skill" class="flex-1 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700">技能标签</button>
        </div>
        
        <!-- 基本信息 -->
        <div id="fpanel-basic" class="space-y-4">
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">姓名 <span class="text-red-500">*</span></label>
              <input id="f-name" type="text" value="${c.name||''}" placeholder="请输入姓名" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">性别</label>
              <select id="f-gender" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">请选择</option>
                <option value="男" ${c.gender==='男'?'selected':''}>男</option>
                <option value="女" ${c.gender==='女'?'selected':''}>女</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">年龄</label>
              <input id="f-age" type="number" value="${c.age||''}" placeholder="如: 28" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" min="16" max="70">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">手机号</label>
              <input id="f-phone" type="text" value="${c.phone||''}" placeholder="13800138000" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">邮箱</label>
              <input id="f-email" type="email" value="${c.email||''}" placeholder="example@email.com" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">现居城市</label>
              <input id="f-location" type="text" value="${c.location||''}" placeholder="如: 北京市朝阳区" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">籍贯</label>
              <input id="f-hometown" type="text" value="${c.hometown||''}" placeholder="如: 山东省济南市" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">最高学历</label>
              <select id="f-education" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">请选择</option>
                ${['博士','硕士','本科','大专','高中'].map(e => `<option value="${e}" ${c.highestEducation===e?'selected':''}>${e}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">工作年限</label>
              <input id="f-exp" type="number" value="${c.yearsOfExperience||''}" placeholder="如: 5" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" max="50" step="0.5">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">求职状态</label>
              <select id="f-curStatus" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                ${['在职','离职','应届'].map(s => `<option value="${s}" ${c.currentStatus===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">期望职位</label>
              <input id="f-position" type="text" value="${c.expectedPosition||''}" placeholder="如: 高级Java工程师" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">期望城市</label>
              <input id="f-ecity" type="text" value="${c.expectedCity||''}" placeholder="如: 北京/上海" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">期望薪资下限(元/月)</label>
              <input id="f-smin" type="number" value="${c.expectedSalaryMin||''}" placeholder="如: 20000" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" step="1000">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">期望薪资上限(元/月)</label>
              <input id="f-smax" type="number" value="${c.expectedSalaryMax||''}" placeholder="如: 30000" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" step="1000">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">来源渠道</label>
              <select id="f-channel" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                ${['手动录入','BOSS直聘','智联招聘','猎头推荐','LinkedIn','校园招聘','内推','官网投递'].map(ch => `<option value="${ch}" ${c.sourceChannel===ch?'selected':''}>${ch}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">自我评价</label>
            <textarea id="f-eval" rows="3" placeholder="请输入自我评价..." class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${c.selfEvaluation||''}</textarea>
          </div>
        </div>
        
        <!-- 教育经历 -->
        <div id="fpanel-edu" class="hidden">
          <div class="flex justify-between items-center mb-3">
            <p class="text-sm text-gray-500">按时间倒序填写，最新的在前</p>
            <button onclick="addEduRow()" class="text-blue-600 text-sm hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"><i class="fas fa-plus mr-1"></i>添加经历</button>
          </div>
          <div id="eduRows" class="space-y-3">
            ${(c.educations?.length ? c.educations : [{schoolName:'',degree:'本科',major:'',startDate:'',endDate:''}]).map((e,i) => buildEduRow(e,i)).join('')}
          </div>
        </div>
        
        <!-- 工作经历 -->
        <div id="fpanel-work" class="hidden">
          <div class="flex justify-between items-center mb-3">
            <p class="text-sm text-gray-500">按时间倒序填写，最新的在前</p>
            <button onclick="addWorkRow()" class="text-blue-600 text-sm hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"><i class="fas fa-plus mr-1"></i>添加经历</button>
          </div>
          <div id="workRows" class="space-y-3">
            ${(c.workExperiences?.length ? c.workExperiences : [{companyName:'',position:'',startDate:'',endDate:'',isCurrent:false,description:''}]).map((w,i) => buildWorkRow(w,i)).join('')}
          </div>
        </div>
        
        <!-- 技能标签 -->
        <div id="fpanel-skill" class="hidden">
          <div class="flex justify-between items-center mb-3">
            <p class="text-sm text-gray-500">添加候选人的专业技能</p>
            <button onclick="addSkillRow()" class="text-blue-600 text-sm hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"><i class="fas fa-plus mr-1"></i>添加技能</button>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 mb-3">
            <div class="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 mb-2 px-1">
              <span class="col-span-2">技能名称</span><span>熟练程度</span><span>使用年限</span>
            </div>
            <div id="skillRows" class="space-y-2">
              ${(c.skills?.length ? c.skills : [{skillName:'',proficiency:'熟练',yearsUsed:''}]).map((s,i) => buildSkillRow(s,i)).join('')}
            </div>
          </div>
          <div class="pt-3 border-t border-gray-200">
            <p class="text-sm font-medium text-gray-700 mb-2">自定义标签</p>
            <div id="customTagsArea" class="flex flex-wrap gap-2 p-3 border border-dashed border-gray-200 rounded-xl min-h-10 mb-2">
              ${(c.tags||[]).filter(t=>t.tagSource==='manual').map(t => `<span class="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">${t.tagName}<button onclick="this.parentElement.remove()" class="hover:text-red-500 ml-0.5">&times;</button></span>`).join('')}
            </div>
            <div class="flex gap-2">
              <input id="newTagInput" type="text" placeholder="输入标签名，回车添加" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomTag()}">
              <button onclick="addCustomTag()" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">添加</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
        <button onclick="document.getElementById('candidateFormModal').remove()" class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-white font-medium">取消</button>
        <button onclick="submitCandidateForm(${c.id||'null'})" class="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm hover:bg-blue-700 font-medium"><i class="fas fa-save mr-1"></i>保存档案</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

function buildEduRow(e, i) {
  return `<div class="border border-gray-100 rounded-xl p-4 space-y-3 relative bg-white" id="eduRow-${i}">
    <button onclick="document.getElementById('eduRow-${i}').remove()" class="absolute top-2 right-2 text-gray-300 hover:text-red-400 p-1"><i class="fas fa-times text-xs"></i></button>
    <div class="grid grid-cols-3 gap-3">
      <div class="col-span-2">
        <label class="block text-xs font-medium text-gray-500 mb-1">学校名称</label>
        <input type="text" name="edu-school-${i}" value="${e.schoolName||''}" placeholder="如：清华大学" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">学历</label>
        <select name="edu-degree-${i}" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          ${['博士','硕士','本科','大专','高中'].map(d => `<option value="${d}" ${e.degree===d?'selected':''}>${d}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">专业</label>
        <input type="text" name="edu-major-${i}" value="${e.major||''}" placeholder="计算机科学" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">开始时间</label>
        <input type="text" name="edu-start-${i}" value="${e.startDate||''}" placeholder="2018-09" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">结束时间</label>
        <input type="text" name="edu-end-${i}" value="${e.endDate||''}" placeholder="2022-07" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
    </div>
    <div class="flex gap-4">
      <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" name="edu-985-${i}" ${e.is985?'checked':''} class="rounded text-blue-500"> 985院校
      </label>
      <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" name="edu-211-${i}" ${e.is211?'checked':''} class="rounded text-blue-500"> 211院校
      </label>
      <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
        <input type="checkbox" name="edu-overseas-${i}" ${e.isOverseas?'checked':''} class="rounded text-blue-500"> 海外院校
      </label>
    </div>
  </div>`
}

function buildWorkRow(w, i) {
  return `<div class="border border-gray-100 rounded-xl p-4 space-y-3 relative bg-white" id="workRow-${i}">
    <button onclick="document.getElementById('workRow-${i}').remove()" class="absolute top-2 right-2 text-gray-300 hover:text-red-400 p-1"><i class="fas fa-times text-xs"></i></button>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">公司名称</label>
        <input type="text" name="work-company-${i}" value="${w.companyName||''}" placeholder="如：字节跳动" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">职位</label>
        <input type="text" name="work-position-${i}" value="${w.position||''}" placeholder="如：高级工程师" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
    </div>
    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">开始时间</label>
        <input type="text" name="work-start-${i}" value="${w.startDate||''}" placeholder="2020-06" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">结束时间</label>
        <input type="text" name="work-end-${i}" value="${w.isCurrent?'':w.endDate||''}" placeholder="2023-12" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" id="work-end-input-${i}" ${w.isCurrent?'disabled':''} style="${w.isCurrent?'opacity:0.4':''}">
      </div>
      <div class="flex items-end pb-1">
        <label class="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" name="work-current-${i}" ${w.isCurrent?'checked':''} class="rounded"
            onchange="const inp=document.getElementById('work-end-input-${i}');inp.disabled=this.checked;inp.style.opacity=this.checked?'0.4':'1'"> 至今在职
        </label>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">行业</label>
        <input type="text" name="work-industry-${i}" value="${w.industry||''}" placeholder="互联网" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">部门</label>
        <input type="text" name="work-dept-${i}" value="${w.department||''}" placeholder="技术部" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-1">工作描述</label>
      <textarea name="work-desc-${i}" rows="2" placeholder="描述主要工作职责与成绩..." class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500">${w.description||''}</textarea>
    </div>
  </div>`
}

function buildSkillRow(s, i) {
  return `<div class="grid grid-cols-4 gap-2 items-center" id="skillRow-${i}">
    <input type="text" name="skill-name-${i}" value="${s.skillName||''}" placeholder="技能名称" class="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
    <select name="skill-prof-${i}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      ${['精通','熟练','了解'].map(p => `<option value="${p}" ${s.proficiency===p?'selected':''}>${p}</option>`).join('')}
    </select>
    <div class="flex gap-1.5 items-center">
      <input type="number" name="skill-years-${i}" value="${s.yearsUsed||''}" placeholder="年" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" min="0" max="30">
      <button onclick="document.getElementById('skillRow-${i}').remove()" class="text-gray-300 hover:text-red-400 text-lg leading-none">&times;</button>
    </div>
  </div>`
}

let _eduRowCount = 0
let _workRowCount = 0  
let _skillRowCount = 0

function addEduRow() {
  _eduRowCount++
  const div = document.createElement('div')
  div.innerHTML = buildEduRow({}, 'n' + _eduRowCount)
  document.getElementById('eduRows')?.appendChild(div.firstElementChild)
}

function addWorkRow() {
  _workRowCount++
  const div = document.createElement('div')
  div.innerHTML = buildWorkRow({}, 'n' + _workRowCount)
  document.getElementById('workRows')?.appendChild(div.firstElementChild)
}

function addSkillRow() {
  _skillRowCount++
  const div = document.createElement('div')
  div.innerHTML = buildSkillRow({}, 'n' + _skillRowCount)
  document.getElementById('skillRows')?.appendChild(div.firstElementChild)
}

function addCustomTag() {
  const input = document.getElementById('newTagInput')
  const val = input?.value?.trim()
  if (!val) return
  const span = document.createElement('span')
  span.className = 'bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full flex items-center gap-1'
  span.innerHTML = `${val}<button onclick="this.parentElement.remove()" class="hover:text-red-500 ml-0.5">&times;</button>`
  document.getElementById('customTagsArea')?.appendChild(span)
  if (input) input.value = ''
}

function switchFormTab(tab) {
  ;['basic','edu','work','skill'].forEach(t => {
    document.getElementById('fpanel-' + t)?.classList.toggle('hidden', t !== tab)
    const btn = document.getElementById('ftab-' + t)
    if (!btn) return
    btn.className = t === tab
      ? 'flex-1 py-2 text-sm font-medium rounded-lg bg-white shadow-sm text-blue-600'
      : 'flex-1 py-2 text-sm font-medium rounded-lg text-gray-500 hover:text-gray-700'
  })
}

function collectFormData() {
  const basic = {
    name: document.getElementById('f-name')?.value?.trim() || '',
    gender: document.getElementById('f-gender')?.value || '',
    age: parseInt(document.getElementById('f-age')?.value) || undefined,
    phone: document.getElementById('f-phone')?.value?.trim() || '',
    email: document.getElementById('f-email')?.value?.trim() || '',
    location: document.getElementById('f-location')?.value?.trim() || '',
    hometown: document.getElementById('f-hometown')?.value?.trim() || '',
    highestEducation: document.getElementById('f-education')?.value || '',
    yearsOfExperience: parseFloat(document.getElementById('f-exp')?.value) || undefined,
    currentStatus: document.getElementById('f-curStatus')?.value || '',
    expectedPosition: document.getElementById('f-position')?.value?.trim() || '',
    expectedCity: document.getElementById('f-ecity')?.value?.trim() || '',
    expectedSalaryMin: parseInt(document.getElementById('f-smin')?.value) || undefined,
    expectedSalaryMax: parseInt(document.getElementById('f-smax')?.value) || undefined,
    sourceChannel: document.getElementById('f-channel')?.value || '手动录入',
    selfEvaluation: document.getElementById('f-eval')?.value?.trim() || ''
  }

  // 教育经历
  const eduRows = document.getElementById('eduRows')?.querySelectorAll('[id^="eduRow"]') || []
  const educations = Array.from(eduRows).map(row => {
    const id = row.id.replace('eduRow-', '')
    const school = row.querySelector(`[name="edu-school-${id}"]`)?.value?.trim()
    if (!school) return null
    return {
      schoolName: school,
      degree: row.querySelector(`[name="edu-degree-${id}"]`)?.value || '本科',
      major: row.querySelector(`[name="edu-major-${id}"]`)?.value?.trim() || '',
      startDate: row.querySelector(`[name="edu-start-${id}"]`)?.value?.trim() || '',
      endDate: row.querySelector(`[name="edu-end-${id}"]`)?.value?.trim() || '',
      is985: row.querySelector(`[name="edu-985-${id}"]`)?.checked || false,
      is211: row.querySelector(`[name="edu-211-${id}"]`)?.checked || false,
      isOverseas: row.querySelector(`[name="edu-overseas-${id}"]`)?.checked || false
    }
  }).filter(Boolean)

  // 工作经历
  const workRows = document.getElementById('workRows')?.querySelectorAll('[id^="workRow"]') || []
  const workExperiences = Array.from(workRows).map(row => {
    const id = row.id.replace('workRow-', '')
    const company = row.querySelector(`[name="work-company-${id}"]`)?.value?.trim()
    if (!company) return null
    const isCurrent = row.querySelector(`[name="work-current-${id}"]`)?.checked || false
    return {
      companyName: company,
      position: row.querySelector(`[name="work-position-${id}"]`)?.value?.trim() || '',
      startDate: row.querySelector(`[name="work-start-${id}"]`)?.value?.trim() || '',
      endDate: isCurrent ? undefined : row.querySelector(`[name="work-end-${id}"]`)?.value?.trim() || '',
      isCurrent,
      industry: row.querySelector(`[name="work-industry-${id}"]`)?.value?.trim() || '',
      department: row.querySelector(`[name="work-dept-${id}"]`)?.value?.trim() || '',
      description: row.querySelector(`[name="work-desc-${id}"]`)?.value?.trim() || ''
    }
  }).filter(Boolean)

  // 技能
  const skillRowEls = document.getElementById('skillRows')?.querySelectorAll('[id^="skillRow"]') || []
  const skills = Array.from(skillRowEls).map(row => {
    const id = row.id.replace('skillRow-', '')
    const name = row.querySelector(`[name="skill-name-${id}"]`)?.value?.trim()
    if (!name) return null
    return {
      skillName: name,
      proficiency: row.querySelector(`[name="skill-prof-${id}"]`)?.value || '熟练',
      yearsUsed: parseInt(row.querySelector(`[name="skill-years-${id}"]`)?.value) || undefined
    }
  }).filter(Boolean)

  // 自定义标签
  const tagEls = document.getElementById('customTagsArea')?.querySelectorAll('span') || []
  const tags = Array.from(tagEls).map(el => ({
    tagName: el.childNodes[0]?.textContent?.trim() || '',
    tagType: 'custom',
    tagSource: 'manual'
  })).filter(t => t.tagName)

  return { ...basic, educations, workExperiences, skills, tags }
}

async function submitCandidateForm(editId) {
  const data = collectFormData()
  if (!data.name) { showToast('请填写候选人姓名', 'warning'); switchFormTab('basic'); return }

  let res
  if (editId && editId !== 'null') {
    res = await apiRequest(`/api/candidates/${editId}`, { method: 'PUT', body: JSON.stringify(data) })
  } else {
    data.candidateStatus = 'active'
    res = await apiRequest('/api/candidates', { method: 'POST', body: JSON.stringify(data) })
  }

  if (res.success) {
    showToast(editId && editId !== 'null' ? '档案更新成功！' : '候选人创建成功！', 'success')
    document.getElementById('candidateFormModal')?.remove()
    if (editId && editId !== 'null') {
      viewCandidate(editId)
    } else {
      navigateTo('candidates')
    }
  } else {
    showToast(res.message || '操作失败', 'error')
  }
}

function showCreateCandidateModal() {
  buildCandidateFormModal('新增候选人档案', null)
}

async function showEditCandidateModal(id) {
  const res = await apiRequest(`/api/candidates/${id}`)
  if (!res.success) { showToast('加载失败', 'error'); return }
  buildCandidateFormModal('编辑候选人档案', res.data)
}

// ==========================================
// 页面：导入简历
// ==========================================
function renderUpload() {
  const hasApiKey = !!state.openaiKey
  
  document.getElementById('mainContent').innerHTML = `
    <div class="p-6 max-w-4xl mx-auto">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800">导入简历</h2>
        <p class="text-gray-500 text-sm mt-1">上传简历文件或粘贴文本，AI自动提取结构化信息</p>
      </div>
      
      ${!hasApiKey ? `
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <i class="fas fa-exclamation-triangle text-amber-500 mt-0.5"></i>
        <div>
          <p class="font-medium text-amber-700">AI功能未配置</p>
          <p class="text-sm text-amber-600 mt-1">需要配置OpenAI API Key才能使用AI智能解析功能。请前往<a onclick="navigateTo('settings')" class="underline cursor-pointer">系统设置</a>配置。</p>
        </div>
      </div>
      ` : `
      <div class="bg-green-50 border border-green-200 rounded-2xl p-3 mb-6 flex items-center gap-3">
        <i class="fas fa-check-circle text-green-500"></i>
        <p class="text-sm text-green-700">AI解析已就绪，支持PDF、Word、TXT、HTML、图片格式</p>
      </div>
      `}
      
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
  `
  
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
  document.getElementById('tab-file').className = `flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 ${tab==='file' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`
  document.getElementById('tab-text').className = `flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 ${tab==='text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`
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
  container.innerHTML = `
    <div class="bg-green-50 border border-green-200 rounded-2xl p-5 fade-in">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
          <i class="fas fa-check text-white"></i>
        </div>
        <div>
          <p class="font-semibold text-green-800">解析成功！</p>
          <p class="text-sm text-green-600">${message}</p>
        </div>
      </div>
      
      <div class="bg-white rounded-xl p-4 space-y-3">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-400">姓名</p>
            <p class="font-semibold text-gray-800">${candidate.name}</p>
          </div>
          ${candidate.phone ? `<div><p class="text-xs text-gray-400">电话</p><p class="font-medium text-gray-700">${candidate.phone}</p></div>` : ''}
          ${candidate.email ? `<div><p class="text-xs text-gray-400">邮箱</p><p class="font-medium text-gray-700">${candidate.email}</p></div>` : ''}
          ${candidate.highestEducation ? `<div><p class="text-xs text-gray-400">学历</p><p class="font-medium text-gray-700">${candidate.highestEducation}</p></div>` : ''}
          ${candidate.yearsOfExperience ? `<div><p class="text-xs text-gray-400">工作年限</p><p class="font-medium text-gray-700">${candidate.yearsOfExperience}年</p></div>` : ''}
          ${candidate.expectedPosition ? `<div><p class="text-xs text-gray-400">期望职位</p><p class="font-medium text-gray-700">${candidate.expectedPosition}</p></div>` : ''}
        </div>
        
        ${candidate.tags?.length ? `
          <div class="pt-3 border-t border-gray-100">
            <p class="text-xs text-gray-400 mb-2">AI生成标签</p>
            <div class="flex flex-wrap gap-2">
              ${candidate.tags.map(t => `<span class="${getTagClass(t.tagType)}">${t.tagName}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="flex gap-3 mt-4">
        <button onclick="viewCandidate(${candidate.id})" class="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm hover:bg-blue-700 transition">
          <i class="fas fa-eye mr-1"></i>查看完整档案
        </button>
        <button onclick="navigateTo('candidates')" class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
          <i class="fas fa-list mr-1"></i>返回人才库
        </button>
      </div>
    </div>
  `
  container.scrollIntoView({ behavior: 'smooth' })
}

// ==========================================
// 页面：统计分析
// ==========================================
async function renderAnalytics() {
  document.getElementById('mainContent').innerHTML = `
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
  `
  
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
  document.getElementById('funnelChart').innerHTML = funnelData.map(d => `
    <div>
      <div class="flex justify-between text-sm mb-1">
        <span class="text-gray-600">${d.label}</span>
        <span class="font-semibold text-gray-800">${d.value}</span>
      </div>
      <div class="h-6 bg-gray-100 rounded-full overflow-hidden">
        <div class="${d.color} h-full rounded-full transition-all" style="width: ${(d.value/maxVal*100).toFixed(1)}%"></div>
      </div>
    </div>
  `).join('')

  // 技能排行
  if (stats.topSkills && stats.topSkills.length > 0) {
    const maxSkillCount = Math.max(...stats.topSkills.map(s => s.count)) || 1
    document.getElementById('skillRanking').innerHTML = stats.topSkills.map((s, i) => `
      <div class="flex items-center gap-3">
        <span class="w-6 h-6 ${i < 3 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'} rounded-full flex items-center justify-center text-xs font-bold">${i+1}</span>
        <span class="w-24 text-sm text-gray-700">${s.name}</span>
        <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 rounded-full" style="width: ${(s.count/maxSkillCount*100).toFixed(1)}%"></div>
        </div>
        <span class="text-sm text-gray-500 w-8 text-right">${s.count}</span>
      </div>
    `).join('')
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
// 页面：系统设置（Tab: AI配置 / 用户管理 / 系统信息）
// ==========================================
function renderSettings(tab = 'ai') {
  document.getElementById('mainContent').innerHTML = `
    <div class="p-6 max-w-4xl mx-auto">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">系统设置</h2>
          <p class="text-gray-500 text-sm mt-1">管理系统配置与用户账号</p>
        </div>
      </div>

      <!-- Tab 导航 -->
      <div class="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6 w-fit">
        <button onclick="switchSettingsTab('ai')" id="stab-ai"
          class="px-5 py-2.5 text-sm font-medium rounded-xl transition ${tab==='ai'?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}">
          <i class="fas fa-robot mr-1.5"></i>AI配置
        </button>
        <button onclick="switchSettingsTab('users')" id="stab-users"
          class="px-5 py-2.5 text-sm font-medium rounded-xl transition ${tab==='users'?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}">
          <i class="fas fa-users-cog mr-1.5"></i>用户管理
        </button>
        <button onclick="switchSettingsTab('system')" id="stab-system"
          class="px-5 py-2.5 text-sm font-medium rounded-xl transition ${tab==='system'?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}">
          <i class="fas fa-info-circle mr-1.5"></i>系统信息
        </button>
      </div>

      <!-- Tab: AI配置 -->
      <div id="spanel-ai" class="${tab!=='ai'?'hidden':''}">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 class="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <i class="fas fa-robot text-blue-500"></i>AI解析配置
          </h3>
          <p class="text-gray-400 text-sm mb-5">配置OpenAI API Key以启用智能简历解析功能</p>
          <div class="space-y-4 max-w-xl">
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1.5">OpenAI API Key <span class="text-red-500">*</span></label>
              <div class="relative">
                <input type="password" id="apiKeyInput" value="${state.openaiKey}" placeholder="sk-..."
                  class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 font-mono">
                <button onclick="toggleApiKeyVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <i id="eyeIcon" class="fas fa-eye text-sm"></i>
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1">API Key保存在浏览器本地，不会上传到服务器</p>
            </div>
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1.5">API Base URL</label>
              <input type="text" id="apiBaseUrlInput" value="${state.openaiBaseUrl}" placeholder="https://api.openai.com/v1"
                class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <p class="text-xs text-gray-400 mt-1">如使用中转服务商，修改此URL</p>
            </div>
            <div class="flex gap-3 pt-1">
              <button onclick="saveApiSettings()" class="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition">
                <i class="fas fa-save mr-2"></i>保存配置
              </button>
              <button onclick="testApiConnection()" class="border border-gray-200 text-gray-600 px-6 py-3 rounded-xl text-sm hover:bg-gray-50 transition">
                <i class="fas fa-plug mr-1"></i>测试连接
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: 用户管理 -->
      <div id="spanel-users" class="${tab!=='users'?'hidden':''}">
        <!-- 操作栏 -->
        <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div class="flex gap-2 flex-1 min-w-0">
            <div class="relative flex-1 max-w-xs">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input type="text" id="userSearchKw" placeholder="搜索姓名、账号、邮箱..."
                class="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                oninput="searchUsers()">
            </div>
            <select id="userFilterRole" class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchUsers()">
              <option value="">全部角色</option>
              <option value="admin">超级管理员</option>
              <option value="hr">HR招聘专员</option>
              <option value="interviewer">面试官</option>
              <option value="viewer">只读查看</option>
            </select>
            <select id="userFilterStatus" class="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="searchUsers()">
              <option value="">全部状态</option>
              <option value="active">已启用</option>
              <option value="disabled">已禁用</option>
            </select>
          </div>
          <button onclick="showUserFormModal(null)"
            class="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2 flex-shrink-0">
            <i class="fas fa-user-plus"></i>新增用户
          </button>
        </div>

        <!-- 用户列表表格 -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div id="userListContainer">
            <div class="text-center py-12 text-gray-400">
              <i class="fas fa-spinner fa-spin text-xl mb-2 block"></i>加载中...
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: 系统信息 -->
      <div id="spanel-system" class="${tab!=='system'?'hidden':''}">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-server text-blue-500"></i>系统信息
          </h3>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-gray-400 text-xs mb-1">系统版本</p>
              <p class="font-semibold text-gray-700">v1.0.0</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-gray-400 text-xs mb-1">运行环境</p>
              <p class="font-semibold text-gray-700">Cloudflare Workers</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-gray-400 text-xs mb-1">AI解析模型</p>
              <p class="font-semibold text-gray-700">GPT-4o (OpenAI)</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
              <p class="text-gray-400 text-xs mb-1">数据存储</p>
              <p class="font-semibold text-gray-700">内存存储（演示模式）</p>
            </div>
          </div>
        </div>
        <div class="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <h4 class="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <i class="fab fa-java text-blue-600 text-lg"></i>连接Java后端说明
          </h4>
          <p class="text-sm text-blue-700 mb-3">当前为演示模式。接入生产Java+MySQL后端：</p>
          <ol class="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>使用 migrations/001_initial_schema.sql 在MySQL中建表</li>
            <li>在Java Spring Boot中实现对应的REST API（同路径）</li>
            <li>修改 src/routes/ 中的接口调用地址到Java服务</li>
            <li>或直接在Java中提供完整前后端，本前端可独立使用</li>
          </ol>
        </div>
      </div>
    </div>
  `

  // 如果当前是用户管理 Tab，加载数据
  if (tab === 'users') loadAndRenderUsers()
}

function switchSettingsTab(tab) {
  ;['ai','users','system'].forEach(t => {
    document.getElementById('spanel-' + t)?.classList.toggle('hidden', t !== tab)
    const btn = document.getElementById('stab-' + t)
    if (!btn) return
    btn.className = t === tab
      ? 'px-5 py-2.5 text-sm font-medium rounded-xl transition bg-white shadow text-blue-600'
      : 'px-5 py-2.5 text-sm font-medium rounded-xl transition text-gray-500 hover:text-gray-700'
  })
  // 同步侧边栏子菜单高亮
  document.querySelectorAll('.sub-link').forEach(el => el.classList.remove('active'))
  document.getElementById('nav-settings-' + tab)?.classList.add('active')
  if (tab === 'users') loadAndRenderUsers()
}

// ==========================================
// 用户管理 —— 数据与渲染
// ==========================================
const userState = {
  list: [],
  total: 0,
  keyword: '',
  role: '',
  status: ''
}

const ROLE_CONFIG = {
  admin:       { label: '超级管理员', color: 'bg-red-100 text-red-700',    icon: 'fa-crown' },
  hr:          { label: 'HR招聘专员', color: 'bg-blue-100 text-blue-700',  icon: 'fa-user-tie' },
  interviewer: { label: '面试官',     color: 'bg-purple-100 text-purple-700', icon: 'fa-comments' },
  viewer:      { label: '只读查看',   color: 'bg-gray-100 text-gray-600',   icon: 'fa-eye' }
}

const AVATAR_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16']

function getUserAvatarColor(id) {
  return AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length]
}

function searchUsers() {
  userState.keyword = document.getElementById('userSearchKw')?.value || ''
  userState.role    = document.getElementById('userFilterRole')?.value || ''
  userState.status  = document.getElementById('userFilterStatus')?.value || ''
  loadAndRenderUsers()
}

async function loadAndRenderUsers() {
  const container = document.getElementById('userListContainer')
  if (!container) return

  const params = new URLSearchParams()
  if (userState.keyword) params.set('keyword', userState.keyword)
  if (userState.role)    params.set('role', userState.role)
  if (userState.status)  params.set('status', userState.status)
  params.set('pageSize', '50')

  const res = await apiRequest(`/api/users?${params}`)
  if (!res.success) { container.innerHTML = '<p class="text-center text-red-400 py-8">加载失败</p>'; return }

  userState.list  = res.data
  userState.total = res.total

  if (res.data.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 text-gray-400">
        <i class="fas fa-users text-4xl mb-3 block"></i>
        <p class="font-medium">暂无用户</p>
        <p class="text-sm mt-1">点击右上角"新增用户"添加账号</p>
      </div>`
    return
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/50">
            <th class="text-left py-3 px-5 font-medium text-gray-500 text-xs">用户</th>
            <th class="text-left py-3 px-4 font-medium text-gray-500 text-xs">联系方式</th>
            <th class="text-left py-3 px-4 font-medium text-gray-500 text-xs">角色</th>
            <th class="text-left py-3 px-4 font-medium text-gray-500 text-xs">部门</th>
            <th class="text-left py-3 px-4 font-medium text-gray-500 text-xs">状态</th>
            <th class="text-left py-3 px-4 font-medium text-gray-500 text-xs">创建时间</th>
            <th class="text-right py-3 px-5 font-medium text-gray-500 text-xs">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${res.data.map(u => renderUserRow(u)).join('')}
        </tbody>
      </table>
      <div class="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
        共 <strong class="text-gray-700">${res.total}</strong> 位用户
      </div>
    </div>
  `
}

function renderUserRow(u) {
  const role = ROLE_CONFIG[u.role] || { label: u.role, color: 'bg-gray-100 text-gray-600', icon: 'fa-user' }
  const isActive = u.status === 'active'
  const avatarColor = getUserAvatarColor(u.id)
  return `
    <tr class="hover:bg-gray-50/50 transition">
      <td class="py-3.5 px-5">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
               style="background:${avatarColor}">
            ${u.realName?.charAt(0) || u.username?.charAt(0) || '?'}
          </div>
          <div>
            <p class="font-semibold text-gray-800">${u.realName}</p>
            <p class="text-xs text-gray-400">@${u.username}</p>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4">
        <p class="text-gray-700">${u.email}</p>
        ${u.phone ? `<p class="text-xs text-gray-400 mt-0.5">${u.phone}</p>` : ''}
      </td>
      <td class="py-3.5 px-4">
        <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${role.color}">
          <i class="fas ${role.icon} text-xs"></i>${role.label}
        </span>
      </td>
      <td class="py-3.5 px-4 text-gray-600 text-sm">${u.department || '-'}</td>
      <td class="py-3.5 px-4">
        <span class="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
          <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}"></span>
          ${isActive ? '已启用' : '已禁用'}
        </span>
      </td>
      <td class="py-3.5 px-4 text-gray-400 text-xs">${formatDate(u.createdAt)}</td>
      <td class="py-3.5 px-5 text-right">
        <div class="flex items-center justify-end gap-1">
          <button onclick="showUserFormModal(${u.id})"
            class="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="编辑">
            <i class="fas fa-edit text-xs"></i>
          </button>
          <button onclick="toggleUserStatus(${u.id}, '${u.status}')"
            class="p-2 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition"
            title="${isActive ? '禁用' : '启用'}">
            <i class="fas ${isActive ? 'fa-ban' : 'fa-check-circle'} text-xs"></i>
          </button>
          ${u.id !== 1 ? `
          <button onclick="deleteUser(${u.id}, '${u.realName}')"
            class="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition" title="删除">
            <i class="fas fa-trash text-xs"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>
  `
}

// ==========================================
// 用户新增 / 编辑 弹窗
// ==========================================
async function showUserFormModal(userId) {
  let userData = null
  if (userId) {
    const res = await apiRequest(`/api/users/${userId}`)
    if (!res.success) { showToast('加载用户失败', 'error'); return }
    userData = res.data
  }
  const u = userData || {}
  const isEdit = !!userId

  document.getElementById('userFormModal')?.remove()
  const modal = document.createElement('div')
  modal.id = 'userFormModal'
  modal.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,0.55)'
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <i class="fas fa-user-${isEdit ? 'edit' : 'plus'} text-blue-600 text-sm"></i>
          </div>
          <h3 class="font-bold text-gray-800">${isEdit ? '编辑用户' : '新增用户'}</h3>
        </div>
        <button onclick="document.getElementById('userFormModal').remove()"
          class="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center transition">
          <i class="fas fa-times text-sm"></i>
        </button>
      </div>

      <!-- 表单 -->
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">真实姓名 <span class="text-red-500">*</span></label>
            <input id="uf-realName" type="text" value="${u.realName||''}" placeholder="如：张三"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">登录账号 <span class="text-red-500">*</span></label>
            <input id="uf-username" type="text" value="${u.username||''}" placeholder="如：hr_zhang"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              ${isEdit ? 'readonly style="background:#f9fafb;color:#6b7280"' : ''}>
            ${isEdit ? '<p class="text-xs text-gray-400 mt-1">登录账号不可修改</p>' : ''}
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">邮箱 <span class="text-red-500">*</span></label>
          <input id="uf-email" type="email" value="${u.email||''}" placeholder="example@company.com"
            class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">手机号</label>
            <input id="uf-phone" type="text" value="${u.phone||''}" placeholder="13800138000"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">所属部门</label>
            <input id="uf-department" type="text" value="${u.department||''}" placeholder="如：人力资源部"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">角色权限 <span class="text-red-500">*</span></label>
            <select id="uf-role" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="admin"       ${u.role==='admin'?'selected':''}>超级管理员</option>
              <option value="hr"          ${u.role==='hr'?'selected':''}>HR招聘专员</option>
              <option value="interviewer" ${u.role==='interviewer'?'selected':''}>面试官</option>
              <option value="viewer"      ${u.role==='viewer'?'selected':''}>只读查看</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">账号状态</label>
            <select id="uf-status" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active"   ${(u.status||'active')==='active'?'selected':''}>已启用</option>
              <option value="disabled" ${u.status==='disabled'?'selected':''}>已禁用</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">
            ${isEdit ? '新密码（留空则不修改）' : '登录密码 <span class="text-red-500">*</span>'}
          </label>
          <div class="relative">
            <input id="uf-password" type="password" placeholder="${isEdit ? '输入新密码（至少6位）' : '至少6位'}"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10">
            <button type="button" onclick="toggleUfPwd()" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i id="uf-eye" class="fas fa-eye text-sm"></i>
            </button>
          </div>
        </div>

        <!-- 角色说明 -->
        <div class="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
          <p><span class="font-medium text-red-600">超级管理员</span>：所有权限，含用户管理</p>
          <p><span class="font-medium text-blue-600">HR招聘专员</span>：增删改查候选人、导入简历、面试管理</p>
          <p><span class="font-medium text-purple-600">面试官</span>：查看候选人、添加面试记录和反馈</p>
          <p><span class="font-medium text-gray-600">只读查看</span>：仅查看候选人信息，不可修改</p>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
        <button onclick="document.getElementById('userFormModal').remove()"
          class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-white font-medium transition">
          取消
        </button>
        <button onclick="submitUserForm(${userId || 'null'})"
          class="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm hover:bg-blue-700 font-medium transition">
          <i class="fas fa-${isEdit ? 'save' : 'user-plus'} mr-1.5"></i>${isEdit ? '保存修改' : '创建用户'}
        </button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

function toggleUfPwd() {
  const inp = document.getElementById('uf-password')
  const icon = document.getElementById('uf-eye')
  if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash text-sm' }
  else { inp.type = 'password'; icon.className = 'fas fa-eye text-sm' }
}

async function submitUserForm(editId) {
  const realName   = document.getElementById('uf-realName')?.value?.trim()
  const username   = document.getElementById('uf-username')?.value?.trim()
  const email      = document.getElementById('uf-email')?.value?.trim()
  const phone      = document.getElementById('uf-phone')?.value?.trim()
  const department = document.getElementById('uf-department')?.value?.trim()
  const role       = document.getElementById('uf-role')?.value
  const status     = document.getElementById('uf-status')?.value
  const password   = document.getElementById('uf-password')?.value

  if (!realName) { showToast('请填写真实姓名', 'warning'); return }
  if (!username && editId === 'null') { showToast('请填写登录账号', 'warning'); return }
  if (!email)    { showToast('请填写邮箱', 'warning'); return }
  if (editId === 'null' && !password) { showToast('请设置登录密码', 'warning'); return }

  const payload = { realName, email, phone, department, role, status }
  if (editId === 'null') payload.username = username
  if (password) payload.password = password

  const isEdit = editId !== 'null'
  const url    = isEdit ? `/api/users/${editId}` : '/api/users'
  const method = isEdit ? 'PUT' : 'POST'

  const res = await apiRequest(url, { method, body: JSON.stringify(payload) })
  if (res.success) {
    showToast(isEdit ? '用户信息已更新' : '用户创建成功！', 'success')
    document.getElementById('userFormModal')?.remove()
    loadAndRenderUsers()
  } else {
    showToast(res.message || '操作失败', 'error')
  }
}

async function toggleUserStatus(userId, currentStatus) {
  const action = currentStatus === 'active' ? '禁用' : '启用'
  if (!confirm(`确定要${action}该用户吗？`)) return
  const res = await apiRequest(`/api/users/${userId}/status`, { method: 'PATCH' })
  if (res.success) { showToast(res.message, 'success'); loadAndRenderUsers() }
  else showToast(res.message || '操作失败', 'error')
}

async function deleteUser(userId, name) {
  if (!confirm(`确定要删除用户「${name}」吗？此操作不可恢复。`)) return
  const res = await apiRequest(`/api/users/${userId}`, { method: 'DELETE' })
  if (res.success) { showToast('用户已删除', 'success'); loadAndRenderUsers() }
  else showToast(res.message || '删除失败', 'error')
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

function normalizeApiBaseUrl(url) {
  // 仅去除末尾多余斜杠，不自动增加路径
  const u = (url || '').trim().replace(/\/+$/, '')
  return u || 'https://api.openai.com/v1'
}

function saveApiSettings() {
  state.openaiKey = document.getElementById('apiKeyInput').value.trim()
  state.openaiBaseUrl = normalizeApiBaseUrl(document.getElementById('apiBaseUrlInput').value)
  // 将规范化后的地址回填到输入框，让用户看到实际生效的地址
  document.getElementById('apiBaseUrlInput').value = state.openaiBaseUrl
  localStorage.setItem('openai_key', state.openaiKey)
  localStorage.setItem('openai_base_url', state.openaiBaseUrl)
  updateAiStatus()
  showToast('配置保存成功！', 'success')
}

async function testApiConnection() {
  const key = document.getElementById('apiKeyInput').value.trim()
  const baseUrl = normalizeApiBaseUrl(document.getElementById('apiBaseUrlInput').value)
  if (!key) { showToast('请先输入API Key', 'warning'); return }
  
  showToast('正在测试连接...', 'info')
  try {
    const res = await apiRequest('/api/upload/config', {
      method: 'POST',
      body: JSON.stringify({ openaiKey: key, openaiBaseUrl: baseUrl })
    })
    if (res.success) showToast('✅ ' + res.message, 'success')
    else showToast('❌ ' + res.message, 'error')
  } catch (e) {
    showToast('连接测试失败: ' + e.message, 'error')
  }
}

function updateAiStatus() {
  const dot = document.getElementById('aiStatusDot')
  const text = document.getElementById('aiStatusText')
  if (state.openaiKey) {
    dot.style.background = '#4ade80'
    text.style.color = '#86efac'
    text.textContent = 'AI就绪'
  } else {
    dot.style.background = '#9ca3af'
    text.style.color = '#d1d5db'
    text.textContent = '未配置'
  }
}

// ==========================================
// 请求拦截：自动添加API Key头 + JWT Token
// ==========================================
const originalFetch = window.fetch
window.fetch = function(url, options = {}) {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const token = getAuthToken()
    options.headers = options.headers || {}
    // 自动携带 JWT
    if (token && !options.headers['Authorization']) {
      options.headers['Authorization'] = 'Bearer ' + token
    }
    // 上传接口额外携带 OpenAI Key
    if (url.startsWith('/api/upload/') && state.openaiKey) {
      options.headers['X-OpenAI-Key'] = state.openaiKey
      options.headers['X-OpenAI-Base-URL'] = state.openaiBaseUrl
    }
  }
  return originalFetch(url, options)
}

// ==========================================
// 初始化（先验证登录状态）
// ==========================================
checkAuthAndInit()