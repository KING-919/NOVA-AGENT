'use strict';

/* ============================================================
   NOVA — settings, connection, run mode
   ============================================================ */

const MODE_INFO = {
  ask: {
    label: 'اسأل قبل التنفيذ',
    hint: 'موافقتك مطلوبة للكتابة والأوامر',
    toast: 'سأسألك قبل تعديل الملفات أو تنفيذ الأوامر.'
  },
  auto: {
    label: 'تنفيذ تلقائي',
    hint: 'كتابة الملفات تلقائيًا، والأوامر بموافقة',
    toast: 'سأكتب الملفات تلقائيًا، وأطلب موافقتك لأوامر النظام.'
  },
  plan: {
    label: 'تخطيط فقط',
    hint: 'يفحص ويقترح دون تعديل أو تنفيذ',
    toast: 'سأفحص وأقترح خطة دون تعديل الملفات أو تنفيذ الأوامر.'
  }
};

function updateModeUI() {
  const info = MODE_INFO[state.mode] || MODE_INFO.ask;

  const label = $('#mode-label');
  if (label) label.textContent = info.label;

  const chip = $('#mode-chip');
  if (chip) chip.title = `وضع التشغيل: ${info.label} — ${info.hint}`;

  $$('#mode-popover .mode-option').forEach((option) => {
    option.classList.toggle('active', option.dataset.mode === state.mode);
  });
}

function hideModeMenu() {
  const pop = $('#mode-popover');
  if (pop) pop.hidden = true;
}

function openModeMenu() {
  const pop = $('#mode-popover');
  if (!pop) return;
  pop.hidden = false;
  updateModeUI();
}

