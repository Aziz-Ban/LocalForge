// @ts-nocheck
const vscode = acquireVsCodeApi();

/* ── DOM refs ── */
const toastEl = document.getElementById('toast');
const listEl = document.getElementById('agent-list');
const emptyEl = document.getElementById('empty');

const sidebar = document.getElementById('project-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const projectListEl = document.getElementById('project-list');
const activeProjectNameEl = document.getElementById('active-project-name');

const projectModal = document.getElementById('project-modal');
const fProjName = document.getElementById('f-proj-name');
const btnProjSave = document.getElementById('btn-proj-save');

const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const btnConfirmYes = document.getElementById('btn-confirm-yes');
const btnConfirmNo = document.getElementById('btn-confirm-no');
const btnConfirmCancel = document.getElementById('btn-confirm-cancel');

/* ── State ── */
let agents = [];
let models = [];
let projects = [];
let currentWorkspace = null;

const GLOBAL_ID = '__global__'; // special ID for "All Agents"
let activeProjectId = GLOBAL_ID;
let editingId = null; // 'new' for new agent, or agent.id for inline editing
let toastTimer = null;
let pendingConfirmAction = null; // callback for confirm dialog

/* ── Init ── */
vscode.postMessage({ type: 'getModels' });
vscode.postMessage({ type: 'getCurrentWorkspace' });
vscode.postMessage({ type: 'getProjects' });
vscode.postMessage({ type: 'getAgents' });

/* ── Toast ── */
function toast(msg, type) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = 'toast ' + (type || '');
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

function nextPort() {
  const used = new Set(agents.map((a) => a.port));
  let p = 6009;
  while (used.has(p)) p++;
  return p;
}

/* ── Persist ── */
function persistAgents() {
  const clean = agents.map((a) => ({
    id: a.id,
    projectId: a.projectId || '',
    name: a.name,
    port: a.port,
    modelId: a.modelId,
    systemPrompt: a.systemPrompt || '',
  }));
  vscode.postMessage({ type: 'saveAgents', value: clean });
}

function persistProjects() {
  vscode.postMessage({ type: 'saveProjects', value: projects });
}

/* ══════════════════════════
   CONFIRM DIALOG
   ══════════════════════════ */
function showConfirm(title, message, onYes) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  pendingConfirmAction = onYes;
  confirmModal.classList.remove('hidden');
}

function closeConfirm() {
  confirmModal.classList.add('hidden');
  pendingConfirmAction = null;
}

btnConfirmYes.addEventListener('click', () => {
  if (pendingConfirmAction) pendingConfirmAction();
  closeConfirm();
});
btnConfirmNo.addEventListener('click', closeConfirm);
btnConfirmCancel.addEventListener('click', closeConfirm);

/* ══════════════════════════
   SIDEBAR
   ══════════════════════════ */

function openSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.remove('hidden');
  requestAnimationFrame(() => sidebarBackdrop.classList.add('visible'));
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('visible');
  setTimeout(() => sidebarBackdrop.classList.add('hidden'), 200);
}

document.getElementById('btn-sidebar-open').addEventListener('click', openSidebar);
document.getElementById('btn-sidebar-close').addEventListener('click', closeSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);

