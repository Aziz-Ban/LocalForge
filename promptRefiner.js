const vscode = require('vscode');
const { selectModel } = require('./llmService');

async function refinePrompt(history, modelId, systemPrompt) {
    try {
        const targetModel = await selectModel(modelId);
        
        return await refineWithModel(targetModel, history, systemPrompt);

    } catch (error) {
        console.error('Error in refinePrompt:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        throw new Error('Error processing request: ' + error.message);
    }
}

async function refineWithModel(model, history, customSystemPrompt) {
const defaultSystemPrompt = `You are a highly skilled AI prompt engineer. Your goal is to help the user refine their vague requests into precise, high-quality prompts for GitHub Copilot.

Rules:
1. Analyze the user's request.
2. If the request is vague or missing context (language, framework, specific goal), ask clarifying questions.
    - Return a JSON object with: { "type": "question", "text": "Your question here", "options": ["Option 1", "Option 2"] }
3. If the request is clear enough, generate a refined, detailed prompt.
    - Return a JSON object with: { "type": "refined", "text": "The final refined prompt..." }

Your refined prompt should be structured, including:
- Role/Persona
- Context
- Step-by-step instructions
- Constraints
- Expected Output format

Be helpful, concise, and professional.`;

    const systemPrompt = customSystemPrompt || defaultSystemPrompt;

    const messages = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        ...history.map(msg => 
            msg.role === 'user' 
            ? vscode.LanguageModelChatMessage.User(msg.content)
            : vscode.LanguageModelChatMessage.Assistant(msg.content)
        )
    ];

    const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
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
