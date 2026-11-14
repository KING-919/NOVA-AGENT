'use strict';

/* ============================================================
   NOVA — tool cards, approvals, questions, plan, transcript
   ============================================================ */

const TOOL_META = {
  ask_user: { label: 'سؤال توضيحي', icon: 'help' },
  update_todos: { label: 'تحديث الخطة', icon: 'list' },
  list_files: { label: 'استعراض الملفات', icon: 'folder' },
  read_file: { label: 'قراءة ملف', icon: 'file' },
  write_file: { label: 'كتابة ملف', icon: 'edit' },
  search_text: { label: 'بحث في الملفات', icon: 'search' },
  run_shell: { label: 'تنفيذ أمر', icon: 'terminal' },
  fetch_url: { label: 'جلب صفحة', icon: 'globe' }
};

function toolInfo(name, args = {}) {
  const meta = TOOL_META[name] || { label: name || 'أداة', icon: 'tool' };
  let sub = '';

  switch (name) {
    case 'run_shell':
      sub = args.command || '';
      break;
    case 'read_file':
    case 'write_file':
      sub = args.path || '';
      break;
    case 'list_files':
      sub = args.path || '.';
      break;
    case 'search_text':
      sub = [args.query, args.include].filter(Boolean).join(' · ');
      break;
    case 'fetch_url':
      sub = args.url || '';
      break;
    case 'ask_user':
      sub = args.question || '';
      break;
    case 'update_todos':
      sub = `${Array.isArray(args.todos) ? args.todos.length : 0} مهام`;
      break;
    default:
      sub = '';
  }

  return { ...meta, sub: String(sub || ''), args };
}

function statusContent(status) {
  switch (status) {
    case 'running': return '<span class="spin"></span> قيد التنفيذ';
    case 'waiting_approval': return 'بانتظار الموافقة';
    case 'success': return 'تم';
    case 'error': return 'فشل';
    case 'denied': return 'مرفوض';
    case 'expired': return 'منتهية';
    default: return 'ملغى';
  }
}

function formatToolOutput(name, args, result) {
  const parsed = tryParse(result);
  const notes = [];
  let output = '';

  if (parsed && typeof parsed === 'object') {
    if (name === 'read_file') {
      notes.push(`<b>${escapeHtml(parsed.path || args.path || '')}</b> · ${parsed.lines || 0} سطر`);
      output = parsed.content || '';
    } else if (name === 'write_file') {
      notes.push(`${parsed.created ? 'أُنشئ' : 'حُدّث'} <b>${escapeHtml(parsed.path || args.path || '')}</b> · ${formatBytes(parsed.bytes)}`);
      if (parsed.backup) notes.push(`نسخة احتياطية: <span dir="ltr">${escapeHtml(parsed.backup)}</span>`);
    } else if (name === 'list_files') {
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      notes.push(`<b>${escapeHtml(parsed.root || args.path || '.')}</b> · ${entries.length} عنصر${parsed.truncated ? ' (مختصر)' : ''}`);
      output = entries.map((entry) => entry.type === 'dir' ? entry.path : `${entry.path}  ${formatBytes(entry.size)}`).join('\n');
    } else if (name === 'search_text') {
      const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
      notes.push(`<b>${escapeHtml(parsed.query || args.query || '')}</b> · ${matches.length} نتيجة${parsed.truncated ? ' (مختصر)' : ''}`);
      output = matches.map((match) => `${match.file}:${match.line}  ${match.text}`).join('\n');
    } else if (name === 'run_shell') {
      notes.push(`exit ${parsed.exitCode == null ? '؟' : parsed.exitCode}${parsed.timedOut ? ' · انتهت المهلة' : ''}`);
      output = [parsed.stdout, parsed.stderr ? `[stderr]\n${parsed.stderr}` : ''].filter(Boolean).join('\n\n');
    } else if (name === 'fetch_url') {
      notes.push(`${parsed.title ? `<b>${escapeHtml(parsed.title)}</b> · ` : ''}<span dir="ltr">${escapeHtml(parsed.url || args.url || '')}</span>`);
      output = parsed.content || '';
    } else {
      output = JSON.stringify(parsed, null, 2);
    }
  } else {
    output = String(result == null ? '' : result);
  }

  if (!output && parsed && parsed.ok === false && parsed.error) {
    output = String(parsed.error);
  }

  return { note: notes.join(' · '), output };
}