/* ── Render project list in sidebar ── */
function renderProjects() {
  projectListEl.innerHTML = '';

  // Ensure workspace project exists
  if (currentWorkspace) {
    let wsProj = projects.find(p => p.id === currentWorkspace.id);
    if (!wsProj) {
      wsProj = { id: currentWorkspace.id, name: currentWorkspace.name, isWorkspace: true };
      projects.unshift(wsProj);
      persistProjects();
    }
  }

  // ── "All Agents" item (global / no project) ──
  const globalCount = agents.filter(a => !a.projectId || a.projectId === GLOBAL_ID).length;
  const globalItem = document.createElement('button');
  globalItem.className = 'sidebar-item' + (activeProjectId === GLOBAL_ID ? ' active' : '');
  globalItem.innerHTML =
    '<svg class="sidebar-item-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' +
    '<span class="sidebar-item-text">All Agents</span>' +
    (globalCount > 0 ? '<span class="sidebar-item-badge">' + globalCount + '</span>' : '');
  globalItem.addEventListener('click', () => {
    activeProjectId = GLOBAL_ID;
    editingId = null;
    renderProjects();
    closeSidebar();
  });
  projectListEl.appendChild(globalItem);

  // ── Section label ──
  if (projects.length > 0) {
    const label = document.createElement('div');
    label.className = 'sidebar-section-label';
    label.textContent = 'Projects';
    projectListEl.appendChild(label);
  }

  // ── Project items ──
  projects.forEach((p) => {
    const agentCount = agents.filter(a => a.projectId === p.id).length;
    const isActive = p.id === activeProjectId;
    
    const item = document.createElement('button');
    item.className = 'sidebar-item' + (isActive ? ' active' : '');
    
    const folderSvg = p.isWorkspace
      ? '<svg class="sidebar-item-icon" viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z"/></svg>'
      : '<svg class="sidebar-item-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
    
    item.innerHTML =
      folderSvg +
      '<span class="sidebar-item-text">' + esc(p.name) + '</span>' +
      (agentCount > 0 ? '<span class="sidebar-item-badge">' + agentCount + '</span>' : '') +
      (!p.isWorkspace ? '<button class="sidebar-item-del" data-del-proj="' + p.id + '" title="Delete project"><svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' : '');
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-item-del')) return;
      activeProjectId = p.id;
      editingId = null;
      renderProjects();
      closeSidebar();
    });
    
    projectListEl.appendChild(item);
  });

  // ── Delete project handlers ──
  projectListEl.querySelectorAll('.sidebar-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const projId = btn.dataset.delProj;
      const proj = projects.find(p => p.id === projId);
      const projAgentCount = agents.filter(a => a.projectId === projId).length;
      
      showConfirm(
        'Delete "' + (proj ? proj.name : 'Project') + '"?',
        'This will permanently delete this project' + (projAgentCount > 0 ? ' and its ' + projAgentCount + ' agent' + (projAgentCount > 1 ? 's' : '') : '') + '. This cannot be undone.',
        () => {
          agents = agents.filter(a => a.projectId !== projId);
          persistAgents();
          projects = projects.filter(p => p.id !== projId);
          persistProjects();
          if (activeProjectId === projId) {
            activeProjectId = GLOBAL_ID;
          }
          renderProjects();
          toast('Project deleted', 'success');
        }
      );
    });
  });

  // ── "+ New Project" inline button ──
  const newBtn = document.createElement('button');
  newBtn.className = 'sidebar-new-inline';
  newBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><span>New Project</span>';
  newBtn.addEventListener('click', () => {
    closeSidebar();
    fProjName.value = '';
    projectModal.classList.remove('hidden');
    setTimeout(() => fProjName.focus(), 150);
  });
  projectListEl.appendChild(newBtn);

  // Update header
  if (activeProjectId === GLOBAL_ID) {
    activeProjectNameEl.textContent = 'All Agents';
  } else {
    const active = projects.find(p => p.id === activeProjectId);
    activeProjectNameEl.textContent = active ? active.name : 'All Agents';
    if (!active) activeProjectId = GLOBAL_ID;
  }

  renderAgents();
}

/* ══════════════════════════
   AGENT RENDERING
   ══════════════════════════ */

function generateFormHtml(agentId, defaultName, defaultPort, defaultModelId, defaultSysPrompt) {
  const isChecked = !!defaultSysPrompt;
  let modelOptions = '';
  if (models.length) {
    models.forEach(m => {
      const selected = m.family === defaultModelId ? 'selected' : '';
      modelOptions += '<option value="' + m.family + '" ' + selected + '>' + esc(m.name) + '</option>';
    });
  } else {
    modelOptions = '<option disabled selected>No models</option>';
  }

  const html = [];
  html.push('<div class="form-panel" style="margin-bottom:10px">');
  html.push('  <div class="fc-head">');
  html.push('    <span>' + (agentId === 'new' ? 'New Agent' : 'Edit Agent') + '</span>');
  html.push('    <button class="ib btn-in-cancel" title="Cancel"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>');
  html.push('  </div>');
  html.push('  <div class="fc-body">');

  // Agent name
  html.push('    <div class="field">');
  html.push('      <label>Agent Name</label>');
  html.push('      <input type="text" id="fn-' + agentId + '" value="' + esc(defaultName) + '" placeholder="e.g. Code Reviewer" autocomplete="off" />');
  html.push('    </div>');

  // Model & Port
  html.push('    <div class="field">');
  html.push('      <label>Model &amp; Port</label>');
  html.push('      <div class="row">');
  html.push('        <select id="fm-' + agentId + '">' + modelOptions + '</select>');
  html.push('        <input type="number" id="fp-' + agentId + '" value="' + defaultPort + '" min="1024" max="65535" title="Port" />');
  html.push('      </div>');
  html.push('    </div>');

  // System Prompt toggle
  html.push('    <div class="field">');
  html.push('      <label class="tgl">');
  html.push('        <input type="checkbox" id="fchk-' + agentId + '" ' + (isChecked ? 'checked' : '') + ' />');
  html.push('        <span class="tgl-text">System Prompt</span>');
  html.push('      </label>');
  html.push('      <div class="slide ' + (isChecked ? 'open' : '') + '" id="fsl-' + agentId + '">');
  html.push('        <textarea id="fx-' + agentId + '" class="ctx" placeholder="e.g. You are a senior UI/UX engineer.">' + esc(defaultSysPrompt) + '</textarea>');
  html.push('      </div>');
  html.push('    </div>');

  // Buttons
  html.push('    <div class="btn-row">');
  html.push('      <button class="btn btn-ghost btn-in-cancel">Cancel</button>');
  html.push('      <button class="btn btn-in-save" data-sid="' + agentId + '">' + (agentId === 'new' ? 'Create Agent' : 'Save Changes') + '</button>');
  html.push('    </div>');

  html.push('  </div>');
  html.push('</div>');
  return html.join('\n');
}

