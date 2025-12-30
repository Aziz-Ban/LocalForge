# LocalForge

LocalForge is a VS Code extension that provides an AI-powered chat interface and a local server API, leveraging the GitHub Copilot Chat models to refine prompts and generate technical specifications.

## Features

- **AI Chat Interface**: Interact with GitHub Copilot models directly from the sidebar.
- **Prompt Refinement**: Enhance your prompts for better results.
- **Local Server API**: Expose Copilot's capabilities via a local HTTP server (`http://localhost:6009/LocalForge/chat`).
- **Custom System Prompts**: Define custom personas and instructions for the AI.
- **Model Selection**: Switch between available Copilot models (e.g., GPT-4, GPT-3.5).

## Prerequisites

- **VS Code**: Version 1.90.0 or higher.
- **GitHub Copilot Chat**: You must have the GitHub Copilot Chat extension installed and an active subscription.

## Installation

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Open the project in VS Code and press `F5` to launch the extension in the Extension Development Host.

## Usage

### Extension Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "LocalForge" to see available commands:

- **Open LocalForge Chat**: `LocalForge: Open LocalForge Chat` (Shortcut: `Ctrl+Shift+L` / `Cmd+Shift+L`)
- **Start Server**: `LocalForge: Start Server`
- **Stop Server**: `LocalForge: Stop Server`
- **Show API Info**: `LocalForge: Show API Info`

### Local Server API

Start the server using the command palette (or the button in the Sidebar). The server defaults to port `6009`.

**Endpoint**: `POST http://localhost:6009/LocalForge/chat`

**Request Body**:

```json
{
  "prompt": "Your prompt text",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "modelId": "gps-4",
  "systemPrompt": "Optional custom system prompt"
}
```

**Response**:

```json
{
  "result": "AI generated response"
}
```

## Development

- `npm run lint`: Run ESLint to check for code quality issues.
- `npm test`: Run the test suite using Jest.