function diffHtml(lines) {
  if (!Array.isArray(lines) || !lines.length) return '';
  return `<div class="diff">${lines.map((line) => {
    const prefix = line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  ';
    return `<div class="diff-line ${line.type}">${escapeHtml(prefix + line.text)}</div>`;
  }).join('')}</div>`;
}

function findToolCard(id) {
  return $$('.tool-card', $('#chat')).find((card) => card.dataset.id === id) || null;
}

function buildToolCard(ev) {
  const info = toolInfo(ev.name, ev.args);
  const status = ev.status || 'running';
  const formatted = formatToolOutput(ev.name, ev.args, ev.result);

  const card = document.createElement('div');
  card.className = 'tool-card';
  card.dataset.id = ev.id;
  card.dataset.tool = ev.name || 'tool';
  card.classList.toggle('open', status === 'error' || (ev.name === 'run_shell' && status === 'success'));

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'tool-head';
  head.innerHTML = `<span class="tool-ico">${ICONS[info.icon] || ICONS.tool}</span>
    <span class="tool-main">
      <span class="tool-title">${escapeHtml(info.label)}</span>
      <span class="tool-sub" dir="ltr">${escapeHtml(info.sub)}</span>
    </span>
    <span class="tool-status ${status}">${statusContent(status)}</span>
    ${ICONS.chevronDown}`;
  head.addEventListener('click', () => card.classList.toggle('open'));
  card.appendChild(head);

  const body = document.createElement('div');
  body.className = 'tool-body';
  const inner = document.createElement('div');
  inner.className = 'tool-body-inner';

  if (formatted.note) {
    const note = document.createElement('div');
    note.className = 'tool-note';
    note.innerHTML = formatted.note;
    inner.appendChild(note);
  }

  if (ev.name === 'run_shell') {
    const terminal = document.createElement('div');
    terminal.className = 'terminal';
    terminal.innerHTML = `<div class="terminal-head"><i></i><i></i><i></i><span>shell</span></div><pre></pre>`;
    const pre = terminal.querySelector('pre');
    pre.textContent = `$ ${(ev.args && ev.args.command) || ''}\n\n${formatted.output || '(لا يوجد ناتج)'}`;
    inner.appendChild(terminal);
  } else if (formatted.output) {
    const pre = document.createElement('pre');
    pre.className = 'tool-output';
    pre.dir = 'ltr';
    pre.textContent = formatted.output;
    inner.appendChild(pre);
  }

  if (!inner.childNodes.length) {
    const note = document.createElement('div');
    note.className = 'tool-note';
    note.textContent = status === 'expired'
      ? 'انتهت صلاحية هذه الخطوة قبل تنفيذها.'
      : 'لا يوجد ناتج للعرض.';
    inner.appendChild(note);
  }

  body.appendChild(inner);
  card.appendChild(body);
  return card;
}

function upsertToolCard(ev, options = {}) {
  const existing = findToolCard(ev.id);
  const wasOpen = existing ? existing.classList.contains('open') : false;
  state.toolArgs.set(ev.id, ev.args || state.toolArgs.get(ev.id) || {});

  const card = buildToolCard(ev);
  if (wasOpen || options.open) card.classList.add('open');

  if (existing) existing.replaceWith(card);
  else $('#chat').appendChild(card);

  scrollIfPinned();
  return card;
}

/* ---------------- Approvals ---------------- */
function removeApprovalCard(id) {
  const card = $$('.approval-card', $('#chat')).find((el) => el.dataset.id === id);
  if (card) card.remove();
}