function renderAgents() {
  listEl.innerHTML = '';
  
  let projectAgents;
  if (activeProjectId === GLOBAL_ID) {
    // Show agents that have no project or are tagged as global
    projectAgents = agents.filter(a => !a.projectId || a.projectId === GLOBAL_ID);
  } else {
    projectAgents = agents.filter(a => a.projectId === activeProjectId);
  }

  if (projectAgents.length === 0 && editingId !== 'new') {
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
  }

  // New agent form at top
  if (editingId === 'new') {
    const div = document.createElement('div');
    div.innerHTML = generateFormHtml('new', '', nextPort(), '', '');
    listEl.appendChild(div);
    // Attach checkbox listener after DOM insert
    setupCheckboxListener(div, 'new');
  }

  projectAgents.forEach((a) => {
    const isOn = !!a.running;
    const card = document.createElement('div');
    
    if (editingId === a.id) {
      card.innerHTML = generateFormHtml(a.id, a.name, a.port, a.modelId, a.systemPrompt);
      listEl.appendChild(card);
      setupCheckboxListener(card, a.id);
    } else {
      card.className = 'ag' + (isOn ? ' running' : '');
      card.innerHTML =
        '<div class="ag-top">' +
        '<div class="ag-dot ' + (isOn ? 'on' : 'off') + '"></div>' +
        '<div class="ag-info">' +
        '<div class="ag-name" title="' + esc(a.name) + '">' + esc(a.name) + '</div>' +
        '<div class="ag-sub" title="Port ' + a.port + ' · ' + esc(a.modelId || 'default') + '">' +
        'Port ' + a.port + ' · ' + esc(a.modelId || 'default') +
        '</div></div>' +
        '<div class="ag-actions">' +
        (isOn
          ? '<button class="ab st" data-stop="' + a.id + '">Stop</button>' +
            '<button class="ab" data-info="' + a.id + '" title="API Info">ℹ</button>'
          : '<button class="ab go" data-start="' + a.id + '">Start</button>' +
            '<button class="ab" data-edit="' + a.id + '" title="Edit">✎</button>' +
            '<button class="ab del" data-del="' + a.id + '" title="Delete">✕</button>') +
        '</div></div>' +
        '<div class="ag-ep">' +
        '<code title="http://localhost:' + a.port + '/LocalForge/chat">http://localhost:' + a.port + '/LocalForge/chat</code>' +
        '<button class="cp" data-copy="http://localhost:' + a.port + '/LocalForge/chat">Copy</button>' +
        '</div>';
      listEl.appendChild(card);
    }
  });

  // Append "+ New Agent" inline button if not currently creating one
  if (editingId !== 'new') {
    const btn = document.createElement('button');
    btn.className = 'agent-new-btn';
    btn.dataset.newAgent = 'true';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><span>New Agent</span>';
    listEl.appendChild(btn);
  }
}

