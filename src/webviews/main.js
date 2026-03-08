// @ts-nocheck
const vscode = acquireVsCodeApi();

const toastEl = document.getElementById('toast');
const listEl = document.getElementById('agent-list');
const emptyEl = document.getElementById('empty');
const formCard = document.getElementById('form-card');
const formTitle = document.getElementById('form-title');
const fab = document.getElementById('fab');
const fName = document.getElementById('f-name');
const fModel = document.getElementById('f-model');
const fPort = document.getElementById('f-port');
const fCtxChk = document.getElementById('f-ctx-chk');
const fCtxSlide = document.getElementById('f-ctx-slide');
const fCtx = document.getElementById('f-ctx');
const btnSave = document.getElementById('btn-form-save');

let agents = [];
let models = [];
let editingId = null;
let toastTimer = null;

/* ── Init ── */
vscode.postMessage({ type: 'getModels' });
vscode.postMessage({ type: 'getAgents' });

/* ── Toast ── */
function toast(msg, type) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = 'toast ' + type;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

/* ── UUID ── */
function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ── Persist agents ── */
function persist() {
  const clean = agents.map((a) => ({
    id: a.id,
    name: a.name,
    port: a.port,
    modelId: a.modelId,
    systemPrompt: a.systemPrompt || '',
  }));
  vscode.postMessage({ type: 'saveAgents', value: clean });
}

