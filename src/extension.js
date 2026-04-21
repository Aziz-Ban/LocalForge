const vscode = require('vscode');
const AgentViewProvider = require('./webviews/agentViewProvider');
const {
  createServer,
  destroyServer,
  destroyAll,
  isAgentRunning,
  getRunningAgents,
  serverEvents,
} = require('./services/server');
const { getAvailableModels } = require('./services/llmService');

const AGENTS_KEY = 'localforge.agents';
const PROJECTS_KEY = 'localforge.projects';

function activate(context) {
  const outputChannel = vscode.window.createOutputChannel('Local Forge');
  context.subscriptions.push(outputChannel);

  let agents = context.globalState.get(AGENTS_KEY, []);
  let projects = context.globalState.get(PROJECTS_KEY, []);
  let connections = context.globalState.get('localforge.connections', []);

  function saveAgents() {
    context.globalState.update(AGENTS_KEY, agents);
  }

  function saveProjects() {
    context.globalState.update(PROJECTS_KEY, projects);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getProjects', () => projects)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.saveProjects', (updatedProjects) => {
      projects = updatedProjects;
      saveProjects();
      return { success: true };
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getConnections', () => connections)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.saveConnections', (updatedConnections) => {
      connections = updatedConnections;
      context.globalState.update('localforge.connections', connections);
      return { success: true };
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.agentInput', async (data) => {
      const targetAgent = agents.find((a) => a.id === data.agentId);
      if (targetAgent && isAgentRunning(targetAgent.id)) {
        try {
          await fetch(`http://localhost:${targetAgent.port}/LocalForge/chat`, {
            method: 'POST',
            body: JSON.stringify({ prompt: data.input }),
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          console.error('Failed to route agent output:', e);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getCurrentWorkspace', () => {
      const folders = vscode.workspace.workspaceFolders;
      if (folders && folders.length > 0) {
        return { id: folders[0].uri.fsPath, name: folders[0].name, isWorkspace: true };
      }
      return null;
    })
  );

  const showApiInfo = (agent) => {
    outputChannel.clear();
    outputChannel.appendLine(`Agent: ${agent.name}`);
    outputChannel.appendLine(`URL:   http://localhost:${agent.port}/LocalForge/chat`);
    outputChannel.appendLine(`Method: POST`);
    outputChannel.appendLine('--------------------------------------------------');
    outputChannel.appendLine('Request Body (JSON):');
    const exampleBody = { prompt: 'Your prompt here...' };
    outputChannel.appendLine(JSON.stringify(exampleBody, null, 2));
    outputChannel.appendLine('--------------------------------------------------');
    outputChannel.appendLine('Expected Response (JSON):');
    outputChannel.appendLine(JSON.stringify({ result: 'The AI response text.' }, null, 2));
    outputChannel.appendLine('--------------------------------------------------');
    outputChannel.show();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.showApiInfo', (agent) => {
      if (agent) showApiInfo(agent);
    })
  );

  getAvailableModels().catch(console.error);

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getModels', async () => {
      return await getAvailableModels();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.startAgent', async (agent) => {
      try {
        const actualPort = await createServer(
          agent.id,
          agent.port,
          agent.modelId,
          agent.systemPrompt || undefined
        );
        return { success: true, port: actualPort };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.stopAgent', async (agentId) => {
      try {
        await destroyServer(agentId);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getAgents', () => {
      return agents.map((a) => ({ ...a, running: isAgentRunning(a.id) }));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.saveAgents', (updatedAgents) => {
      agents = updatedAgents;
      saveAgents();
      return { success: true };
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getRunningAgents', () => {
      return getRunningAgents();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.startAllAgents', async () => {
      let started = 0;
      for (const a of agents) {
        if (!isAgentRunning(a.id)) {
          try {
            await createServer(a.id, a.port, a.modelId, a.systemPrompt);
            started++;
          } catch (e) {
            console.error(`Failed to start agent ${a.name}:`, e);
          }
        }
      }
      return { success: true, count: started };
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.stopAllAgents', async () => {
      await destroyAll();
      return { success: true };
    })
  );

  const provider = new AgentViewProvider(context.extensionUri);

  // ── Agent activity log ──
  const agentLogs = {}; // agentId → [{ ts, input, output, status }]
  const MAX_LOGS = 50;

  serverEvents.on('requestReceived', (agentId, inputText) => {
    if (!agentLogs[agentId]) agentLogs[agentId] = [];
    agentLogs[agentId].push({
      ts: Date.now(),
      input: inputText ? inputText.substring(0, 500) : '',
      output: null,
      status: 'thinking',
    });
    // Keep only last N entries
    if (agentLogs[agentId].length > MAX_LOGS) agentLogs[agentId].shift();
    provider.broadcast({ type: 'agentLogUpdate', agentId, logs: agentLogs[agentId] });
  });

  serverEvents.on('activityStart', (agentId) => {
    provider.broadcast({ type: 'agentThinking', agentId });
  });

  serverEvents.on('activity', (agentId, preview) => {
    provider.broadcast({ type: 'agentActivity', agentId, preview: preview || '' });
  });

  serverEvents.on('responseComplete', (agentId, fullResponse) => {
    // Update the last log entry with the response
    if (agentLogs[agentId] && agentLogs[agentId].length) {
      const last = agentLogs[agentId][agentLogs[agentId].length - 1];
      if (last.status === 'thinking') {
        last.output = fullResponse ? fullResponse.substring(0, 500) : '';
        last.status = 'done';
        last.tsEnd = Date.now();
      }
    }
    provider.broadcast({ type: 'agentLogUpdate', agentId, logs: agentLogs[agentId] || [] });
  });

  // ── Agent-to-agent routing: when an agent completes, forward to connected agents ──
  const activeChains = new Set(); // prevent circular loops (A→B→A)

  serverEvents.on('responseComplete', async (fromAgentId, fullResponse) => {
    if (!fullResponse || !connections.length) return;

    // Prevent infinite loops: if this agent is already in an active chain, skip
    if (activeChains.has(fromAgentId)) {
      activeChains.delete(fromAgentId);
      return;
    }

    const downstream = connections.filter((c) => c.from === fromAgentId);
    for (const conn of downstream) {
      const targetAgent = agents.find((a) => a.id === conn.to);
      if (!targetAgent || !isAgentRunning(targetAgent.id)) continue;

      // Mark the target as being in an active chain to detect cycles
      activeChains.add(fromAgentId);

      try {
        fetch(`http://localhost:${targetAgent.port}/LocalForge/chat`, {
          method: 'POST',
          body: JSON.stringify({ prompt: fullResponse }),
          headers: { 'Content-Type': 'application/json' },
        })
          .then(() => {
            // Clean up after the downstream agent finishes
            setTimeout(() => activeChains.delete(fromAgentId), 1000);
          })
          .catch((e) => {
            activeChains.delete(fromAgentId);
            console.error(`Chain routing to ${targetAgent.name} failed:`, e);
          });
      } catch (e) {
        activeChains.delete(fromAgentId);
        console.error(`Chain routing to ${targetAgent.name} failed:`, e);
      }
    }
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.openChat', () => {
      vscode.commands.executeCommand('workbench.view.extension.smart-copilot-sidebar');
    })
  );
}

function deactivate() {
  return destroyAll();
}

module.exports = { activate, deactivate };
