'use strict';

/* ============================================================
   NOVA — app state, sessions, models, welcome, shell events
   ============================================================ */

const SUGGESTIONS = [
  {
    icon: 'code',
    title: 'ابنِ لي شيئًا',
    desc: 'صفحة، أداة، أو لعبة صغيرة داخل مساحة العمل',
    prompt: 'ابنِ لي صفحة هبوط أنيقة لمنتج خيالي، واكتبها كملف HTML كامل داخل مساحة العمل، ثم اعرض ملخصًا لما فعلته.'
  },
  {
    icon: 'search',
    title: 'افحص مشروعي',
    desc: 'اقرأ الملفات وأصلح الأخطاء',
    prompt: 'افحص ملفات مساحة العمل، لخّص بنية المشروع، ثم اقترح أهم 5 تحسينات مرتبة حسب الأولوية.'
  },
  {
    icon: 'list',
    title: 'خطّط لميزة',
    desc: 'حوّل الفكرة إلى خطة قابلة للتنفيذ',
    prompt: 'ساعدني في التخطيط لميزة جديدة. اسألني عن التفاصيل المهمة أولًا، ثم اعرض خطة قابلة للتنفيذ.'
  },
  {
    icon: 'terminal',
    title: 'نفّذ مهمة',
    desc: 'ملفات وأوامر على جهازك',
    prompt: 'راجع مساحة العمل ونظّم الملفات إن لزم، واعرض ما ستفعله قبل أي تعديل.'
  }
];

const state = {
  config: null,
  models: [],
  connected: false,
  baseUrl: '',
  model: localStorage.getItem('nova.model') || '',
  mode: localStorage.getItem('nova.mode') || 'ask',
  theme: localStorage.getItem('nova.theme') || 'dark',
  sessions: [],
  session: null,
  pending: null,
  streaming: false,
  controller: null,
  todos: [],
  activeAssistant: null,
  toolArgs: new Map(),
  lastUsage: null,
  pinned: true,
  slashIndex: 0,
  slashItems: [],
  keyCleared: false
};

let sessionsTimer = null;

async function init() {
  applyTheme(state.theme);
  bindShellEvents();
  bindChatEvents();
  bindSettingsEvents();
  autoResizeComposer();
  updateModeUI();
  updateHeader();
  updateSendButton();

  await Promise.allSettled([loadConfig(), loadModels(), loadSessions()]);

  if (!state.session) renderWelcome();
  updateConnectionUI();
  updateModelUI();
  updateWorkspaceUI();
  updateHeader();
  setStatus('جاهز', 'idle');
  scrollToBottom(true);
}

