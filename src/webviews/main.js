// @ts-nocheck
/* global acquireVsCodeApi, FlowChart, ListView, Sidebar */
/**
 * main.js — Core state, VS Code IPC, and message routing.
 * Exposes window.LF for use by sidebar.js, list-view.js, flowchart.js.
 */

const _vscode = acquireVsCodeApi();

// ── Shared global namespace ──────────────────────────────────────────────────
window.LF = {
  vscode: _vscode,
  agents: [],
  models: [],
  projects: [],
  currentWorkspace: null,
  GLOBAL_ID: '__global__',
  activeProjectId: '__global__',
  editingId: null, // 'new' | agent.id | null
  activeView: 'list', // 'list' | 'flowchart'
  toastTimer: null,
  pendingConfirmAction: null,

  /* ── Helpers ── */
  uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  },
  esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
  nextPort() {
    const used = new Set(LF.agents.map((a) => a.port));
    let p = 6009;
    while (used.has(p)) p++;
    return p;
  },

  /* ── Toast ── */
  toast(msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;
    if (LF.toastTimer) clearTimeout(LF.toastTimer);
    el.textContent = msg;
    el.className = 'toast ' + (type || '');
    requestAnimationFrame(() => el.classList.add('show'));
    LF.toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  },

  /* ── Confirm dialog ── */
  showConfirm(title, message, onYes) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    LF.pendingConfirmAction = onYes;
    modal.classList.remove('hidden');
  },
  closeConfirm() {
    document.getElementById('confirm-modal').classList.add('hidden');
    LF.pendingConfirmAction = null;
  },

  /* ── Persistence ── */
  persistAgents() {
    const clean = LF.agents.map((a) => ({
      id: a.id,
      projectId: a.projectId || '',
      name: a.name,
      port: a.port,
      modelId: a.modelId,
      systemPrompt: a.systemPrompt || '',
    }));
    _vscode.postMessage({ type: 'saveAgents', value: clean });
  },
  persistProjects() {
    _vscode.postMessage({ type: 'saveProjects', value: LF.projects });
  },

  /* ── View switching ── */
  switchView(view) {
    LF.activeView = view;
    const listContainer = document.getElementById('list-container');
    const flowContainer = document.getElementById('flow-container');
    const btnList = document.getElementById('btn-view-list');
    const btnFlow = document.getElementById('btn-view-flow');

    if (view === 'flowchart') {
      listContainer.classList.add('view-hidden');
      flowContainer.classList.remove('view-hidden');
      flowContainer.classList.add('view-visible');
      listContainer.classList.remove('view-visible');
      btnFlow.classList.add('active');
      btnList.classList.remove('active');
      if (window.FlowChart) FlowChart.render();
    } else {
      flowContainer.classList.add('view-hidden');
      flowContainer.classList.remove('view-visible');
      listContainer.classList.remove('view-hidden');
      listContainer.classList.add('view-visible');
      btnList.classList.add('active');
      btnFlow.classList.remove('active');
      if (window.ListView) ListView.render();
    }
  },
};

// Short alias — var so it is globally visible to all sibling scripts
var LF = window.LF;

// ── Readiness tracker — render once both agents + projects arrive ────────────
LF._got = { agents: false, projects: false, workspace: false };
function _tryFirstRender() {
  if (LF._got.agents && LF._got.projects) {
    if (window.Sidebar) Sidebar.renderProjects();
  }
}

// ── Confirm dialog wiring ────────────────────────────────────────────────────
document.getElementById('btn-confirm-yes').addEventListener('click', () => {
  if (LF.pendingConfirmAction) LF.pendingConfirmAction();
  LF.closeConfirm();
});
document.getElementById('btn-confirm-no').addEventListener('click', LF.closeConfirm);
document.getElementById('btn-confirm-cancel').addEventListener('click', LF.closeConfirm);

// ── View toggle buttons ──────────────────────────────────────────────────────
document.getElementById('btn-view-list').addEventListener('click', () => LF.switchView('list'));
document
  .getElementById('btn-view-flow')
  .addEventListener('click', () => LF.switchView('flowchart'));

