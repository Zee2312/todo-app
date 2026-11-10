(() => {
  'use strict';

  const STORE_KEY = 'todo-today-v1';
  const $ = s => document.querySelector(s);

  const els = {
    list: $('#list'), empty: $('#empty'), form: $('#add-form'), input: $('#task-input'),
    priority: $('#priority'), due: $('#due'), sort: $('#sort'), filters: $('#filters'),
    left: $('#left'), clear: $('#clear-done'), ringFg: $('#ring-fg'), ringText: $('#ring-text'),
    ring: $('#ring'), toast: $('#toast'), toastText: $('#toast-text'), undo: $('#undo'), date: $('#date')
  };

  const ICONS = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };
  const PRIORITY_LABEL = { 1: 'Low', 2: 'Medium', 3: 'High' };

  const state = { tasks: load(), filter: 'all', sort: 'manual', editingId: null };
  let lastDeleted = null;
  let toastTimer;

  /* ---------- Storage ---------- */
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.tasks)); } catch { /* storage unavailable */ }
  }

  /* ---------- Helpers ---------- */
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  function formatDue(str) {
    const today = todayStr();
    if (str === today) return 'Due today';
    const d = new Date(str + 'T00:00:00');
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return 'Due ' + label;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function iconButton(cls, label, svg, onClick) {
    const b = el('button', 'icon ' + cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = svg;
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---------- Toast ---------- */
  function showToast(msg, withUndo) {
    els.toastText.textContent = msg;
    els.undo.hidden = !withUndo;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.classList.remove('show'); lastDeleted = null; }, 5000);
  }

  /* ---------- Actions ---------- */
  function addTask(text, priority, due) {
    state.tasks.unshift({ id: Date.now() + Math.random(), text, done: false, priority, due: due || '', created: Date.now() });
    save(); render();
  }
  function toggle(id) {
    const t = state.tasks.find(t => t.id === id);
    if (t) { t.done = !t.done; save(); render(); }
  }
  function remove(id) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx < 0) return;
    lastDeleted = { task: state.tasks[idx], idx };
    state.tasks.splice(idx, 1);
    save(); render();
    showToast('Task deleted', true);
  }
  function rename(id, text) {
    const t = state.tasks.find(t => t.id === id);
    const clean = text.trim();
    if (t && clean) { t.text = clean; save(); }
    state.editingId = null;
    render();
  }

  /* ---------- Render ---------- */
  function visible() {
    let list = state.tasks.filter(t =>
      state.filter === 'all' || (state.filter === 'done' ? t.done : !t.done));
    if (state.sort === 'priority') list = [...list].sort((a, b) => b.priority - a.priority || b.created - a.created);
    if (state.sort === 'due') list = [...list].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || b.created - a.created);
    return list;
  }

  function render() {
    els.list.innerHTML = '';
    const today = todayStr();

    visible().forEach(t => {
      const li = el('li', 'task' + (t.done ? ' done' : ''));
      li.dataset.priority = t.priority;

      const check = el('button', 'check');
      check.type = 'button';
      check.setAttribute('role', 'checkbox');
      check.setAttribute('aria-checked', String(t.done));
      check.setAttribute('aria-label', `Mark "${t.text}" as ${t.done ? 'not done' : 'done'}`);
      check.innerHTML = ICONS.check;
      check.addEventListener('click', () => toggle(t.id));

      const body = el('div', 'body');
      if (state.editingId === t.id) {
        const input = el('input', 'edit-input');
        input.type = 'text'; input.value = t.text; input.maxLength = 120;
        input.setAttribute('aria-label', 'Edit task');
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') rename(t.id, input.value);
          if (e.key === 'Escape') { state.editingId = null; render(); }
        });
        input.addEventListener('blur', () => { if (state.editingId === t.id) rename(t.id, input.value); });
        body.appendChild(input);
        setTimeout(() => { input.focus(); input.select(); }, 0);
      } else {
        body.appendChild(el('div', 'text', t.text));
        const meta = el('div', 'meta');
        meta.appendChild(el('span', '', PRIORITY_LABEL[t.priority] + ' priority'));
        if (t.due) {
          const overdue = !t.done && t.due < today;
          meta.appendChild(el('span', overdue ? 'overdue' : '', overdue ? 'Overdue · ' + formatDue(t.due).replace('Due ', '') : formatDue(t.due)));
        }
        body.appendChild(meta);
      }

      const actions = el('div', 'actions');
      actions.appendChild(iconButton('', `Edit "${t.text}"`, ICONS.edit, () => { state.editingId = t.id; render(); }));
      actions.appendChild(iconButton('del', `Delete "${t.text}"`, ICONS.del, () => remove(t.id)));

      li.append(check, body, actions);
      els.list.appendChild(li);
    });

    // Empty state
    const shown = els.list.children.length;
    els.empty.hidden = shown > 0;
    if (!shown) {
      els.empty.textContent = state.tasks.length === 0
        ? 'Nothing here yet. Add your first task above.'
        : state.filter === 'done' ? 'No completed tasks yet.' : 'All caught up. Nothing left to do.';
    }

    // Counts + progress ring
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.done).length;
    const left = total - done;
    els.left.textContent = `${left} ${left === 1 ? 'task' : 'tasks'} left`;
    els.clear.disabled = done === 0;
    els.ringText.textContent = `${done}/${total}`;
    els.ring.setAttribute('aria-label', `${done} of ${total} tasks completed`);
    const ratio = total ? done / total : 0;
    els.ringFg.style.strokeDashoffset = String(113.1 * (1 - ratio));
  }

  /* ---------- Events ---------- */
  els.form.addEventListener('submit', e => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;
    addTask(text, Number(els.priority.value), els.due.value);
    els.input.value = ''; els.due.value = '';
    els.input.focus();
  });

  els.filters.addEventListener('click', e => {
    const b = e.target.closest('button[data-filter]');
    if (!b) return;
    state.filter = b.dataset.filter;
    els.filters.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });

  els.sort.addEventListener('change', () => { state.sort = els.sort.value; render(); });

  els.clear.addEventListener('click', () => {
    const n = state.tasks.filter(t => t.done).length;
    if (!n) return;
    state.tasks = state.tasks.filter(t => !t.done);
    save(); render();
    showToast(`${n} completed ${n === 1 ? 'task' : 'tasks'} cleared`, false);
  });

  els.undo.addEventListener('click', () => {
    if (!lastDeleted) return;
    state.tasks.splice(Math.min(lastDeleted.idx, state.tasks.length), 0, lastDeleted.task);
    lastDeleted = null;
    save(); render();
    els.toast.classList.remove('show');
  });

  /* ---------- Init ---------- */
  els.date.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  els.due.min = todayStr();
  render();
})();
