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
    key.placeholder = config.hasKey
      ? 'مفتاح محفوظ — اكتب مفتاحًا جديدًا للتغيير'
      : 'اتركه فارغًا إن لم تستخدم مفتاحًا';
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
  updateModeUI();
}

async function openSettings() {
  try {
    state.config = await api('GET', '/api/config');
  } catch {
    // use the cached config
  }

  fillSettingsForm();

  const modal = $('#settings-modal');
  if (!modal) return;
  modal.hidden = false;

  setTimeout(() => {
    const base = $('#set-base');
    if (base) base.focus();
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
        ? `متصل — ${count} نموذج متاح.`
        : 'متصل، لكن لا توجد نماذج محمّلة.';
    } else {
      result.classList.add('bad');
      result.textContent = data.error || 'تعذّر الاتصال بالخادم.';
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
  });
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
}
