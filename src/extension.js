const vscode = require('vscode');
const ChatViewProvider = require('./webviews/chatViewProvider');
const { startServer, stopServer, isServerRunning } = require('./services/server');
const { getAvailableModels } = require('./services/llmService');

function activate(context) {
  vscode.window.showInformationMessage('LocalForge activated');

  const outputChannel = vscode.window.createOutputChannel('LocalForge API');
  context.subscriptions.push(outputChannel);

  const showApiInfo = (port) => {
    outputChannel.clear();
    outputChannel.appendLine(`URL: http://localhost:${port}/LocalForge/chat`);
    outputChannel.appendLine(' Method: POST');
    outputChannel.appendLine('--------------------------------------------------');
    outputChannel.appendLine('Request Body (JSON):');
    outputChannel.appendLine(
      JSON.stringify(
        {
          prompt: 'Your prompt here...',
        },
        null,
        2
      )
    );
    outputChannel.appendLine('--------------------------------------------------');
    outputChannel.appendLine('Expected Response (JSON):');
    outputChannel.appendLine(
      JSON.stringify(
        {
          result: 'The refined or generated response text.',
        },
        null,
        2
      )
    );
    outputChannel.appendLine('--------------------------------------------------');
    outputChannel.show();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.showApiInfo', (port) => {
      showApiInfo(port || 6009);
    })
  );

  getAvailableModels().catch(console.error);
  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.startServer', async (port, modelId) => {
      try {
        const actualPort = await startServer(port, modelId);

        vscode.window
          .showInformationMessage(
            `LocalForge Server started on port ${actualPort}`,
            'Show API Usage'
          )
          .then((selection) => {
            if (selection === 'Show API Usage') {
              showApiInfo(actualPort);
            }
          });

        return { success: true, port: actualPort };
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to start server: ${err.message}`);
        return { success: false, error: err.message };
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.stopServer', async () => {
      try {
        await stopServer();
        vscode.window.showInformationMessage('LocalForge Server stopped');
        return { success: true };
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to stop server: ${err.message}`);
        return { success: false, error: err.message };
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getModels', async () => {
      const models = await getAvailableModels();
      return models;
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('smart-copilot.getServerStatus', () => {
      return { running: isServerRunning() };
    })
  );

  const provider = new ChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  let disposable = vscode.commands.registerCommand('smart-copilot.openChat', () => {
    vscode.commands.executeCommand('workbench.view.extension.smart-copilot-sidebar');
  });

  context.subscriptions.push(disposable);
}

function deactivate() {
  return stopServer();
}

module.exports = {
  activate,
  deactivate,
};
