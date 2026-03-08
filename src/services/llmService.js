const vscode = require('vscode');

let cachedModels = null;

async function getAvailableModels() {
  if (cachedModels) return cachedModels;

  try {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    cachedModels = models.map((m) => ({ id: m.id, name: m.name, family: m.family }));
    return cachedModels;
  } catch (error) {
    return [];
  }
}

async function selectModel(modelId) {
  let targetModel;

  if (modelId) {
    const [selected] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: modelId });
    targetModel = selected;
  }

  if (!targetModel) {
    const [defaultModel] = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4.1',
    });
    targetModel = defaultModel || (await vscode.lm.selectChatModels({ vendor: 'copilot' }))[0];
  }

  if (!targetModel) {
    throw new Error('Copilot not available. Please install GitHub Copilot extension.');
  }

  return targetModel;
}

async function sendChatRequest(history, modelId, systemPrompt) {
  const targetModel = await selectModel(modelId);
  const messages = [];

  if (systemPrompt) {
    messages.push(vscode.LanguageModelChatMessage.User(systemPrompt));
  }

  messages.push(
    ...history.map((msg) =>
      msg.role === 'user'
        ? vscode.LanguageModelChatMessage.User(msg.content)
        : vscode.LanguageModelChatMessage.Assistant(msg.content)
    )
  );

  const chatResponse = await targetModel.sendRequest(
    messages,
    {},
    new vscode.CancellationTokenSource().token
  );

  let rawResponse = '';
  for await (const fragment of chatResponse.text) {
    rawResponse += fragment;
  }

  return rawResponse;
}

module.exports = { getAvailableModels, selectModel, sendChatRequest };
