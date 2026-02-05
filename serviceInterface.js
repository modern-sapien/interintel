import path from 'path';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import MistralClient from '@mistralai/mistralai';

const configPath = path.join(process.cwd(), 'interintel.config.js');

let config;
try {
  const importedModule = await import(configPath);
  config = importedModule.default;
} catch (error) {
  console.error('Failed to import config:', error);
}

const mistralClient = new MistralClient(config.apiKey);

const openai = new OpenAI({
  apiKey: config.apiKey,
  model: config.aiVersion,
});

async function chatCompletion(aiService, messages, model, tools = null) {
  try {
    let response;

    if (aiService === 'openai') {
      const params = {
        messages: messages,
        model: model,
        stream: false,
      };
      if (tools) params.tools = tools;

      response = await openai.chat.completions.create(params);
      return response;

    } else if (aiService === 'mistral') {
      let chatResponse;

      chatResponse = await mistralClient.chat({
        model: model,
        messages: messages,
      });

      return chatResponse;
    } else if (aiService === 'ollama') {
      let data = {
        messages,
        model,
        stream: false,
      };
      if (tools) data.tools = tools;

      const fetchResponse = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      response = await fetchResponse.json();

      // Return full response when tools are enabled (for tool call detection)
      // Otherwise return just content for backward compatibility
      if (tools) {
        return response;
      }
      return response.message.content;
    } else {
      throw new Error('Invalid AI service');
    }
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

export { chatCompletion };