async function setMode(mode) {
  if (!MODE_INFO[mode]) return;

  state.mode = mode;
  localStorage.setItem('nova.mode', mode);
  updateModeUI();
  hideModeMenu();

  if (state.session) {
    try {
      const data = await api('PATCH', `/api/sessions/${state.session.id}`, { mode });
      state.session.mode = data.session.mode;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  toast(MODE_INFO[mode].toast, 'info', 3000);
}

/* ---------------- Settings modal ---------------- */

const PROVIDER_LABELS = {
  lmstudio: 'LM Studio',
  freellmapi: 'FreeLLMAPI',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI-compatible'
};

function setSettingsTab(name = 'connection') {
  const tab = typeof name === 'string' ? name : 'connection';
  $$('.settings-tab').forEach((button) => {
    const active = button.dataset.settingsTab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('[data-settings-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== tab;
  });
}

function updateSettingsSummary() {
  const provider = $('#set-provider');
  const providerName = PROVIDER_LABELS[(provider && provider.value) || (state.config && state.config.provider)] || 'مزوّد مخصص';
  const label = $('#settings-provider-name');
  if (label) label.textContent = providerName;

  const dot = $('#settings-status-dot');
  if (dot) dot.className = 'status-dot ' + (state.connected ? 'online' : 'offline');

  const title = $('#settings-status-text');
  const meta = $('#settings-status-meta');
  if (title) {
    title.textContent = state.connected
      ? (state.models.length ? 'متصل وجاهز للعمل' : 'متصل، لكن لا توجد نماذج')
      : 'غير متصل بمزوّد';
  }
  if (meta) {
    meta.textContent = state.connected
      ? `${modelsPhrase(state.models.length, 'متاح')} · ${providerName}`
      : 'شغّل نموذجًا محليًا أو أضف عنوان API ومفتاحًا ثم اختبر الاتصال';
  }
}

function fillSettingsForm() {
  const config = state.config || {};

  const provider = $('#set-provider');
  if (provider) provider.value = config.provider || 'lmstudio';

  const base = $('#set-base');
  if (base) base.value = config.baseUrl || '';
  updateProviderHint();

  const key = $('#set-key');
  if (key) {
    key.value = '';
    key.type = 'password';
    key.placeholder = config.hasKey
      ? 'مفتاح محفوظ — اكتب مفتاحًا جديدًا للتغيير'
      : 'اتركه فارغًا إن لم تستخدم مفتاحًا';
  }
  const keyToggle = $('#toggle-key');
  if (keyToggle) {
    keyToggle.classList.remove('active');
    keyToggle.title = 'إظهار المفتاح';
    keyToggle.setAttribute('aria-label', 'إظهار مفتاح API');
  }

  const workspace = $('#set-workspace');
  if (workspace) workspace.value = config.workspace || '';

  const outside = $('#set-outside');
  if (outside) outside.checked = !!config.allowOutsideWorkspace;

  const temp = $('#set-temp');
  if (temp) temp.value = config.temperature != null ? config.temperature : 0.7;

  const tempVal = $('#temp-val');
  if (tempVal) tempVal.textContent = Number(temp ? temp.value : 0.7).toFixed(1);

  const steps = $('#set-steps');
  if (steps) steps.value = config.maxSteps || 30;

  const timeout = $('#set-timeout');
  if (timeout) timeout.value = Math.round((config.shellTimeoutMs || 90000) / 1000);

  const autoshell = $('#set-autoshell');
  if (autoshell) autoshell.checked = !!config.autoShell;

  const result = $('#test-result');
  if (result) {
    result.textContent = '';
    result.className = 'test-result';
  }

  state.keyCleared = false;
  updateSettingsSummary();
  updateModeUI();
}

async function openSettings(tab = 'connection') {
  try {
    state.config = await api('GET', '/api/config');
  } catch {
    // use the cached config
  }

  fillSettingsForm();

  const modal = $('#settings-modal');
  if (!modal) return;
  setSettingsTab(tab);
  modal.hidden = false;

  setTimeout(() => {
    const target = tab === 'connection' ? $('#set-base') : null;
    if (target) target.focus();
  }, 60);
}

function closeSettings() {
  const modal = $('#settings-modal');
  if (modal) modal.hidden = true;
  state.keyCleared = false;
}

async function saveSettings() {
  const button = $('#save-settings');
  if (!button) return;

  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'جارٍ الحفظ…';

  try {
    const patch = {
      provider: $('#set-provider').value,
      baseUrl: ($('#set-base').value || '').trim(),
      workspace: ($('#set-workspace').value || '').trim(),
      temperature: Number($('#set-temp').value),
      maxSteps: Number($('#set-steps').value),
      shellTimeoutMs: Math.round(Number($('#set-timeout').value) * 1000),
      allowOutsideWorkspace: $('#set-outside').checked,
      autoShell: $('#set-autoshell').checked
    };

    if (state.keyCleared) {
      patch.apiKey = '';
    } else {
      const typedKey = ($('#set-key').value || '').trim();
      if (typedKey) patch.apiKey = typedKey;
    }

    state.config = await api('POST', '/api/config', patch);
    updateWorkspaceUI();
    updateModeUI();
    closeSettings();
    toast('تم حفظ الإعدادات.', 'success');

    await loadModels();
    if ($('#welcome-connect')) updateWelcomeState();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function testConnection() {
  const button = $('#test-conn');
  const result = $('#test-result');
  if (!button || !result) return;

  const original = button.textContent;
  button.disabled = true;
  result.className = 'test-result';
  result.textContent = 'جارٍ الاختبار…';

  try {
    const payload = {
      baseUrl: ($('#set-base').value || '').trim(),
      provider: $('#set-provider').value
    };

    if (state.keyCleared) {
      payload.apiKey = '';
    } else {
      const typedKey = ($('#set-key').value || '').trim();
      if (typedKey) payload.apiKey = typedKey;
    }

    const data = await api('POST', '/api/test-connection', payload);

    if (data.ok) {
      const count = Number(data.count) || 0;
      result.classList.add('ok');
      result.textContent = count
        ? `متصل — ${modelsPhrase(count, 'متاح')}.`
        : 'متصل، لكن لا توجد نماذج محمّلة.';
      const dot = $('#settings-status-dot');
      if (dot) dot.className = 'status-dot online';
      const title = $('#settings-status-text');
      if (title) title.textContent = count ? 'متصل وجاهز للعمل' : 'متصل، لكن لا توجد نماذج';
      const meta = $('#settings-status-meta');
      if (meta) meta.textContent = count ? `${modelsPhrase(count, 'متاح')} · ${PROVIDER_LABELS[payload.provider] || 'مزوّد مخصص'}` : 'حمّل نموذجًا من المزوّد ثم أعد الاختبار';
    } else {
      result.classList.add('bad');
      result.textContent = data.error || 'تعذّر الاتصال بالخادم.';
      const dot = $('#settings-status-dot');
      if (dot) dot.className = 'status-dot offline';
      const title = $('#settings-status-text');
      if (title) title.textContent = 'تعذّر الاتصال';
    }
  } catch (err) {
    result.classList.add('bad');
    result.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function bindSettingsEvents() {
  const provider = $('#set-provider');
  if (provider) provider.addEventListener('change', () => {
    const base = $('#set-base');
    const defaults = {
      lmstudio: 'http://127.0.0.1:1234/v1',
      freellmapi: 'http://localhost:3001/v1',
      openai: 'https://api.openai.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      groq: 'https://api.groq.com/openai/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
      ollama: 'http://127.0.0.1:11434/v1',
      'openai-compatible': ''
    };
    if (provider.value !== 'openai-compatible') base.value = defaults[provider.value] || '';
    updateProviderHint();
    updateSettingsSummary();
  });

  $$('.settings-tab').forEach((button) => {
    button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab));
  });

  const keyToggle = $('#toggle-key');
  if (keyToggle) {
    keyToggle.addEventListener('click', () => {
      const key = $('#set-key');
      if (!key) return;
      const show = key.type === 'password';
      key.type = show ? 'text' : 'password';
      keyToggle.classList.toggle('active', show);
      keyToggle.title = show ? 'إخفاء المفتاح' : 'إظهار المفتاح';
      keyToggle.setAttribute('aria-label', show ? 'إخفاء مفتاح API' : 'إظهار مفتاح API');
    });
  }

  const openWorkspace = $('#open-workspace-from-settings');
  if (openWorkspace) {
    openWorkspace.addEventListener('click', () => {
      closeSettings();
      toggleWorkspace(true);
    });
  }

  const modeChip = $('#mode-chip');
  if (modeChip) {
    modeChip.addEventListener('click', (event) => {
      event.stopPropagation();
      const pop = $('#mode-popover');
      if (!pop) return;
      if (pop.hidden) openModeMenu();
      else hideModeMenu();
    });
  }

  $$('#mode-popover .mode-option').forEach((option) => {
    option.addEventListener('click', () => setMode(option.dataset.mode));
  });

  const save = $('#save-settings');
  if (save) save.addEventListener('click', saveSettings);

  const cancel = $('#cancel-settings');
  if (cancel) cancel.addEventListener('click', closeSettings);

  const close = $('#close-settings');
  if (close) close.addEventListener('click', closeSettings);

  const modal = $('#settings-modal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeSettings();
    });
  }

  const test = $('#test-conn');
  if (test) test.addEventListener('click', testConnection);

  const temp = $('#set-temp');
  if (temp) {
    temp.addEventListener('input', () => {
      const label = $('#temp-val');
      if (label) label.textContent = Number(temp.value).toFixed(1);
    });
  }

  const clearKey = $('#clear-key');
  if (clearKey) {
    clearKey.addEventListener('click', () => {
      const key = $('#set-key');
      if (key) {
        key.value = '';
        key.placeholder = 'سيُمسح المفتاح المحفوظ عند الحفظ';
      }
      state.keyCleared = true;
    });
  }
}

function updateProviderHint() {
  const provider = $('#set-provider');
  const hint = $('#provider-hint');
  if (!provider || !hint) return;
  const hints = {
    lmstudio: 'شغّل خادم LM Studio المحلي، ثم أدخل العنوان والمفتاح إن لزم. تُجلب قائمة النماذج تلقائيًا.',
    freellmapi: 'أدخل مفتاح FreeLLMAPI الموحد. تستخدم البوابة واجهة OpenAI المتوافقة وتعرض النماذج عبر API.',
    openai: 'أدخل مفتاح OpenAI صالحًا. اختر نموذجًا يدعم الأدوات؛ توفر النماذج والميزات يعتمد على حسابك.',
    openrouter: 'أدخل مفتاح OpenRouter واختر model ID كما يظهر في كتالوجهم. يدعم endpoint المتوافق البث والأدوات حسب النموذج.',
    groq: 'أدخل مفتاح Groq واختر model ID متاحًا لحسابك. دعم الأدوات يختلف بحسب النموذج.',
    gemini: 'أدخل مفتاح Google AI Studio. تستخدم هذه الوصلة نمط OpenAI المتوافق في Gemini API؛ اختر نموذجًا يدعم الأدوات.',
    ollama: 'شغّل Ollama محليًا واسحب نموذجًا يدعم الأدوات. العنوان الافتراضي هو 11434 ولا يحتاج مفتاحًا عادةً.',
    'openai-compatible': 'يدعم أي خدمة توفّر واجهة OpenAI متوافقة مع /v1/models و/v1/chat/completions، مع بث واستدعاء أدوات. أدخل عنوان API ومفتاحه.'
  };
  hint.textContent = hints[provider.value] || hints['openai-compatible'];

  const baseHint = $('#base-hint');
  if (baseHint) {
    const examples = {
      lmstudio: 'http://127.0.0.1:1234/v1',
      ollama: 'http://127.0.0.1:11434/v1',
      openai: 'https://api.openai.com/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      groq: 'https://api.groq.com/openai/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
      freellmapi: 'http://localhost:3001/v1',
      'openai-compatible': 'https://api.example.com/v1'
    };
    baseHint.textContent = `مثال: ${examples[provider.value] || examples['openai-compatible']}`;
  }
}