function buildApprovalCard(ev) {
  const isShell = ev.kind === 'shell';
  const card = document.createElement('div');
  card.className = 'approval-card';
  card.dataset.id = ev.id;
  card.dataset.approvalId = ev.id;

  const head = document.createElement('div');
  head.className = 'approval-head';
  head.innerHTML = `<span class="approval-ico">${ICONS.shield}</span>
    <span class="approval-title">
      <b>${escapeHtml(ev.title || (isShell ? 'تشغيل أمر في الطرفية' : 'كتابة ملف'))}</b>
      <small>سيتوقف الوكيل حتى تقرر</small>
    </span>
    <span class="approval-badge">يتطلب إذنك</span>`;
  card.appendChild(head);

  if (isShell) {
    const terminal = document.createElement('div');
    terminal.className = 'terminal';
    terminal.innerHTML = `<div class="terminal-head"><i></i><i></i><i></i><span>shell</span></div><pre></pre>`;
    terminal.querySelector('pre').textContent = `$ ${ev.command || ''}`;
    card.appendChild(terminal);

    const note = document.createElement('div');
    note.className = 'tool-note';
    note.style.marginTop = '7px';
    note.innerHTML = `مجلد التنفيذ: <span dir="ltr">${escapeHtml(ev.cwd || '.')}</span>`;
    card.appendChild(note);
  } else {
    const path = document.createElement('div');
    path.className = 'approval-path';
    path.textContent = ev.path || '';
    card.appendChild(path);

    const stat = document.createElement('div');
    stat.className = 'diff-stat';
    stat.innerHTML = `<span class="add">+${Number(ev.additions) || 0}</span><span class="del">-${Number(ev.deletions) || 0}</span><span style="color:var(--faint)">${ev.created ? 'ملف جديد' : 'تعديل'} · ${formatBytes(ev.bytes)}</span>`;
    card.appendChild(stat);

    if (ev.lines && ev.lines.length) card.insertAdjacentHTML('beforeend', diffHtml(ev.lines));
  }

  const actions = document.createElement('div');
  actions.className = 'approval-actions';

  const approve = document.createElement('button');
  approve.type = 'button';
  approve.className = 'btn primary';
  approve.innerHTML = `${ICONS.check}<span>${isShell ? 'تشغيل الأمر' : 'كتابة الملف'}</span>`;

  const deny = document.createElement('button');
  deny.type = 'button';
  deny.className = 'btn ghost';
  deny.textContent = 'رفض';

  const label = document.createElement('label');
  label.className = 'approve-check';
  label.innerHTML = `<input type="checkbox" data-dontask> <span>${isShell ? 'السماح تلقائيًا لأوامر النظام في هذه الجلسة' : 'السماح بكتابة الملفات في هذه الجلسة'}</span>`;

  actions.appendChild(approve);
  actions.appendChild(deny);
  actions.appendChild(label);
  card.appendChild(actions);

  const hint = document.createElement('div');
  hint.className = 'approval-hint';
  hint.textContent = isShell
    ? 'راجع الأمر جيدًا. لن يُنفَّذ شيء قبل موافقتك.'
    : 'سيتم حفظ نسخة احتياطية من الملف قبل استبداله.';
  card.appendChild(hint);

  approve.addEventListener('click', () => {
    const dontAsk = !!card.querySelector('[data-dontask]').checked;
    respondApproval(ev, true, dontAsk, card);
  });
  deny.addEventListener('click', () => respondApproval(ev, false, false, card));

  $('#chat').appendChild(card);
  scrollIfPinned();
  return card;
}

function respondApproval(ev, approve, dontAskAgain, card) {
  if (!card || card.classList.contains('decided')) return;
  card.classList.add('decided');

  const badge = card.querySelector('.approval-badge');
  if (badge) {
    badge.textContent = approve ? 'تمت الموافقة' : 'مرفوض';
    badge.style.color = approve ? 'var(--green)' : 'var(--red)';
    badge.style.background = approve ? 'var(--green-soft)' : 'var(--red-soft)';
    badge.style.borderColor = 'transparent';
  }

  state.pending = null;
  setStatus(approve ? 'ينفّذ…' : 'أعيد الخيار للنموذج…', 'working');

  resumeTurn({
    toolCallId: ev.id,
    approve,
    dontAskAgain: !!dontAskAgain
  });
}

/* ---------------- Questions ---------------- */
function findQuestionCard(id) {
  return $$('.question-card', $('#chat')).find((card) => card.dataset.id === id) || null;
}

function questionAnswerText(answer) {
  if (!answer) return '';
  const parts = [];
  if (Array.isArray(answer.selected) && answer.selected.length) parts.push(answer.selected.join('، '));
  if (answer.other) parts.push(answer.other);
  return parts.join(' — ');
}

