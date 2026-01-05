# LocalForge

**LocalForge** is a VS Code extension that leverages GitHub Copilot Chat models to refine prompts and generate technical specifications. It also provides a local server API to integrate Copilot with other tools.

![LocalForge Icon](icon.png)

## Features

- **AI Chat Interface**: Interact with GitHub Copilot models (GPT-4, GPT-3.5) from the sidebar.
- **Prompt Refinement**: Enhance prompts for better code generation.
- **Local Server API**: Expose Copilot capabilities to local tools via `http://localhost:6009`.
- **Custom Personas**: Define custom system prompts to tailor AI responses.

## Installation

1.  Open **VS Code**.
2.  Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
3.  Search for **"LocalForge"**.
4.  Click **Install**.

> **Note**: An active GitHub Copilot subscription is required to use the chat features.

## Usage

### Extension Commands

Access these commands via the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **`LocalForge: Open LocalForge Chat`** (`Ctrl+Shift+L`): Opens the AI chat sidebar.
- **`LocalForge: Start Server`**: Starts the local API server (Default port: `6009`).
- **`LocalForge: Stop Server`**: Stops the local API server.
- **`LocalForge: Show API Info`**: Displays connection details for the local API.

### Local Server API

Start the LocalForge server to integrate GitHub Copilot with other tools.

**Endpoint**: `POST http://localhost:6009/LocalForge/chat`

**Example Request**:

```json
{
  "prompt": "Write a Python script to scrape a website."
}
```

## Contributing

We welcome contributions!

1.  Clone the repository.
2.  Run `npm install`.
3.  Press `F5` to start debugging.
4.  Run tests with `npm test`.

## License

[MIT](LICENSE)