// ── Header action buttons ────────────────────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', () => {
  _vscode.postMessage({ type: 'getAgents' });
  _vscode.postMessage({ type: 'getModels' });
});

document.getElementById('btn-start-all').addEventListener('click', () => {
  const list =
    LF.activeProjectId === LF.GLOBAL_ID
      ? LF.agents.filter((a) => !a.projectId || a.projectId === LF.GLOBAL_ID)
      : LF.agents.filter((a) => a.projectId === LF.activeProjectId);
  if (!list.length) return LF.toast('No agents to start', '');
  LF.toast('Starting agents…', '');
  list.forEach((a) => {
    if (!a.running) _vscode.postMessage({ type: 'startAgent', agent: a });
  });
});

document.getElementById('btn-stop-all').addEventListener('click', () => {
  const list =
    LF.activeProjectId === LF.GLOBAL_ID
      ? LF.agents.filter((a) => !a.projectId || a.projectId === LF.GLOBAL_ID)
      : LF.agents.filter((a) => a.projectId === LF.activeProjectId);
  if (!list.length) return LF.toast('No agents to stop', '');
  LF.toast('Stopping agents…', '');
  list.forEach((a) => {
    if (a.running) _vscode.postMessage({ type: 'stopAgent', agentId: a.id });
  });
});

// ── VS Code message handler ──────────────────────────────────────────────────
window.addEventListener('message', (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'currentWorkspace':
      LF.currentWorkspace = msg.value;
      LF._got.workspace = true;
      _tryFirstRender();
      break;

    case 'projects':
      LF.projects = msg.value || [];
      LF._got.projects = true;
      _tryFirstRender();
      break;

    case 'models':
      LF.models = msg.value || [];
      if (LF.editingId && window.ListView) ListView.render();
      break;

    case 'agents':
      LF.agents = msg.value || [];
      // Migrate orphan agents to global (no projectId)
      if (LF.agents.some((a) => !a.projectId)) {
        LF.agents = LF.agents.map((a) => ({ ...a, projectId: a.projectId || '' }));
        LF.persistAgents();
      }
      LF._got.agents = true;
      _tryFirstRender();
      break;

    case 'agentStarted':
      if (msg.success) {
        const a = LF.agents.find((x) => x.id === msg.agentId);
        if (a) {
          a.running = true;
          if (msg.port) a.port = msg.port;
        }
        LF.toast('Agent started on port ' + msg.port, 'success');
      } else {
        LF.toast(msg.error || 'Failed to start', 'error');
      }
      if (window.ListView) ListView.render();
      if (LF.activeView === 'flowchart' && window.FlowChart) FlowChart.render();
      break;

    case 'agentStopped':
      if (msg.success) {
        const a = LF.agents.find((x) => x.id === msg.agentId);
        if (a) a.running = false;
        LF.toast('Agent stopped', 'success');
      } else {
        LF.toast(msg.error || 'Failed to stop', 'error');
      }
      if (window.ListView) ListView.render();
      if (LF.activeView === 'flowchart' && window.FlowChart) FlowChart.render();
      break;

    case 'agentThinking': {
      if (window.FlowChart) FlowChart.triggerThinking(msg.agentId);
      // List view: add a subtle thinking indicator
      const lel = document.getElementById('ag-card-' + msg.agentId);
      if (lel) lel.classList.add('thinking');
      break;
    }

    case 'agentActivity': {
      // Glow in list view
      const el = document.getElementById('ag-card-' + msg.agentId);
      if (el) {
        el.classList.remove('thinking');
        el.classList.remove('activity');
        void el.offsetWidth;
        el.classList.add('activity');
      }
      // Glow + preview in flowchart
      if (window.FlowChart) FlowChart.triggerActivity(msg.agentId, msg.preview || '');
      break;
    }

    case 'toast':
      LF.toast(msg.msg, msg.style);
      break;
  }
});

// ── Bootstrap ────────────────────────────────────────────────────────────────
_vscode.postMessage({ type: 'getModels' });
_vscode.postMessage({ type: 'getCurrentWorkspace' });
_vscode.postMessage({ type: 'getProjects' });
_vscode.postMessage({ type: 'getAgents' });
