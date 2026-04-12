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
    if (agent.systemPrompt) {
      exampleBody.systemPrompt = agent.systemPrompt;
    }
    outputChannel.appendLine(JSON.stringify(exampleBody, null, 2));
    outputChannel.appendLine('--------------------------------------------------');
    outputChannel.appendLine('Expected Response (JSON):');
    outputChannel.appendLine(JSON.stringify({ result: 'The AI response text.' }, null, 2));
    if (agent.systemPrompt) {
      outputChannel.appendLine('--------------------------------------------------');
      outputChannel.appendLine('Default System Prompt (Context):');
      outputChannel.appendLine(agent.systemPrompt);
    }
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

  serverEvents.on('activityStart', (agentId) => {
    provider.broadcast({ type: 'agentThinking', agentId });
  });

  serverEvents.on('activity', (agentId, preview) => {
    provider.broadcast({ type: 'agentActivity', agentId, preview: preview || '' });
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