function buildQuestionCard(ev, interactive) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.dataset.id = ev.id;

  const answered = !!(ev.answer && questionAnswerText(ev.answer));
  if (answered) card.classList.add('answered');
  if (ev.expired && !answered) card.classList.add('expired');

  const head = document.createElement('div');
  head.className = 'question-head';
  head.innerHTML = `${ICONS.help}<span>${escapeHtml(ev.header || 'سؤال توضيحي')}</span>`;
  card.appendChild(head);

  const question = document.createElement('div');
  question.className = 'question-text';
  question.textContent = ev.question || '';
  card.appendChild(question);

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'q-options';

  const options = Array.isArray(ev.options) ? ev.options : [];
  const selected = new Set((ev.answer && ev.answer.selected) || []);

  options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'q-option' + (selected.has(option.label) ? ' selected' : '');
    button.disabled = !interactive;
    button.innerHTML = `<span class="q-key">${index + 1}</span>
      <span class="q-option-body">
        <span class="q-label">${escapeHtml(option.label)}</span>
        ${option.description ? `<span class="q-desc">${escapeHtml(option.description)}</span>` : ''}
      </span>`;

    button.addEventListener('click', () => {
      if (!interactive || card.classList.contains('answered') || card.classList.contains('expired')) return;

      if (ev.multiple) {
        if (selected.has(option.label)) selected.delete(option.label);
        else selected.add(option.label);
        button.classList.toggle('selected', selected.has(option.label));
        const confirm = card.querySelector('[data-confirm-question]');
        if (confirm) confirm.disabled = selected.size === 0;
      } else {
        submitQuestion(ev, card, { selected: [option.label], other: '' });
      }
    });

    optionsWrap.appendChild(button);
  });

  card.appendChild(optionsWrap);

  if (!answered && !ev.expired && interactive) {
    const other = document.createElement('div');
    other.className = 'q-other';
    other.innerHTML = `<input type="text" placeholder="أو اكتب إجابة مختلفة…" maxlength="500">
      <button type="button" title="إرسال الإجابة" disabled>${ICONS.send}</button>`;

    const input = other.querySelector('input');
    const send = other.querySelector('button');

    input.addEventListener('input', () => {
      send.disabled = !input.value.trim();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && input.value.trim()) {
        event.preventDefault();
        submitQuestion(ev, card, { selected: [], other: input.value.trim() });
      }
    });
    send.addEventListener('click', () => {
      if (input.value.trim()) {
        submitQuestion(ev, card, { selected: [], other: input.value.trim() });
      }
    });

    card.appendChild(other);

    if (ev.multiple) {
      const confirmWrap = document.createElement('div');
      confirmWrap.className = 'q-confirm';
      confirmWrap.innerHTML = `<button type="button" class="btn primary small" data-confirm-question disabled>${ICONS.check} تأكيد الاختيار</button>`;
      const confirm = confirmWrap.querySelector('button');
      confirm.addEventListener('click', () => {
        if (selected.size) submitQuestion(ev, card, { selected: Array.from(selected), other: '' });
      });
      card.appendChild(confirmWrap);
    }
  }

  if (answered) {
    card.insertAdjacentHTML('beforeend', `<div class="question-answered">${ICONS.check}<span>إجابتك: <b>${escapeHtml(questionAnswerText(ev.answer))}</b></span></div>`);
  } else if (ev.expired) {
    card.insertAdjacentHTML('beforeend', '<div class="q-expired">انتهت صلاحية هذا السؤال. أرسل رسالة جديدة للمتابعة.</div>');
  }

  $('#chat').appendChild(card);
  scrollIfPinned();
  return card;
}

function submitQuestion(ev, card, payload) {
  if (!card || card.classList.contains('answered') || card.classList.contains('expired')) return;

  card.dataset.submitting = '1';
  card.classList.add('answered');

  const answer = {
    selected: payload.selected || [],
    other: payload.other || ''
  };

  const existing = card.querySelector('.question-answered');
  if (existing) existing.remove();
  card.insertAdjacentHTML('beforeend', `<div class="question-answered">${ICONS.check}<span>إجابتك: <b>${escapeHtml(questionAnswerText(answer))}</b></span></div>`);

  state.pending = null;
  setStatus('يعمل…', 'working');

  resumeTurn({
    toolCallId: ev.id,
    selected: answer.selected,
    answer: answer.other
  });
}

