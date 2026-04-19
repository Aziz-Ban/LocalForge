// @ts-nocheck
/* global LF, FlowChart, ListView */
/**
 * sidebar.js — Project sidebar rendering and modals.
 * Reads/writes LF.projects, LF.activeProjectId via window.LF.
 */

window.Sidebar = (() => {
  const projectListEl = () => document.getElementById('project-list');
  const activeProjectNameEl = () => document.getElementById('active-project-name');
  const sidebarEl = () => document.getElementById('project-sidebar');
  const backdropEl = () => document.getElementById('sidebar-backdrop');
  const projectModal = () => document.getElementById('project-modal');

  function open() {
    sidebarEl().classList.add('open');
    backdropEl().classList.remove('hidden');
    requestAnimationFrame(() => backdropEl().classList.add('visible'));
  }

  function close() {
    sidebarEl().classList.remove('open');
    backdropEl().classList.remove('visible');
    setTimeout(() => backdropEl().classList.add('hidden'), 200);
  }

  function openProjectModal() {
    close();
    document.getElementById('f-proj-name').value = '';
    projectModal().classList.remove('hidden');
    setTimeout(() => document.getElementById('f-proj-name').focus(), 150);
  }

  function closeProjectModal() {
    projectModal().classList.add('hidden');
  }

  // Check if any agent in a project is running
  function isProjectRunning(projectId) {
    const agents = projectId === LF.GLOBAL_ID
      ? LF.agents.filter(a => !a.projectId || a.projectId === LF.GLOBAL_ID)
      : LF.agents.filter(a => a.projectId === projectId);
    return agents.some(a => a.running);
  }

  // Start all agents in a project
  function startProject(projectId) {
    const agents = projectId === LF.GLOBAL_ID
      ? LF.agents.filter(a => (!a.projectId || a.projectId === LF.GLOBAL_ID) && !a.running)
      : LF.agents.filter(a => a.projectId === projectId && !a.running);
    agents.forEach(a => {
      LF.vscode.postMessage({ type: 'startAgent', agent: a });
    });
    if (agents.length) LF.toast('Starting ' + agents.length + ' agent' + (agents.length > 1 ? 's' : '') + '\u2026', 'success');
  }

  // Stop all agents in a project
  function stopProject(projectId) {
    const agents = projectId === LF.GLOBAL_ID
      ? LF.agents.filter(a => (!a.projectId || a.projectId === LF.GLOBAL_ID) && a.running)
      : LF.agents.filter(a => a.projectId === projectId && a.running);
    agents.forEach(a => {
      LF.vscode.postMessage({ type: 'stopAgent', agentId: a.id });
    });
    if (agents.length) LF.toast('Stopping ' + agents.length + ' agent' + (agents.length > 1 ? 's' : '') + '\u2026', 'success');
  }

  function renderProjects() {
    const list = projectListEl();
    list.innerHTML = '';

    // ── All Agents ──
    const globalCount = LF.agents.filter(
      (a) => !a.projectId || a.projectId === LF.GLOBAL_ID
    ).length;
    const globalRunning = isProjectRunning(LF.GLOBAL_ID);
    const globalItem = document.createElement('button');
    globalItem.className = 'sidebar-item' + (LF.activeProjectId === LF.GLOBAL_ID ? ' active' : '') + (globalRunning ? ' sidebar-running' : '');
    globalItem.innerHTML =
      '<svg class="sidebar-item-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' +
      '<span class="sidebar-item-text">All Agents</span>' +
      (globalRunning ? '<span class="sidebar-item-dot-live"></span>' : '') +
      (globalCount > 0 ? '<span class="sidebar-item-badge">' + globalCount + '</span>' : '');
    globalItem.addEventListener('click', () => {
      LF.activeProjectId = LF.GLOBAL_ID;
      LF.editingId = null;
      renderProjects();
      close();
    });
    list.appendChild(globalItem);

    // ── Section label ──
    if (LF.projects.length > 0) {
      const label = document.createElement('div');
      label.className = 'sidebar-section-label';
      label.textContent = 'Folders';
      list.appendChild(label);
    }

    // ── Folder items ──
    LF.projects.forEach((p) => {
      const count = LF.agents.filter((a) => a.projectId === p.id).length;
      const isActive = p.id === LF.activeProjectId;
      const running = isProjectRunning(p.id);
      const item = document.createElement('button');
      item.className = 'sidebar-item' + (isActive ? ' active' : '') + (running ? ' sidebar-running' : '');

      item.innerHTML =
        '<svg class="sidebar-item-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>' +
        '<span class="sidebar-item-text">' + LF.esc(p.name) + '</span>' +
        '<span class="sidebar-item-badge">' + (count > 0 ? count : '') + '</span>' +
        '<span class="sidebar-hover-actions">' +
          '<button class="sidebar-action-btn sidebar-play-btn" data-play-proj="' + p.id + '" title="' + (running ? 'Stop folder' : 'Run folder') + '">' +
            (running
              ? '<svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M6 6h12v12H6z"/></svg>'
              : '<svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>') +
          '</button>' +
          '<button class="sidebar-action-btn sidebar-del-btn" data-del-proj="' + p.id + '" title="Delete">' +
            '<svg viewBox="0 0 24 24" width="11" height="11"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
          '</button>' +
        '</span>';

      item.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar-action-btn')) return;
        LF.activeProjectId = p.id;
        LF.editingId = null;
        renderProjects();
        close();
      });
      list.appendChild(item);
    });

    // ── Play folder handlers ──
    list.querySelectorAll('.sidebar-play-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const projId = btn.dataset.playProj;
        if (isProjectRunning(projId)) {
          stopProject(projId);
        } else {
          startProject(projId);
        }
      });
    });

    // ── Delete folder handlers ──
    list.querySelectorAll('.sidebar-del-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const projId = btn.dataset.delProj;
        const proj = LF.projects.find((p) => p.id === projId);
        const n = LF.agents.filter((a) => a.projectId === projId).length;
        LF.showConfirm(
          'Delete "' + (proj ? proj.name : 'Folder') + '"?',
          'This will permanently delete this folder' +
            (n > 0 ? ' and its ' + n + ' agent' + (n > 1 ? 's' : '') : '') +
            '. This cannot be undone.',
          () => {
            LF.agents = LF.agents.filter((a) => a.projectId !== projId);
            LF.persistAgents();
            LF.projects = LF.projects.filter((p) => p.id !== projId);
            LF.persistProjects();
            if (LF.activeProjectId === projId) LF.activeProjectId = LF.GLOBAL_ID;
            renderProjects();
            LF.toast('Folder deleted', 'success');
          }
        );
      });
    });

    // ── Inline New Folder button ──
    const newBtn = document.createElement('button');
    newBtn.className = 'sidebar-new-inline';
    newBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><span>New Folder</span>';
    newBtn.addEventListener('click', openProjectModal);
    list.appendChild(newBtn);

    // Update header label
    if (LF.activeProjectId === LF.GLOBAL_ID) {
      activeProjectNameEl().textContent = 'All Agents';
    } else {
      const active = LF.projects.find((p) => p.id === LF.activeProjectId);
      activeProjectNameEl().textContent = active ? active.name : 'All Agents';
      if (!active) LF.activeProjectId = LF.GLOBAL_ID;
    }

    // Re-render active view
    if (LF.activeView === 'flowchart' && window.FlowChart) FlowChart.render();
    else if (window.ListView) ListView.render();
    
    LF.updateHeaderToggle();
  }

  // ── Wire DOM events ──
  document.getElementById('btn-sidebar-open').addEventListener('click', open);
  document.getElementById('btn-sidebar-close').addEventListener('click', close);
  document.getElementById('sidebar-backdrop').addEventListener('click', close);
  document.getElementById('btn-proj-cancel').addEventListener('click', closeProjectModal);
  document.getElementById('btn-proj-cancel-2').addEventListener('click', closeProjectModal);

  document.getElementById('btn-proj-save').addEventListener('click', () => {
    if (projectModal().classList.contains('hidden')) return;
    const name = document.getElementById('f-proj-name').value.trim();
    if (!name) return LF.toast('Folder name required', 'error');
    const newProj = { id: LF.uid(), name };
    LF.projects.push(newProj);
    LF.activeProjectId = newProj.id;
    LF.editingId = null;
    LF.persistProjects();
    renderProjects();
    closeProjectModal();
    LF.toast('Folder created', 'success');
  });

  return { renderProjects, open, close };
})();