/* ---------------- Data loading ---------------- */
async function loadConfig() {
  try {
    const config = await api('GET', '/api/config');
    state.config = config;
    if (!localStorage.getItem('nova.mode')) state.mode = config.mode || 'ask';
    updateWorkspaceUI();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadModels() {
  try {
    const data = await api('GET', '/api/models');
    state.connected = !!data.connected;
    state.models = Array.isArray(data.models) ? data.models : [];
    state.baseUrl = data.baseUrl || (state.config && state.config.baseUrl) || '';

    const hasModel = state.models.some((m) => m.id === state.model);
    if (!hasModel && state.models.length) {
      const loaded = state.models.find((m) => m.state === 'loaded');
      state.model = (loaded || state.models[0]).id;
      localStorage.setItem('nova.model', state.model);
    }

    updateConnectionUI();
    updateModelUI();
    if ($('#welcome-connect')) updateWelcomeState();
  } catch (err) {
    state.connected = false;
    state.models = [];
    updateConnectionUI();
    updateModelUI();
  }
}

async function loadSessions() {
  try {
    const data = await api('GET', '/api/sessions');
    state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    renderSessions();
  } catch {
    // non-fatal
  }
}

function refreshSessionsSoon() {
  clearTimeout(sessionsTimer);
  sessionsTimer = setTimeout(() => loadSessions(), 650);
}

/* ---------------- Sidebar sessions ---------------- */
function renderSessions() {
  const wrap = $('#sessions');
  if (!wrap) return;

  const query = ($('#session-search')?.value || '').trim().toLowerCase();
  const sessions = state.sessions.filter((session) => !query || String(session.title || '').toLowerCase().includes(query));

  if (!sessions.length) {
    wrap.innerHTML = query
      ? '<div class="sessions-empty">ما لقينا محادثة بهذا الاسم.</div>'
      : '<div class="sessions-empty">لا توجد محادثات بعد.<br>ابدأ بسؤال أو مهمة.</div>';
    return;
  }

  wrap.innerHTML = sessions.map((session) => {
    const active = state.session && state.session.id === session.id ? ' active' : '';
    return `<div class="session-item${active}" data-id="${escapeHtml(session.id)}" tabindex="0" role="button">
      <span class="session-ico">${ICONS.message}</span>
      <span class="session-main">
        <span class="session-title">${escapeHtml(session.title || 'جلسة جديدة')}</span>
        <span class="session-time">${escapeHtml(relTime(session.updatedAt))}</span>
      </span>
      <button class="session-del" data-del="${escapeHtml(session.id)}" title="حذف المحادثة" aria-label="حذف المحادثة">${ICONS.trash}</button>
    </div>`;
  }).join('');
}

/* ---------------- Welcome ---------------- */
function renderWelcome() {
  const chat = $('#chat');
  if (!chat) return;

  chat.innerHTML = `<div class="welcome">
    <div class="welcome-orb">${LOGO}</div>
    <div class="welcome-kicker">LOCAL AGENT · BIONIC × LM STUDIO</div>
    <h1>${escapeHtml(greeting())}، ماذا نبني اليوم؟</h1>
    <p>أنا NOVA — وكيلك المحلي. أقرأ ملفاتك، أكتب الكود، أنفّذ المهام على جهازك، وأسألك عند الغموض. كل شيء يبقى على جهازك.</p>
    <div id="welcome-alert"></div>
    <div class="suggestions">
      ${SUGGESTIONS.map((item, index) => `<button type="button" class="suggestion" data-suggestion="${index}">
        <span class="suggestion-ico">${ICONS[item.icon] || ICONS.spark}</span>
        <span class="suggestion-body">
          <span class="suggestion-title">${escapeHtml(item.title)}</span>
          <span class="suggestion-desc">${escapeHtml(item.desc)}</span>
        </span>
        <svg class="suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
      </button>`).join('')}
    </div>
    <div class="welcome-connect" id="welcome-connect"></div>
  </div>`;

  updateWelcomeState();
}

function updateWelcomeState() {
  const connect = $('#welcome-connect');
  if (!connect) return;

  const dotClass = state.connected ? 'online' : 'offline';
  const modelText = state.connected
    ? (state.models.length ? `${state.models.length} نموذج متاح` : 'لا توجد نماذج')
    : 'غير متصل';

  const providerName = providerLabel();
  connect.innerHTML = `<span class="wc-pill"><span class="status-dot ${dotClass}"></span>${escapeHtml(modelText)}</span>
    <span class="wc-pill">${ICONS.spark} ${escapeHtml(providerName)}</span>
    <button type="button" data-welcome="settings">إعدادات الاتصال</button>`;

  const alert = $('#welcome-alert');
  if (!alert) return;

  if (!state.connected) {
    alert.innerHTML = `<div class="connect-alert">${ICONS.alert}<div><b>لم أجد مزوّد API.</b> تحقق من تشغيل الخدمة وعنوان API ومفتاحها في الإعدادات.
      <div style="margin-top:6px"><button type="button" class="link-btn" data-welcome="retry">إعادة المحاولة</button> · <button type="button" class="link-btn" data-welcome="settings">فتح الإعدادات</button></div></div></div>`;
  } else if (!state.models.length) {
    alert.innerHTML = `<div class="connect-alert">${ICONS.alert}<div><b>الخدمة متصلة لكن لا توجد نماذج.</b> تحقق أن مزوّد API يعرض نماذج متاحة، ثم أعد المحاولة.
      <div style="margin-top:6px"><button type="button" class="link-btn" data-welcome="retry">إعادة المحاولة</button></div></div></div>`;
  } else {
    alert.innerHTML = '';
  }
}

async function retryConnection() {
  await loadModels();
  updateWelcomeState();
  if (state.connected) {
    toast(`تم الاتصال — ${state.models.length} نموذج متاح.`, 'success');
  } else {
    toast('لم يتم العثور على مزوّد API بعد.', 'error');
  }
}

/* ---------------- Header / status ---------------- */
function updateHeader() {
  const title = (state.session && state.session.title) || 'جلسة جديدة';
  const el = $('#session-title');
  if (el) el.textContent = title;
  const exportButton = $('#export-chat');
  if (exportButton) exportButton.disabled = !state.session;
  document.title = `${title} — NOVA`;
}

function exportCurrentChat() {
  if (!state.session) return;
  const turns = $$('.msg-row', $('#chat')).map((row) => {
    if (row.classList.contains('user')) {
      const text = row.querySelector('.user-bubble')?.innerText.trim();
      return text ? `## أنت\n\n${text}` : '';
    }
    if (row.classList.contains('assistant')) {
      const text = row.querySelector('.md')?.innerText.trim();
      return text ? `## NOVA\n\n${text}` : '';
    }
    return '';
  }).filter(Boolean);
  if (!turns.length) {
    toast('لا توجد رسائل لتصديرها بعد.', 'info');
    return;
  }
  const content = `# ${state.session.title || 'محادثة NOVA'}\n\nتم التصدير في ${new Date().toLocaleString('ar')}\n\n${turns.join('\n\n---\n\n')}\n`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(state.session.title || 'nova-chat').replace(/[\\/:*?"<>|]/g, '-').slice(0, 70)}.md`;
  link.click();
  URL.revokeObjectURL(url);
  toast('تم تصدير المحادثة بصيغة Markdown.', 'success');
}

function setStatus(text, kind = 'idle') {
  const label = $('#agent-status');
  if (label) label.textContent = text;

  const dot = $('#agent-dot');
  if (!dot) return;
  dot.className = 'agent-dot';
  if (kind === 'working') dot.classList.add('working');
  if (kind === 'waiting') dot.classList.add('waiting');
  if (kind === 'error') dot.classList.add('error');
}

/* ---------------- Models UI ---------------- */
function updateModelUI() {
  const name = $('#model-name');
  if (name) name.textContent = state.model || 'اختر نموذجًا';

  const hint = $('#model-hint');
  if (hint) hint.textContent = state.connected ? providerLabel() : 'مزوّد API غير متصل';

  const popBase = $('#pop-base');
  if (popBase) popBase.textContent = state.baseUrl ? state.baseUrl.replace(/^https?:\/\//, '') : providerLabel();

  const count = $('#model-count');
  if (count) count.textContent = state.models.length ? `${state.models.length} نموذج` : '';

  if ($('#model-popover') && !$('#model-popover').hidden) renderModelList();
}

function providerLabel() {
  const labels = {
    lmstudio: 'LM Studio', freellmapi: 'FreeLLMAPI', openai: 'OpenAI', openrouter: 'OpenRouter',
    groq: 'Groq', gemini: 'Google Gemini', ollama: 'Ollama', 'openai-compatible': 'OpenAI-compatible API'
  };
  return labels[(state.config && state.config.provider) || 'lmstudio'] || 'OpenAI-compatible API';
}

function renderModelList() {
  const list = $('#model-list');
  if (!list) return;

  const query = ($('#model-search').value || '').trim().toLowerCase();
  const models = state.models.filter((m) => !query || m.id.toLowerCase().includes(query));

  if (!models.length) {
    list.innerHTML = `<div class="model-empty">${state.connected
      ? 'لا توجد نماذج مطابقة.'
      : 'تحقق من عنوان API ومفتاح الوصول وحالة الخدمة.'}</div>`;
    return;
  }

  list.innerHTML = models.map((model) => {
    const active = model.id === state.model ? ' active' : '';
    const loaded = model.state === 'loaded';
    const stateBadge = model.state
      ? `<span class="model-badge ${loaded ? '' : 'off'}">${loaded ? 'محمّل' : 'غير محمّل'}</span>`
      : '';
    const meta = [model.publisher, model.arch, model.context ? `${model.context} ctx` : '']
      .filter(Boolean)
      .join(' · ');

    return `<button type="button" class="model-item${active}" data-model="${escapeHtml(model.id)}">
      <span class="m-orb"></span>
      <span class="m-main">
        <span class="m-id">${escapeHtml(model.id)}</span>
        ${meta ? `<span class="m-meta">${escapeHtml(meta)}</span>` : ''}
      </span>
      ${stateBadge}
    </button>`;
  }).join('');

  $$('.model-item', list).forEach((item) => {
    item.addEventListener('click', () => {
      setModel(item.dataset.model);
      closeModelPopover();
    });
  });
}

function updateConnectionUI() {
  const dot = $('#conn-dot');
  const text = $('#conn-text');
  if (dot) dot.className = 'status-dot ' + (state.connected ? 'online' : 'offline');
  if (text) {
    text.textContent = state.connected
      ? (state.models.length ? `متصل · ${state.models.length} نموذج` : 'متصل · لا نماذج')
      : 'غير متصل بمزوّد API';
  }
  const popBase = $('#pop-base');
  if (popBase) popBase.textContent = state.baseUrl ? state.baseUrl.replace(/^https?:\/\//, '') : providerLabel();
}

function updateWorkspaceUI() {
  const workspace = (state.config && state.config.workspace) || '';
  const pathEl = $('#workspace-path');
  if (pathEl) pathEl.textContent = workspace || '—';
  const wsLabel = $('#ws-label');
  if (wsLabel) wsLabel.textContent = workspace ? basename(workspace) : 'workspace';
}

async function setModel(id) {
  if (!id) return;
  state.model = id;
  localStorage.setItem('nova.model', id);
  updateModelUI();

  if (state.session) {
    try {
      const data = await api('PATCH', `/api/sessions/${state.session.id}`, { model: id });
      state.session.model = data.session.model;
    } catch (err) {
      toast(err.message, 'error');
    }
  }
}

function openModelPopover() {
  const pop = $('#model-popover');
  if (!pop) return;
  pop.hidden = false;
  $('#model-search').value = '';
  renderModelList();
  updateModelUI();
  setTimeout(() => $('#model-search').focus(), 40);
}

function closeModelPopover() {
  const pop = $('#model-popover');
  if (pop) pop.hidden = true;
}

/* ---------------- Session lifecycle ---------------- */
async function ensureSession() {
  if (state.session) return state.session;

  const model = state.model;
  if (!model) {
    openModelPopover();
    throw new Error('اختر نموذجًا محليًا أولًا من قائمة النماذج.');
  }

  const data = await api('POST', '/api/sessions', { model, mode: state.mode });
  state.session = data.session;
  state.todos = [];
  clearPlan();
  updateHeader();
  refreshSessionsSoon();
  return state.session;
}

async function newChat() {
  if (state.streaming) await stopStreaming();

  state.session = null;
  state.pending = null;
  state.todos = [];
  state.activeAssistant = null;
  state.toolArgs.clear();
  clearPlan();
  updateHeader();
  setStatus('جاهز', 'idle');
  $('#chat').innerHTML = '';
  renderWelcome();
  renderSessions();
  updateSendButton();
  closeSidebar();
}

async function openSession(id) {
  if (state.streaming) {
    toast('أوقف التنفيذ الحالي أولًا.', 'info');
    return;
  }

  try {
    const data = await api('GET', `/api/sessions/${id}`);
    state.session = data.session;
    state.pending = data.pending || null;
    state.model = data.session.model || state.model;
    state.mode = data.session.mode || 'ask';
    state.todos = [];
    state.activeAssistant = null;
    state.toolArgs.clear();

    localStorage.setItem('nova.model', state.model);
    localStorage.setItem('nova.mode', state.mode);

    updateModeUI();
    updateModelUI();
    updateHeader();
    updateSendButton();
    clearPlan();

    renderTranscript(data.session.transcript || [], data.pending);
    setStatus(state.pending ? 'بانتظار ردك' : 'جاهز', state.pending ? 'waiting' : 'idle');

    renderSessions();
    closeSidebar();
    scrollToBottom(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteSession(id) {
  if (!id) return;
  const session = state.sessions.find((item) => item.id === id);
  const ok = await confirmAction({
    title: 'حذف المحادثة',
    message: `سيتم حذف «${session ? session.title : 'هذه المحادثة'}» نهائيًا، مع سجل الأدوات والملفات المرتبطة بها في الواجهة.`,
    okText: 'حذف',
    danger: true
  });
  if (!ok) return;

  try {
    await api('DELETE', `/api/sessions/${id}`);
    if (state.session && state.session.id === id) {
      await newChat();
    }
    await loadSessions();
    toast('تم حذف المحادثة.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteCurrentSession() {
  if (!state.session) {
    toast('لا توجد محادثة محفوظة بعد.', 'info');
    return;
  }
  await deleteSession(state.session.id);
}

/* ---------------- Scrolling ---------------- */
function scrollToBottom(force = false) {
  const scroller = $('#chat-scroll');
  if (!scroller) return;
  if (force || state.pinned) scroller.scrollTop = scroller.scrollHeight;
}

function updateJumpButton() {
  const scroller = $('#chat-scroll');
  const jump = $('#jump-bottom');
  if (!scroller || !jump) return;
  const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  const atBottom = distance < 90;
  state.pinned = atBottom;
  jump.hidden = atBottom;
}

/* ---------------- Sidebar ---------------- */
function openSidebar() {
  $('#sidebar').classList.add('open');
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  document.body.classList.remove('sidebar-open');
}

/* ---------------- Shell events ---------------- */
function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

function bindShellEvents() {
  $('#export-chat').addEventListener('click', exportCurrentChat);
  $('#new-chat').addEventListener('click', newChat);
  $('#refresh-sessions').addEventListener('click', async () => {
    await loadSessions();
    toast('تم تحديث المحادثات.', 'info', 1800);
  });

  $('#workspace-card').addEventListener('click', openSettings);
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-btn-2').addEventListener('click', openSettings);

  $('#theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    state.theme = next;
    applyTheme(next);
  });

  $('#model-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    if ($('#model-popover').hidden) openModelPopover();
    else closeModelPopover();
  });

  $('#refresh-models').addEventListener('click', async (event) => {
    event.stopPropagation();
    await loadModels();
    renderModelList();
    toast(state.connected ? 'تم تحديث النماذج.' : 'لم يتم العثور على مزوّد API.', state.connected ? 'success' : 'error');
  });

  $('#model-search').addEventListener('input', renderModelList);
  $('#model-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = $('#model-list .model-item');
      if (first) {
        setModel(first.dataset.model);
        closeModelPopover();
      }
    }
  });

  $('#model-settings').addEventListener('click', () => {
    closeModelPopover();
    openSettings();
  });

  $('#menu-btn').addEventListener('click', openSidebar);
  $('#close-sidebar').addEventListener('click', closeSidebar);

  $('#sessions').addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('[data-del]');
    if (deleteBtn) {
      event.stopPropagation();
      deleteSession(deleteBtn.dataset.del);
      return;
    }
    const item = event.target.closest('.session-item');
    if (item) openSession(item.dataset.id);
  });

  $('#sessions').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const item = event.target.closest('.session-item');
    if (item) openSession(item.dataset.id);
  });

  $('#chat').addEventListener('click', (event) => {
    const suggestion = event.target.closest('[data-suggestion]');
    if (suggestion) {
      const item = SUGGESTIONS[Number(suggestion.dataset.suggestion)];
      if (item) sendMessage(item.prompt);
      return;
    }

    const welcomeAction = event.target.closest('[data-welcome]');
    if (welcomeAction) {
      const action = welcomeAction.dataset.welcome;
      if (action === 'settings') openSettings();
      if (action === 'retry') retryConnection();
    }
  });

  $('#chat-scroll').addEventListener('scroll', updateJumpButton);
  $('#jump-bottom').addEventListener('click', () => {
    state.pinned = true;
    scrollToBottom(true);
    updateJumpButton();
  });

  document.addEventListener('click', (event) => {
    const modelPop = $('#model-popover');
    if (!modelPop.hidden && !modelPop.contains(event.target) && !$('#model-btn').contains(event.target)) {
      closeModelPopover();
    }

    const modePop = $('#mode-popover');
    if (!modePop.hidden && !modePop.contains(event.target) && !$('#mode-chip').contains(event.target)) {
      hideModeMenu();
    }

    if (document.body.classList.contains('sidebar-open') &&
        !$('#sidebar').contains(event.target) &&
        !$('#menu-btn').contains(event.target)) {
      closeSidebar();
    }
  });

  document.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (event.shiftKey) openModelPopover();
      else newChat();
      return;
    }

    if (event.key === 'Escape') {
      if (!$('#settings-modal').hidden) { closeSettings(); return; }
      if (!$('#confirm-modal').hidden) { resolveConfirm(false); return; }
      if (!$('#model-popover').hidden) { closeModelPopover(); return; }
      if (!$('#mode-popover').hidden) { hideModeMenu(); return; }
      if (!$('#slash-menu').hidden) { hideSlashMenu(); return; }
      if (state.streaming) { stopStreaming(); return; }
    }

    if (state.pending && state.pending.kind === 'question' && !state.streaming && !isTypingTarget(event.target)) {
      const number = parseInt(event.key, 10);
      if (number >= 1 && number <= 9) {
        const card = findQuestionCard(state.pending.toolCallId);
        const options = card ? card.querySelectorAll('.q-option') : [];
        if (options[number - 1]) {
          event.preventDefault();
          options[number - 1].click();
        }
      }
    }
  });
}
