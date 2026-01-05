const vscode = require('vscode');
const { selectModel } = require('./llmService');

async function refinePrompt(history, modelId, systemPrompt) {
  try {
    const targetModel = await selectModel(modelId);

    return await refineWithModel(targetModel, history, systemPrompt);
  } catch (error) {
    console.error('Error in refinePrompt:', error);
    throw new Error('Error processing request: ' + error.message);
  }
}

async function refineWithModel(model, history, customSystemPrompt) {
  const defaultSystemPrompt = `Analyze user requests and either ask clarifying questions or provide detailed prompts. If unclear, return JSON: {"type": "question", "text": "...", "options": [...]}. If clear, return: {"type": "refined", "text": "..."}. Include context, instructions, and expected output.`;

  const systemPrompt = customSystemPrompt || defaultSystemPrompt;

  const messages = [
    vscode.LanguageModelChatMessage.User(systemPrompt),
    ...history.map((msg) =>
      msg.role === 'user'
        ? vscode.LanguageModelChatMessage.User(msg.content)
        : vscode.LanguageModelChatMessage.Assistant(msg.content)
    ),
  ];

  const chatResponse = await model.sendRequest(
    messages,
    {},
    new vscode.CancellationTokenSource().token
  );
  let rawResponse = '';

  for await (const fragment of chatResponse.text) {
    rawResponse += fragment;
  }

  let jsonString = rawResponse.trim();
  if (jsonString.startsWith('```json')) jsonString = jsonString.slice(7);
  if (jsonString.startsWith('```')) jsonString = jsonString.slice(3);
  if (jsonString.endsWith('```')) jsonString = jsonString.slice(0, -3);

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return { type: 'refined', text: rawResponse };
  }
}

module.exports = { refinePrompt };
