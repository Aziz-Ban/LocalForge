const vscode = require('vscode');

class AgentViewProvider {
  static viewType = 'smart-copilot.agentView';

  constructor(extensionUri) {
    this._extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getModels': {
          const models = await vscode.commands.executeCommand('smart-copilot.getModels');
          webviewView.webview.postMessage({ type: 'models', value: models });
          break;
        }
        case 'getAgents': {
          const agents = await vscode.commands.executeCommand('smart-copilot.getAgents');
          webviewView.webview.postMessage({ type: 'agents', value: agents });
          break;
        }
        case 'saveAgents': {
          await vscode.commands.executeCommand('smart-copilot.saveAgents', data.value);
          break;
        }
        case 'getProjects': {
          const projects = await vscode.commands.executeCommand('smart-copilot.getProjects');
          webviewView.webview.postMessage({ type: 'projects', value: projects });
          break;
        }
        case 'saveProjects': {
          await vscode.commands.executeCommand('smart-copilot.saveProjects', data.value);
          break;
        }
        case 'getCurrentWorkspace': {
          const workspace = await vscode.commands.executeCommand('smart-copilot.getCurrentWorkspace');
          webviewView.webview.postMessage({ type: 'currentWorkspace', value: workspace });
          break;
        }
        case 'startAgent': {
          const result = /** @type {{success:boolean, port?:number, error?:string}} */ (
            await vscode.commands.executeCommand('smart-copilot.startAgent', data.agent)
          );
          webviewView.webview.postMessage({
            type: 'agentStarted',
            agentId: data.agent.id,
            success: result.success,
            port: result.port,
            error: result.error,
          });
          break;
        }
        case 'stopAgent': {
          const result = /** @type {{success:boolean, error?:string}} */ (
            await vscode.commands.executeCommand('smart-copilot.stopAgent', data.agentId)
          );
          webviewView.webview.postMessage({
            type: 'agentStopped',
            agentId: data.agentId,
            success: result.success,
            error: result.error,
          });
          break;
        }
        case 'showApiInfo': {
          await vscode.commands.executeCommand('smart-copilot.showApiInfo', data.agent);
          break;
        }
        case 'startAllAgents': {
          const result = /** @type {{success:boolean, count:number}} */ (
            await vscode.commands.executeCommand('smart-copilot.startAllAgents')
          );
          const agents = await vscode.commands.executeCommand('smart-copilot.getAgents');
          webviewView.webview.postMessage({ type: 'agents', value: agents });
          webviewView.webview.postMessage({
            type: 'toast',
            msg: 'Started ' + result.count + ' agents',
            style: 'success',
          });
          break;
        }
        case 'stopAllAgents': {
          await vscode.commands.executeCommand('smart-copilot.stopAllAgents');
          const agents = await vscode.commands.executeCommand('smart-copilot.getAgents');
          webviewView.webview.postMessage({ type: 'agents', value: agents });
          webviewView.webview.postMessage({
            type: 'toast',
            msg: 'All agents stopped',
            style: 'success',
          });
          break;
        }
      }
    });
  }

  broadcast(message) {
    if (this._view && this._view.webview) {
      this._view.webview.postMessage(message);
    }
  }

  _getHtmlForWebview(webview) {
    const fs = require('fs');
    const htmlPath = vscode.Uri.joinPath(
      this._extensionUri,
      'src',
      'webviews',
      'template.html'
    ).fsPath;
    let html = fs.readFileSync(htmlPath, 'utf8');

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'styles.css')
    );
    const mainJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'main.js')
    );
    const sidebarJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'sidebar.js')
    );
    const listViewJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'list-view.js')
    );
    const flowchartJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'src', 'webviews', 'flowchart.js')
    );

    html = html.replace(/{{cspSource}}/g, webview.cspSource);
    html = html.replace(/{{cssUri}}/g, cssUri);
    html = html.replace(/{{mainJsUri}}/g, mainJsUri);
    html = html.replace(/{{sidebarJsUri}}/g, sidebarJsUri);
    html = html.replace(/{{listViewJsUri}}/g, listViewJsUri);
    html = html.replace(/{{flowchartJsUri}}/g, flowchartJsUri);

    return html;
  }
}

module.exports = AgentViewProvider;
