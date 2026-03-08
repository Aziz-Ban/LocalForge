# Local Forge

Local Forge is a VS Code extension that lets you run multiple concurrent AI API servers locally, completely powered by your active GitHub Copilot subscription. It securely transforms your IDE into a local AI provider for any LLM-based tool or script you use.

## Features

- **Multi-Agent Management**: Spin up and orchestrate multiple local API servers at once, each on their own port.
- **Custom System Prompts**: Create highly specialized agents (e.g. "Senior UI/UX Engineer") by defining unique system prompts per server.
- **Model Selection**: Seamlessly switch between available GitHub Copilot family models (like GPT-4o, GPT-3.5) for every agent.
- **Slick Responsive UI**: A beautiful, ultra-responsive Webview sidebar inside VS Code lets you create, edit, start, and manage your custom agents with ease.
- **1-Click Fleet Management**: Use the header buttons to **Start All** or **Stop All** agents simultaneously.
- **Drop-in Copilot API**: Instantly expose Copilot capabilities to your local scripts, external IDEs, or CLI tools via `http://localhost:<PORT>/LocalForge/chat`.
- **Persistent Storage**: All of your configured agents are remembered and persisted safely in the VS Code global state across workspace reloads.
- **Auto-Cleanup**: Gracefully shuts down all active HTTP servers when VS Code is exited or the extension is refreshed.

## Usage

The extension provides a dedicated sidebar panel called **Local Forge** where you can:

1. Tap the **Floating Action Button (+)** or **New Agent** to configure an agent.
2. Set the Agent Name, Model, Port, and optionally toggle the System Prompt.
3. Click **Start** on an agent card to launch its API locally.
4. Copy the provided Endpoint from the UI and paste it into your external tools.

### Example API Request

With an agent running on port `6009`:

```bash
curl -X POST http://localhost:6009/LocalForge/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Write a Python script to scrape a website." }
    ]
  }'
```

_(Note: You can pass a `messages` array for context history, or a single `prompt` string)._

## Commands

Access these commands via the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **`Local Forge: Start All Agents`**: Boot up all configured agents at once.
- **`Local Forge: Stop All Agents`**: Gracefully stop all running agents.
- **`Local Forge: Get Running Agents`**: View a list of currently active agents in the Output panel.
- **`Local Forge: Show API Info`**: View the endpoint URL, model, and system prompt for a specific agent.

## Requirements

An active **GitHub Copilot** subscription logged in through your primary VS Code account is strictly required to power the agents.

## Contributing

1. Clone the repository.
2. Run `npm install`.
3. Press `F5` to launch a new VS Code Extension Development Host.
4. Run tests securely with `npm run test` or trigger linting checks with `npm run lint`.

## License

[MIT](LICENSE)