/** Attach the checkbox toggle listener for the system prompt slide */
function setupCheckboxListener(container, agentId) {
  const chk = container.querySelector('#fchk-' + agentId);
  const slide = container.querySelector('#fsl-' + agentId);
  if (chk && slide) {
    chk.addEventListener('change', () => {
      slide.classList.toggle('open', chk.checked);
    });
  }
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ══════════════════════════
   EVENT DELEGATION
   ══════════════════════════ */
listEl.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;

  if (t.dataset.newAgent) {
    editingId = 'new';
    renderAgents();
    setTimeout(() => {
      const el = document.getElementById('fn-new');
      if (el) el.focus();
    }, 50);
  }
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
    editingId = t.dataset.edit;
    renderAgents();
  }
  if (t.dataset.del) {
    const a = agents.find(x => x.id === t.dataset.del);
    showConfirm(
      'Delete "' + (a ? a.name : 'Agent') + '"?',
      'This agent will be permanently removed.',
      () => {
        agents = agents.filter((x) => x.id !== t.dataset.del);
        persistAgents();
        renderAgents();
        toast('Agent removed', 'success');
      }
    );
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

  // Inline Form Cancel
  if (t.classList.contains('btn-in-cancel')) {
    editingId = null;
    renderAgents();
  }

  // Inline Form Save
  if (t.classList.contains('btn-in-save')) {
    const sid = t.dataset.sid;
    
    const nameEl = document.getElementById('fn-' + sid);
    const modelEl = document.getElementById('fm-' + sid);
    const portEl = document.getElementById('fp-' + sid);
    const chkEl = document.getElementById('fchk-' + sid);
    const ctxEl = document.getElementById('fx-' + sid);

    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
      toast('Agent name is required', 'error');
      nameEl.focus();
      return;
    }
    const port = parseInt(portEl.value);
    if (!port || port < 1024 || port > 65535) {
      toast('Port must be 1024-65535', 'error');
      portEl.focus();
      return;
    }
    const modelId = modelEl.value;
    const systemPrompt = chkEl && chkEl.checked && ctxEl ? ctxEl.value.trim() : '';

    if (sid === 'new') {
      // If on "All Agents", the agent is global (no project)
      const projId = activeProjectId === GLOBAL_ID ? '' : activeProjectId;
      agents.push({ id: uid(), projectId: projId, name, port, modelId, systemPrompt, running: false });
      toast('Agent created', 'success');
    } else {
      const idx = agents.findIndex((a) => a.id === sid);
      if (idx >= 0) {
        agents[idx] = { ...agents[idx], name, port, modelId, systemPrompt };
      }
      toast('Agent updated', 'success');
    }
    
    editingId = null;
    persistAgents();
    renderAgents();
  }
});

/* ══════════════════════════
   PROJECT MODAL
   ══════════════════════════ */
const closeProjModal = () => projectModal.classList.add('hidden');
document.getElementById('btn-proj-cancel').addEventListener('click', closeProjModal);
document.getElementById('btn-proj-cancel-2').addEventListener('click', closeProjModal);

btnProjSave.addEventListener('click', () => {
  if (projectModal.classList.contains('hidden')) return;
  const name = fProjName.value.trim();
  if (!name) return toast('Project name required', 'error');
  
  const newProj = { id: uid(), name };
  projects.push(newProj);
  activeProjectId = newProj.id;
  editingId = null;
  persistProjects();
  renderProjects();
  closeProjModal();
  toast('Project created', 'success');
});

/* ── Header Buttons ── */
document.getElementById('btn-refresh').addEventListener('click', () => {
  vscode.postMessage({ type: 'getAgents' });
  vscode.postMessage({ type: 'getModels' });
});
document.getElementById('btn-start-all').addEventListener('click', () => {
  let targetAgents;
  if (activeProjectId === GLOBAL_ID) {
    targetAgents = agents.filter(a => !a.projectId || a.projectId === GLOBAL_ID);
  } else {
    targetAgents = agents.filter(a => a.projectId === activeProjectId);
  }
  if (!targetAgents.length) return toast('No agents to start', '');
  toast('Starting agents...', '');
  targetAgents.forEach(a => {
    if (!a.running) vscode.postMessage({ type: 'startAgent', agent: a });
  });
});
document.getElementById('btn-stop-all').addEventListener('click', () => {
  let targetAgents;
  if (activeProjectId === GLOBAL_ID) {
    targetAgents = agents.filter(a => !a.projectId || a.projectId === GLOBAL_ID);
  } else {
    targetAgents = agents.filter(a => a.projectId === activeProjectId);
  }
  if (!targetAgents.length) return toast('No agents to stop', '');
  toast('Stopping agents...', '');
  targetAgents.forEach(a => {
    if (a.running) vscode.postMessage({ type: 'stopAgent', agentId: a.id });
  });
});

/* ══════════════════════════
   MESSAGE HANDLER
   ══════════════════════════ */
window.addEventListener('message', (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'currentWorkspace':
      currentWorkspace = msg.value;
      renderProjects();
      break;

    case 'projects':
      projects = msg.value || [];
      renderProjects();
      break;

    case 'models':
      models = msg.value || [];
      if (editingId) {
        renderAgents();
      }
      break;

    case 'agents':
      agents = msg.value || [];
      renderProjects();
      break;

    case 'agentStarted':
      if (msg.success) {
        const a = agents.find((x) => x.id === msg.agentId);
        if (a) {
          a.running = true;
          if (msg.port) a.port = msg.port;
        }
        renderAgents();
        toast('Agent started on port ' + msg.port, 'success');
      } else {
        renderAgents();
        toast(msg.error || 'Failed to start', 'error');
      }
      break;

    case 'agentStopped':
      if (msg.success) {
        const a = agents.find((x) => x.id === msg.agentId);
        if (a) a.running = false;
        renderAgents();
        toast('Agent stopped', 'success');
      } else {
        renderAgents();
        toast(msg.error || 'Failed to stop', 'error');
      }
      break;

    case 'toast':
      toast(msg.msg, msg.style);
      break;
  }
});