/* ── Render agent list ── */
function render() {
  listEl.innerHTML = '';
  emptyEl.style.display = agents.length ? 'none' : 'block';

  agents.forEach((a) => {
    const isOn = !!a.running;
    const card = document.createElement('div');
    card.className = 'ag' + (isOn ? ' running' : '');
    card.innerHTML =
      '<div class="ag-top">' +
      '<div class="ag-dot ' +
      (isOn ? 'on' : 'off') +
      '"></div>' +
      '<div class="ag-info">' +
      '<div class="ag-name" title="' +
      esc(a.name) +
      '">' +
      esc(a.name) +
      '</div>' +
      '<div class="ag-sub" title="Port ' +
      a.port +
      ' · ' +
      esc(a.modelId || 'default') +
      '">Port ' +
      a.port +
      ' · ' +
      esc(a.modelId || 'default') +
      '</div>' +
      '</div>' +
      '<div class="ag-actions">' +
      (isOn
        ? '<button class="ab st" data-stop="' +
          a.id +
          '">Stop</button>' +
          '<button class="ab" data-info="' +
          a.id +
          '" title="API Info">ℹ</button>'
        : '<button class="ab go" data-start="' +
          a.id +
          '">Start</button>' +
          '<button class="ab" data-edit="' +
          a.id +
          '" title="Edit">✎</button>' +
          '<button class="ab del" data-del="' +
          a.id +
          '" title="Delete">✕</button>') +
      '</div>' +
      '</div>' +
      '<div class="ag-ep">' +
      '<code title="http://localhost:' +
      a.port +
      '/LocalForge/chat">http://localhost:' +
      a.port +
      '/LocalForge/chat</code>' +
      '<button class="cp" data-copy="http://localhost:' +
      a.port +
      '/LocalForge/chat">Copy</button>' +
      '</div>';
    listEl.appendChild(card);
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ── Event delegation ── */
listEl.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;

  if (t.dataset.start) {
    const a = agents.find((x) => x.id === t.dataset.start);
    if (a) {
      t.textContent = '…';
      t.disabled = true;
      vscode.postMessage({ type: 'startAgent', agent: a });
    }
  }
  if (t.dataset.stop) {
    const id = t.dataset.stop;
    t.textContent = '…';
    t.disabled = true;
    vscode.postMessage({ type: 'stopAgent', agentId: id });
  }
  if (t.dataset.info) {
    const a = agents.find((x) => x.id === t.dataset.info);
    if (a) vscode.postMessage({ type: 'showApiInfo', agent: a });
  }
  if (t.dataset.edit) {
    const a = agents.find((x) => x.id === t.dataset.edit);
    if (a) openForm(a);
  }
  if (t.dataset.del) {
    agents = agents.filter((x) => x.id !== t.dataset.del);
    persist();
    render();
    toast('Agent removed', 'success');
  }
  if (t.dataset.copy) {
    navigator.clipboard.writeText(t.dataset.copy).then(() => {
      t.textContent = 'Done';
      t.classList.add('done');
      setTimeout(() => {
        t.textContent = 'Copy';
        t.classList.remove('done');
      }, 1500);
    });
  }
});

/* ── Form ── */
function openForm(agent) {
  editingId = agent ? agent.id : null;
  formTitle.textContent = agent ? 'Edit Agent' : 'New Agent';
  btnSave.textContent = agent ? 'Save' : 'Create Agent';
  fName.value = agent ? agent.name : '';
  fPort.value = agent ? agent.port : nextPort();
  fCtx.value = agent ? agent.systemPrompt || '' : '';
  fCtxChk.checked = !!(agent && agent.systemPrompt);
  fCtxSlide.classList.toggle('open', fCtxChk.checked);

  if (models.length && agent && agent.modelId) {
    const opt = fModel.querySelector('option[value="' + agent.modelId + '"]');
    if (opt) fModel.value = agent.modelId;
  }
  formCard.classList.add('open');
  fab.style.display = 'none';
  fName.focus();
}

function closeForm() {
  formCard.classList.remove('open');
  fab.style.display = 'flex';
  editingId = null;
}

function nextPort() {
  const used = new Set(agents.map((a) => a.port));
  let p = 6009;
  while (used.has(p)) p++;
  return p;
}

fab.addEventListener('click', () => openForm(null));
document.getElementById('btn-cancel').addEventListener('click', closeForm);
document.getElementById('btn-form-cancel').addEventListener('click', closeForm);
fCtxChk.addEventListener('change', () => {
  fCtxSlide.classList.toggle('open', fCtxChk.checked);
  if (fCtxChk.checked) fCtx.focus();
});

btnSave.addEventListener('click', () => {
  const name = fName.value.trim();
  if (!name) {
    toast('Agent name is required', 'error');
    fName.focus();
    return;
  }
  const port = parseInt(fPort.value);
  if (!port || port < 1024 || port > 65535) {
    toast('Port must be 1024-65535', 'error');
    fPort.focus();
    return;
  }
  const modelId = fModel.value;
  const systemPrompt = fCtxChk.checked ? fCtx.value.trim() : '';

  if (editingId) {
    const idx = agents.findIndex((a) => a.id === editingId);
    if (idx >= 0) {
      agents[idx] = { ...agents[idx], name, port, modelId, systemPrompt };
    }
  } else {
    agents.push({ id: uid(), name, port, modelId, systemPrompt, running: false });
  }
  persist();
  render();
  closeForm();
  toast(editingId ? 'Agent updated' : 'Agent created', 'success');
});

/* ── Header Buttons ── */
document.getElementById('btn-refresh').addEventListener('click', () => {
  vscode.postMessage({ type: 'getAgents' });
  vscode.postMessage({ type: 'getModels' });
});
document.getElementById('btn-start-all').addEventListener('click', () => {
  if (!agents.length) return toast('No agents to start', '');
  toast('Starting all...', '');
  vscode.postMessage({ type: 'startAllAgents' });
});
document.getElementById('btn-stop-all').addEventListener('click', () => {
  if (!agents.length) return toast('No agents to stop', '');
  toast('Stopping all...', '');
  vscode.postMessage({ type: 'stopAllAgents' });
});

/* ── Messages ── */
window.addEventListener('message', (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'models':
      models = msg.value || [];
      fModel.innerHTML = '';
      if (models.length) {
        models.forEach((m) => {
          const o = document.createElement('option');
          o.value = m.family;
          o.textContent = m.name;
          fModel.appendChild(o);
        });
      } else {
        const o = document.createElement('option');
        o.textContent = 'No models';
        o.disabled = true;
        fModel.appendChild(o);
      }
      break;

    case 'agents':
      agents = msg.value || [];
      render();
      break;

    case 'agentStarted':
      if (msg.success) {
        const a = agents.find((x) => x.id === msg.agentId);
        if (a) {
          a.running = true;
          if (msg.port) a.port = msg.port;
        }
        render();
        toast('Agent started on port ' + msg.port, 'success');
      } else {
        render();
        toast(msg.error || 'Failed to start', 'error');
      }
      break;

    case 'agentStopped':
      if (msg.success) {
        const a = agents.find((x) => x.id === msg.agentId);
        if (a) a.running = false;
        render();
        toast('Agent stopped', 'success');
      } else {
        render();
        toast(msg.error || 'Failed to stop', 'error');
      }
      break;

    case 'toast':
      toast(msg.msg, msg.style);
      break;
  }
});
