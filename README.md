# LocalForge

**LocalForge** is your local AI companion for VS Code, leveraging GitHub Copilot Chat models to refine prompts and generate technical specifications directly within your editor. It also bridges the gap between your local environment and Copilot by providing a local server API.

![LocalForge Icon](icon.png)

## Features

- **🤖 AI Chat Interface**: Seamlessly interact with GitHub Copilot models (GPT-4, GPT-3.5) from the sidebar.
- **✨ Prompt Refinement**: Automatically enhance your prompts to get better, more precise code generation.
- **🔌 Local Server API**: Expose Copilot's powerful capabilities to your other local tools via `http://localhost:6009`.
- **🎭 Custom Personas**: Define custom system prompts to tailor the AI's responses to your specific workflow.

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

Power your own scripts or other local tools with GitHub Copilot by starting the LocalForge server.

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