function markQuestionAnswered(ev, answer) {
  const card = findQuestionCard(ev.id);
  if (!card) return;
  card.classList.remove('expired');
  card.classList.add('answered');

  const old = card.querySelector('.question-answered');
  if (old) old.remove();

  card.insertAdjacentHTML('beforeend', `<div class="question-answered">${ICONS.check}<span>إجابتك: <b>${escapeHtml(questionAnswerText(answer))}</b></span></div>`);
}

/* ---------------- Plan ---------------- */
function applyPlan(todos) {
  state.todos = Array.isArray(todos) ? todos : [];
  const panel = $('#plan-panel');
  if (!panel) return;

  if (!state.todos.length) {
    panel.hidden = true;
    panel.classList.remove('expanded');
    $('#plan-list').innerHTML = '';
    return;
  }

  panel.hidden = false;
  panel.classList.add('expanded');

  const completed = state.todos.filter((todo) => todo.status === 'completed').length;
  const total = state.todos.length;
  $('#plan-count').textContent = `${completed}/${total}`;
  $('#plan-progress').style.width = `${total ? Math.round((completed / total) * 100) : 0}%`;

  $('#plan-list').innerHTML = state.todos.map((todo) => {
    const status = ['pending', 'in_progress', 'completed'].includes(todo.status) ? todo.status : 'pending';
    const icon = status === 'completed' ? '✓' : status === 'in_progress' ? '◐' : '○';
    return `<li class="plan-item ${status}"><span class="plan-ico">${icon}</span><span>${escapeHtml(todo.content)}</span></li>`;
  }).join('');
}

function clearPlan() {
  state.todos = [];
  const panel = $('#plan-panel');
  if (!panel) return;
  panel.hidden = true;
  panel.classList.remove('expanded');
  $('#plan-list').innerHTML = '';
  $('#plan-count').textContent = '0/0';
  $('#plan-progress').style.width = '0%';
}

/* ---------------- Notices / usage ---------------- */
function addNotice(text, level = 'info') {
  const icon = level === 'error' || level === 'warn' ? ICONS.alert : ICONS.spark;
  const el = document.createElement('div');
  el.className = `notice ${level}`;
  el.innerHTML = `${icon}<div>${escapeHtml(text)}</div>`;
  $('#chat').appendChild(el);
  scrollIfPinned();
  return el;
}

function updateUsage(usage) {
  if (!usage) return;
  state.lastUsage = usage;
  const el = $('#usage-mini');
  if (!el) return;
  const tokens = usage.completion_tokens || 0;
  const speed = usage.tokPerSec || 0;
  el.textContent = `${tokens} توكن · ${speed} t/s`;
  el.title = `الطلب: ${usage.prompt_tokens || 0} · الاستجابة: ${tokens} · ${speed} توكن/ث`;
}

/* ---------------- Transcript replay ---------------- */
function renderTranscript(transcript, pending) {
  const chat = $('#chat');
  chat.innerHTML = '';
  state.pending = pending || null;

  if (!Array.isArray(transcript) || !transcript.length) {
    renderWelcome();
    return;
  }

  for (const ev of transcript) {
    if (!ev || !ev.type) continue;

    if (ev.type === 'user') {
      addUserMessage(ev.text);
    } else if (ev.type === 'assistant') {
      addAssistantStatic(ev.text, ev.reasoning);
    } else if (ev.type === 'tool') {
      state.toolArgs.set(ev.id, ev.args || {});
      if (ev.status === 'waiting_approval' && ev.approval) {
        const isPending = pending && pending.kind === 'approval' && pending.toolCallId === ev.id;
        if (isPending) {
          buildApprovalCard({ id: ev.id, name: ev.name, kind: ev.approval.kind, ...ev.approval });
        } else {
          upsertToolCard({ ...ev, status: 'expired' });
        }
      } else {
        upsertToolCard(ev);
      }
    } else if (ev.type === 'question') {
      const isPending = pending && pending.kind === 'question' && pending.toolCallId === ev.id && !ev.answer && !ev.expired;
      buildQuestionCard(ev, !!isPending);
    } else if (ev.type === 'plan') {
      applyPlan(ev.todos);
    } else if (ev.type === 'notice') {
      addNotice(ev.text, ev.level || 'info');
    }
  }

  scrollToBottom(true);
}
