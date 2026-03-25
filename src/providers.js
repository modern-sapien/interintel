/**
 * AI Provider Interface
 * Supports: Ollama (local), OpenAI, Mistral
 * Mistral uses the OpenAI SDK pointed at Mistral's API (OpenAI-compatible).
 */

import path from 'path';
import { pathToFileURL } from 'url';
import OpenAI from 'openai';

let config = null;
let apiClient = null;

/**
 * Initialize providers with config
 */
export async function initProviders() {
  const configPath = path.join(process.cwd(), 'interintel.config.js');

  try {
    const importedModule = await import(pathToFileURL(configPath));
    config = importedModule.default;
  } catch (error) {
    console.error('Failed to load interintel.config.js:', error.message);
    console.error('Run setup or create config manually.');
    process.exit(1);
  }

  if (config.aiService === 'openai' && config.apiKey) {
    apiClient = new OpenAI({ apiKey: config.apiKey });
  }
  if (config.aiService === 'mistral' && config.apiKey) {
    apiClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.mistral.ai/v1',
    });
  }

  return config;
}

/**
 * Get current config
 */
export function getConfig() {
  return config;
}

/**
 * Send chat completion request to configured AI service
 */
export async function chatCompletion(aiService, messages, model, tools = null) {
  try {
    if (aiService === 'openai' || aiService === 'mistral') {
      if (!apiClient) {
        throw new Error(`${aiService} client not initialized. Check API key.`);
      }
      const params = { messages, model, stream: false };
      if (tools) params.tools = tools;
      return await apiClient.chat.completions.create(params);
    }

    if (aiService === 'ollama') {
      const data = { messages, model, stream: false };
      if (tools) data.tools = tools;

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      // Return full response when tools enabled, else just content
      return tools ? result : result.message.content;
    }

    throw new Error(`Unknown AI service: ${aiService}`);
  } catch (error) {
    console.error('AI request error:', error.message);
    return null;
  }
}
