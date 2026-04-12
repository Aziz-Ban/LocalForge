// @ts-nocheck
/* global LF */
/**
 * list-view.js — Agent list rendering with inline editing.
 * Uses window.LF shared state.
 */

window.ListView = (() => {
  const listEl = () => document.getElementById('agent-list');
  const emptyEl = () => document.getElementById('empty');

  /* ── Form HTML builder ── */
  function formHtml(agentId, name, port, modelId, sysPrompt) {
    const checked = !!sysPrompt;
    let opts = '';
    if (LF.models.length) {
      LF.models.forEach((m) => {
        opts +=
          '<option value="' +
          m.family +
          '"' +
          (m.family === modelId ? ' selected' : '') +
          '>' +
          LF.esc(m.name) +
          '</option>';
      });
    } else {
      opts = '<option disabled selected>No models</option>';
    }

    const h = [];
    h.push('<div class="form-panel" style="margin-bottom:10px">');
    h.push('  <div class="fc-head">');
    h.push('    <span>' + (agentId === 'new' ? 'New Agent' : 'Edit Agent') + '</span>');
    h.push(
      '    <button class="ib btn-in-cancel" title="Cancel"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>'
    );
    h.push('  </div>');
    h.push('  <div class="fc-body">');
    h.push('    <div class="field"><label>Agent Name</label>');
    h.push(
      '      <input type="text" id="fn-' +
        agentId +
        '" value="' +
        LF.esc(name) +
        '" placeholder="e.g. Code Reviewer" autocomplete="off" /></div>'
    );
    h.push('    <div class="field"><label>Model &amp; Port</label><div class="row">');
    h.push('      <select id="fm-' + agentId + '">' + opts + '</select>');
    h.push(
      '      <input type="number" id="fp-' +
        agentId +
        '" value="' +
        port +
        '" min="1024" max="65535" /></div></div>'
    );
    h.push('    <div class="field"><label class="tgl">');
    h.push(
      '      <input type="checkbox" id="fchk-' + agentId + '" ' + (checked ? 'checked' : '') + ' />'
    );
    h.push('      <span class="tgl-text">System Prompt</span></label>');
    h.push('      <div class="slide ' + (checked ? 'open' : '') + '" id="fsl-' + agentId + '">');
    h.push(
      '        <textarea id="fx-' +
        agentId +
        '" class="ctx" placeholder="e.g. You are a senior engineer.">' +
        LF.esc(sysPrompt) +
        '</textarea>'
    );
    h.push('      </div></div>');
    h.push('    <div class="btn-row">');
    h.push('      <button class="btn btn-ghost btn-in-cancel">Cancel</button>');
    h.push(
      '      <button class="btn btn-in-save" data-sid="' +
        agentId +
        '">' +
        (agentId === 'new' ? 'Create Agent' : 'Save Changes') +
        '</button>'
    );
    h.push('    </div>');
    h.push('  </div>');
    h.push('</div>');
    return h.join('\n');
  }

  function attachCheckbox(container, agentId) {
    const chk = container.querySelector('#fchk-' + agentId);
    const slide = container.querySelector('#fsl-' + agentId);
    if (chk && slide) {
      chk.addEventListener('change', () => slide.classList.toggle('open', chk.checked));
    }
  }

  /* ── Render ── */
  function render() {
    const el = listEl();
    if (!el) return;
    el.innerHTML = '';

    const visible =
      LF.activeProjectId === LF.GLOBAL_ID
        ? LF.agents.filter((a) => !a.projectId || a.projectId === LF.GLOBAL_ID)
        : LF.agents.filter((a) => a.projectId === LF.activeProjectId);

    emptyEl().style.display = visible.length === 0 && LF.editingId !== 'new' ? 'block' : 'none';

    // New-agent form at top
    if (LF.editingId === 'new') {
      const d = document.createElement('div');
      d.innerHTML = formHtml('new', '', LF.nextPort(), '', '');
      el.appendChild(d);
      attachCheckbox(d, 'new');
    }

    // Agent cards
    visible.forEach((a) => {
      const isOn = !!a.running;
      const card = document.createElement('div');

      if (LF.editingId === a.id) {
        card.innerHTML = formHtml(a.id, a.name, a.port, a.modelId, a.systemPrompt);
        el.appendChild(card);
        attachCheckbox(card, a.id);
      } else {
        card.className = 'ag' + (isOn ? ' running' : '');
        card.id = 'ag-card-' + a.id;
        card.innerHTML =
          '<div class="ag-top">' +
          '<div class="ag-dot ' +
          (isOn ? 'on' : 'off') +
          '"></div>' +
          '<div class="ag-info">' +
          '<div class="ag-name" title="' +
          LF.esc(a.name) +
          '">' +
          LF.esc(a.name) +
          '</div>' +
          '<div class="ag-sub">Port ' +
          a.port +
          ' · ' +
          LF.esc(a.modelId || 'default') +
          '</div>' +
          '</div>' +
          '<div class="ag-actions">' +
          (isOn
            ? '<button class="ab st" data-stop="' +
              a.id +
              '">Stop</button><button class="ab" data-info="' +
              a.id +
              '">ℹ</button>'
            : '<button class="ab go" data-start="' +
              a.id +
              '">Start</button><button class="ab" data-edit="' +
              a.id +
              '">✎</button><button class="ab del" data-del="' +
              a.id +
              '">✕</button>') +
          '</div></div>' +
          '<div class="ag-ep">' +
          '<code>http://localhost:' +
          a.port +
          '/LocalForge/chat</code>' +
          '<button class="cp" data-copy="http://localhost:' +
          a.port +
          '/LocalForge/chat">Copy</button>' +
          '</div>';
        el.appendChild(card);
      }
    });

    // Inline "+ New Agent" button
    if (LF.editingId !== 'new') {
      const btn = document.createElement('button');
      btn.className = 'agent-new-btn';
      btn.dataset.newAgent = 'true';
      btn.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><span>New Agent</span>';
      el.appendChild(btn);
    }
  }

  /* ── Event delegation ── */
  document.getElementById('agent-list').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;

    if (t.dataset.newAgent) {
      LF.editingId = 'new';
      render();
      setTimeout(() => {
        const el = document.getElementById('fn-new');
        if (el) el.focus();
      }, 50);
    }

    if (t.dataset.start) {
      const a = LF.agents.find((x) => x.id === t.dataset.start);
      if (a) {
        t.textContent = '…';
        t.disabled = true;
        LF.vscode.postMessage({ type: 'startAgent', agent: a });
      }
    }

    if (t.dataset.stop) {
      t.textContent = '…';
      t.disabled = true;
      LF.vscode.postMessage({ type: 'stopAgent', agentId: t.dataset.stop });
    }

    if (t.dataset.info) {
      const a = LF.agents.find((x) => x.id === t.dataset.info);
      if (a) LF.vscode.postMessage({ type: 'showApiInfo', agent: a });
    }

    if (t.dataset.edit) {
      LF.editingId = t.dataset.edit;
      render();
    }

    if (t.dataset.del) {
      const a = LF.agents.find((x) => x.id === t.dataset.del);
      LF.showConfirm(
        'Delete "' + (a ? a.name : 'Agent') + '"?',
        'This agent will be permanently removed.',
        () => {
          LF.agents = LF.agents.filter((x) => x.id !== t.dataset.del);
          LF.persistAgents();
          render();
          LF.toast('Agent removed', 'success');
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

    if (t.classList.contains('btn-in-cancel')) {
      LF.editingId = null;
      render();
    }

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
        LF.toast('Agent name is required', 'error');
        nameEl.focus();
        return;
      }
      const port = parseInt(portEl.value);
      if (!port || port < 1024 || port > 65535) {
        LF.toast('Port must be 1024-65535', 'error');
        portEl.focus();
        return;
      }

      const modelId = modelEl.value;
      const systemPrompt = chkEl && chkEl.checked && ctxEl ? ctxEl.value.trim() : '';

      if (sid === 'new') {
        const projId = LF.activeProjectId === LF.GLOBAL_ID ? '' : LF.activeProjectId;
        LF.agents.push({
          id: LF.uid(),
          projectId: projId,
          name,
          port,
          modelId,
          systemPrompt,
          running: false,
        });
        LF.toast('Agent created', 'success');
      } else {
        const idx = LF.agents.findIndex((a) => a.id === sid);
        if (idx >= 0) LF.agents[idx] = { ...LF.agents[idx], name, port, modelId, systemPrompt };
        LF.toast('Agent updated', 'success');
      }

      LF.editingId = null;
      LF.persistAgents();
      render();
    }
  });

  return { render };
})();
