const { refinePrompt } = require("../services/promptRefiner");
const vscode = require("vscode");

class ChatViewProvider {
  static viewType = "smart-copilot.chatView";

  constructor(extensionUri) {
    this._extensionUri = extensionUri;
    this._history = [];
    this._serverRunning = false;
    this._currentPort = 6009;
    this._currentModel = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    setTimeout(() => {
      this._restoreState();
    }, 100);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "userPrompt":
          console.log("Main received:", data.value);
          await this.handleUserPrompt(data.value, data.systemPrompt);
          break;
        case "getModels":
          const models = await vscode.commands.executeCommand(
            "smart-copilot.getModels",
          );
          webviewView.webview.postMessage({ type: "models", value: models });
          break;
        case "checkServerStatus":
          const status = await vscode.commands.executeCommand(
            "smart-copilot.getServerStatus",
          );
          if (status && status.running !== this._serverRunning) {
            this._serverRunning = status.running;
            webviewView.webview.postMessage({
              type: "serverStatus",
              running: this._serverRunning,
              port: this._currentPort,
            });
          }
          break;
        case "startServer":
          const result = /** @type {{success: boolean, port: number}} */ (
            await vscode.commands.executeCommand(
              "smart-copilot.startServer",
              parseInt(data.port),
              data.modelId,
            )
          );
          if (result.success) {
            this._serverRunning = true;
            this._currentPort = result.port;
            this._currentModel = data.modelId;
          }
          webviewView.webview.postMessage({
            type: "serverStatus",
            running: result.success,
            port: result.port,
          });
          this._saveState();
          break;
        case "stopServer":
          await vscode.commands.executeCommand("smart-copilot.stopServer");
          this._serverRunning = false;
          webviewView.webview.postMessage({
            type: "serverStatus",
            running: false,
          });
          this._saveState();
          break;
        case "showApiInfo":
          await vscode.commands.executeCommand(
            "smart-copilot.showApiInfo",
            parseInt(data.port),
          );
          break;
        case "clearHistory":
          this._history = [];
          this._saveState();
          break;
        case "saveMessage":
          if (data.role && data.content) {
            this._saveState();
          }
          break;
      }
    });
  }

  _saveState() {
    if (!this._view) return;

    const state = {
      history: this._history,
      serverRunning: this._serverRunning,
      currentPort: this._currentPort,
      currentModel: this._currentModel,
    };

    this._view.webview.postMessage({ type: "saveState", state: state });
  }

  _restoreState() {
    if (!this._view) return;

    const state = {
      history: this._history,
      serverRunning: this._serverRunning,
      currentPort: this._currentPort,
      currentModel: this._currentModel,
    };

    this._view.webview.postMessage({ type: "restoreState", state: state });
  }

  async handleUserPrompt(prompt, systemPrompt) {
    if (!this._view) {
      return;
    }

    this._history.push({ role: "user", content: prompt });
    this._saveState();
    this._view.webview.postMessage({ type: "status", value: "Processing..." });

    try {
      const response = await refinePrompt(
        this._history,
        undefined,
        systemPrompt,
      );

      if (response.type === "question") {
        this._history.push({ role: "assistant", content: response.text });
        this._saveState();
        this._view.webview.postMessage({
          type: "question",
          value: response.text,
          options: response.options || [],
        });
      } else {
        this._saveState();
        this._view.webview.postMessage({
          type: "refined",
          value: response.text,
        });
      }
    } catch (error) {
      this._view.webview.postMessage({ type: "error", value: error.message });
    }
  }

  _getHtmlForWebview() {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                :root {
                    --primary-color: #0084ff;
                    --primary-hover: #0078eb;
                    --success-color: #238636;
                    --danger-color: #f85149;
                    --bg-color: transparent;
                    --text-color: var(--vscode-foreground);
                    --border-color: var(--vscode-widget-border);
                    --input-bg: var(--vscode-input-background);
                    --input-fg: var(--vscode-input-foreground);
                    --msg-user-bg: #0084ff;
                    --msg-user-fg: #ffffff;
                    --msg-bot-bg: var(--vscode-editor-inactiveSelectionBackground);
                    --msg-bot-fg: var(--vscode-editor-foreground);
                }

                * { box-sizing: border-box; }

                body { 
                    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
                    padding: 0;
                    margin: 0;
                    display: flex; 
                    flex-direction: column; 
                    height: 100vh; 
                    overflow: hidden;
                    background-color: var(--vscode-editor-background);
                    color: var(--text-color);
                }

                header {
                    padding: 12px 16px;
                    background: var(--vscode-sideBar-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    height: 54px;
                    flex-shrink: 0;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .header-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .status-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 11px;
                    font-weight: 600;
                    padding: 6px 12px;
                    border-radius: 20px;
                    background: rgba(128, 128, 128, 0.1);
                    color: var(--vscode-descriptionForeground);
                    transition: all 0.3s ease;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #999;
                    transition: background-color 0.3s;
                }

                .status-active { 
                    color: var(--success-color); 
                    background: rgba(35, 134, 54, 0.1); 
                    border: 1px solid rgba(35, 134, 54, 0.2);
                }
                .status-active .status-dot { 
                    background-color: var(--success-color); 
                    box-shadow: 0 0 0 0 rgba(35, 134, 54, 0.7);
                    animation: pulse-green 2s infinite;
                }

                @keyframes pulse-green {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(35, 134, 54, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(35, 134, 54, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(35, 134, 54, 0); }
                }

                .icon-btn {
                    background: none;
                    border: none;
                    color: var(--vscode-icon-foreground);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .icon-btn:hover { background: rgba(128, 128, 128, 0.1); color: var(--vscode-foreground); }
                .icon-btn svg { width: 22px; height: 22px; fill: currentColor; transition: transform 0.5s ease; }
                
                #toggle-server-btn:hover svg { transform: rotate(90deg); }
                #toggle-server-btn.active svg { transform: rotate(180deg); color: var(--primary-color); }
                #toggle-server-btn.active { background: rgba(0, 132, 255, 0.1); }
                
                #new-chat-btn:hover svg { transform: scale(1.1); }

                .server-panel-wrapper {
                    overflow: hidden;
                    transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
                    max-height: 500px;
                    opacity: 1;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background: var(--vscode-sideBar-background);
                }

                .server-panel-wrapper.collapsed {
                    max-height: 0;
                    opacity: 0;
                    border-bottom: none;
                }

                .server-panel {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                label {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--vscode-descriptionForeground);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .input-row {
                    display: flex;
                    gap: 10px;
                }

                input, select, textarea {
                    background: var(--input-bg);
                    color: var(--input-fg);
                    border: 1px solid var(--vscode-input-border, transparent);
                    border-radius: 6px;
                    padding: 10px;
                    font-size: 13px;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.2s;
                }
                input:focus, select:focus, textarea:focus {
                    border-color: var(--vscode-focusBorder);
                }

                select { flex: 1; cursor: pointer; }
                input[type="number"] { width: 80px; }

                .toggle-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                    cursor: pointer;
                    user-select: none;
                }
                .toggle-row input { margin: 0; width: 16px; height: 16px; }

                .system-prompt-area {
                    display: none;
                    margin-top: 4px;
                }
                .system-prompt-area.visible {
                    display: block;
                    animation: slideDown 0.3s ease;
                }
                
                textarea.system-input {
                    width: 100%;
                    height: 80px;
                    resize: vertical;
                }

                .actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 8px;
                }

                .btn {
                    flex: 1;
                    padding: 10px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    font-size: 13px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .btn:active { transform: scale(0.98); }

                .btn-primary { 
                    background: var(--success-color); 
                    color: white; 
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .btn-primary:hover { 
                    background: var(--success-hover, #2ea043); 
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }
                .btn-primary:disabled { 
                    opacity: 0.6; 
                    cursor: not-allowed; 
                    transform: none; 
                    box-shadow: none;
                }

                .btn-danger { background: var(--danger-color); color: white; }
                .btn-danger:hover { opacity: 0.9; }

                .btn-icon { 
                    flex: 0 0 40px; 
                    padding: 0; 
                    background: var(--primary-color); 
                    color: white; 
                    border-radius: 6px;
                }
                .btn-icon:hover { background: var(--primary-hover); }

                #chat-container {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    scroll-behavior: smooth;
                }

                .message-wrapper {
                    display: flex;
                    flex-direction: column;
                    max-width: 85%;
                    animation: messageSlide 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                }

                @keyframes messageSlide {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .message-wrapper.user {
                    align-self: flex-end;
                    align-items: flex-end;
                }
                .message-wrapper.assistant {
                    align-self: flex-start;
                    align-items: flex-start;
                }
                .message-wrapper.error {
                    align-self: center;
                }

                .message-bubble {
                    padding: 12px 16px;
                    font-size: 14px;
                    line-height: 1.5;
                    word-wrap: break-word;
                    position: relative;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                .user .message-bubble {
                    background-color: var(--msg-user-bg);
                    color: var(--msg-user-fg);
                    border-radius: 18px 18px 4px 18px;
                }

                .assistant .message-bubble {
                    background-color: var(--msg-bot-bg);
                    color: var(--msg-bot-fg);
                    border-radius: 18px 18px 18px 4px;
                    border: 1px solid var(--vscode-widget-border);
                }

                .error .message-bubble {
                    background-color: rgba(248, 81, 73, 0.1);
                    color: var(--danger-color);
                    border: 1px solid var(--danger-color);
                    border-radius: 12px;
                }

                .input-container {
                    padding: 16px 20px;
                    background: var(--vscode-editor-background);
                }

                .chat-input-wrapper {
                    flex: 1;
                    background: var(--input-bg);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 24px;
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                .chat-input-wrapper:focus-within {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 2px rgba(0, 132, 255, 0.2);
                }

                .chat-input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--input-fg);
                    font-size: 14px;
                    padding: 0;
                    outline: none;
                }

                .send-icon-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--primary-color);
                    padding: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.9;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .send-icon-btn:hover { opacity: 1; transform: scale(1.1) rotate(-10deg); }
                .send-icon-btn svg { width: 22px; height: 22px; fill: currentColor; }

                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.3); border-radius: 3px; }
            </style>
        </head>
        <body>
            <header>
                <div class="header-left">
                    <div id="status-badge" class="status-badge">
                        <div class="status-dot"></div>
                        <span id="status-text">Stopped</span>
                    </div>
                </div>
                <div class="header-right">
                    <button id="new-chat-btn" class="icon-btn" title="New Chat">
                        <svg viewBox="0 0 24 24"><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29m-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>
                    </button>
                    <button id="toggle-server-btn" class="icon-btn" title="Settings">
                        <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84a.484.484 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0 .59-.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.27.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
                    </button>
                </div>
            </header>
            
            <div id="server-panel" class="server-panel-wrapper collapsed">
                <div class="server-panel">
                    <div class="control-group">
                        <label>AI Model</label>
                        <div class="input-row">
                            <select id="model-select">
                                <option value="" disabled selected>Loading...</option>
                            </select>
                            <input type="number" id="port-input" placeholder="Port" value="6009" title="Port" />
                        </div>
                    </div>

                    <div class="control-group">
                        <label class="toggle-row">
                            <input type="checkbox" id="chk-custom-prompt">
                            Custom System Prompt
                        </label>
                        <div id="system-prompt-container" class="system-prompt-area">
                            <textarea id="system-prompt-input" class="system-input" placeholder="e.g. You are a senior engineer..."></textarea>
                        </div>
                    </div>
                    
                    <div class="actions">
                        <button id="btn-start" class="btn btn-primary" disabled>
                            <span>▶ Start Server</span>
                        </button>
                        <div id="btn-stop-group" style="display:none; flex:1; gap:8px;">
                            <button id="btn-stop" class="btn btn-danger" style="flex:1">
                                <span>⏹ Stop</span>
                            </button>
                            <button id="btn-info" class="btn btn-icon" title="API Info">
                                <svg viewBox="0 0 24 24" style="width:20px;height:20px;"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="chat-container">
                <div id="welcome-msg" style="text-align: center; margin-top: 40px; opacity: 0.4; display:flex; flex-direction:column; align-items:center; gap:10px;">
                    <svg viewBox="0 0 24 24" style="width:48px;height:48px;fill:currentColor;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 14H6l-2 2V4h16v12z"/></svg>
                    <span style="font-size:13px; font-weight:500;">LocalForge</span>
                </div>
            </div>

            <div class="input-container">
                <div class="chat-input-wrapper">
                    <input type="text" id="prompt-input" class="chat-input" placeholder="Type a message to refine..." autocomplete="off" />
                    <button id="send-btn" class="send-icon-btn" title="Send">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const previousState = vscode.getState() || {};
                
                const chat = document.getElementById('chat-container');
                const inp = document.getElementById('prompt-input');
                const btnSend = document.getElementById('send-btn');
                
                const serverPanel = document.getElementById('server-panel');
                const btnToggleServer = document.getElementById('toggle-server-btn');
                const btnNewChat = document.getElementById('new-chat-btn');
                
                const btnStart = document.getElementById('btn-start');
                const btnStopGroup = document.getElementById('btn-stop-group');
                const btnStop = document.getElementById('btn-stop');
                const btnInfo = document.getElementById('btn-info');
                
                const portInp = document.getElementById('port-input');
                const modelSel = document.getElementById('model-select');
                const statusBadge = document.getElementById('status-badge');
                const statusText = document.getElementById('status-text');

                const chkCustom = document.getElementById('chk-custom-prompt');
                const divSystem = document.getElementById('system-prompt-container');
                const txtSystem = document.getElementById('system-prompt-input');

                let isServerRunning = false;
                let chatMessages = [];

                vscode.postMessage({ type: 'getModels' });
                vscode.postMessage({ type: 'checkServerStatus' });
                
                // Restore from VS Code state
                if (previousState.chatMessages) {
                    chatMessages = previousState.chatMessages;
                    restoreChatMessages();
                }
                if (previousState.serverRunning) {
                    isServerRunning = previousState.serverRunning;
                    updateStatus('Active: Port ' + (previousState.currentPort || 6009), true);
                }
                if (previousState.currentPort) {
                    portInp.value = previousState.currentPort;
                }
                if (previousState.currentModel) {
                    setTimeout(() => {
                        if (modelSel.querySelector('option[value="' + previousState.currentModel + '"]')) {
                            modelSel.value = previousState.currentModel;
                        }
                    }, 100);
                }
                
                inp.focus();

                function restoreChatMessages() {
                    const welcome = document.getElementById('welcome-msg');
                    if (welcome) welcome.remove();
                    
                    chatMessages.forEach(msg => {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'message-wrapper ' + msg.type;
                        
                        const bubble = document.createElement('div');
                        bubble.className = 'message-bubble';
                        bubble.textContent = msg.text;
                        
                        wrapper.appendChild(bubble);
                        chat.appendChild(wrapper);
                    });
                    chat.scrollTop = chat.scrollHeight;
                }

                // New Chat
                btnNewChat.onclick = () => {
                   chat.innerHTML = '<div id="welcome-msg" style="text-align: center; margin-top: 40px; opacity: 0.4; display:flex; flex-direction:column; align-items:center; gap:10px;">' +
                        '<svg viewBox="0 0 24 24" style="width:48px;height:48px;fill:currentColor;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 14H6l-2 2V4h16v12z"/></svg>' +
                        '<span style="font-size:13px; font-weight:500;">LocalForge</span>' +
                    '</div>';
                   chatMessages = [];
                   vscode.setState({ ...vscode.getState(), chatMessages: [] });
                   vscode.postMessage({ type: 'clearHistory' });
                };

                btnToggleServer.onclick = () => {
                   const collapsed = serverPanel.classList.toggle('collapsed');
                   btnToggleServer.classList.toggle('active', !collapsed);
                };

                chkCustom.onchange = () => {
                    if (chkCustom.checked) {
                        divSystem.classList.add('visible');
                        txtSystem.focus();
                    } else {
                        divSystem.classList.remove('visible');
                    }
                };

                btnStart.onclick = () => {
                    const port = portInp.value;
                    const modelId = modelSel.value;
                    vscode.postMessage({ type: 'startServer', port: port, modelId: modelId });
                    updateStatus('Starting...', false);
                };

                btnStop.onclick = () => {
                   vscode.postMessage({ type: 'stopServer' });
                };

                btnInfo.onclick = () => {
                    vscode.postMessage({ type: 'showApiInfo', port: portInp.value });
                };

                function updateStatus(text, running) {
                    statusText.textContent = text;
                    if (running) {
                        statusBadge.classList.add('status-active');
                        btnStart.style.display = 'none';
                        btnStopGroup.style.display = 'flex';
                        portInp.disabled = true;
                        modelSel.disabled = true;
                        
                        serverPanel.classList.add('collapsed');
                        btnToggleServer.classList.remove('active');
                    } else {
                        statusBadge.classList.remove('status-active');
                        btnStart.style.display = 'flex';
                        btnStopGroup.style.display = 'none';
                        
                        if (text.includes('Stop')) { 
                            portInp.disabled = false;
                            modelSel.disabled = false;
                            serverPanel.classList.remove('collapsed');
                            btnToggleServer.classList.add('active');
                        }
                    }
                }

                function addMsg(text, type) {
                    const welcome = document.getElementById('welcome-msg');
                    if (welcome) welcome.remove();

                    const wrapper = document.createElement('div');
                    wrapper.className = 'message-wrapper ' + type;
                    
                    const bubble = document.createElement('div');
                    bubble.className = 'message-bubble';
                    bubble.textContent = text;
                    
                    wrapper.appendChild(bubble);
                    chat.appendChild(wrapper);
                    chat.scrollTop = chat.scrollHeight;
                    
                    chatMessages.push({ text, type });
                    vscode.setState({ 
                        ...vscode.getState(), 
                        chatMessages: chatMessages 
                    });
                }

                function sendMessage() {
                    const val = inp.value.trim();
                    if (!val) return;
                    
                    addMsg(val, 'user');
                    
                    const systemPrompt = chkCustom.checked ? txtSystem.value.trim() : null;
                    vscode.postMessage({ type: 'userPrompt', value: val, systemPrompt: systemPrompt });
                    inp.value = '';
                }

                btnSend.onclick = sendMessage;
                inp.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

                window.addEventListener('message', event => {
                    const msg = event.data;

                    switch (msg.type) {
                        case 'saveState':
                            if (msg.state) {
                                vscode.setState({
                                    ...vscode.getState(),
                                    serverRunning: msg.state.serverRunning,
                                    currentPort: msg.state.currentPort,
                                    currentModel: msg.state.currentModel
                                });
                            }
                            break;
                            
                        case 'restoreState':
                            if (msg.state) {
                                if (msg.state.serverRunning) {
                                    isServerRunning = true;
                                    updateStatus('Active: Port ' + msg.state.currentPort, true);
                                }
                                if (msg.state.currentPort) {
                                    portInp.value = msg.state.currentPort;
                                }
                            }
                            break;
                            
                        case 'models':
                            modelSel.innerHTML = '';
                            if (msg.value && msg.value.length) {
                                msg.value.forEach(m => {
                                    const opt = document.createElement('option');
                                    opt.value = m.family;
                                    opt.textContent = m.name;
                                    modelSel.appendChild(opt);
                                });
                            } else {
                                const opt = document.createElement('option');
                                opt.textContent = 'No models found';
                                modelSel.appendChild(opt);
                            }
                            btnStart.disabled = false;
                            break;

                        case 'serverStatus':
                            isServerRunning = msg.running;
                            if (isServerRunning) {
                                updateStatus('Active: Port ' + msg.port, true);
                                vscode.setState({ 
                                    ...vscode.getState(), 
                                    serverRunning: true, 
                                    currentPort: msg.port 
                                });
                            } else {
                                updateStatus('Stopped', false);
                                vscode.setState({ 
                                    ...vscode.getState(), 
                                    serverRunning: false 
                                });
                            }
                            break;

                        case 'refined':
                            addMsg(msg.value, 'assistant');
                            break;
                            
                        case 'question':
                            addMsg(msg.value, 'assistant');
                            if (msg.options) {
                                const optContainer = document.createElement('div');
                                optContainer.style.marginTop = '8px';
                                optContainer.style.display = 'flex';
                                optContainer.style.gap = '8px';
                                optContainer.style.flexWrap = 'wrap';
                                
                                msg.options.forEach(opt => {
                                    const b = document.createElement('button');
                                    b.textContent = opt;
                                    b.className = 'btn btn-primary'; 
                                    b.style.fontSize = '12px';
                                    b.style.padding = '6px 12px';
                                    b.style.flex = '0 1 auto';
                                    b.onclick = () => {
                                        addMsg(opt, 'user');
                                        vscode.postMessage({ type: 'userPrompt', value: opt });
                                    };
                                    optContainer.appendChild(b);
                                });
                                chat.lastElementChild.appendChild(optContainer);
                                chat.scrollTop = chat.scrollHeight;
                            }
                            break;

                        case 'status':
                            break;
                            
                        case 'error':
                            addMsg(msg.value, 'error');
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
  }
}

module.exports = ChatViewProvider;
