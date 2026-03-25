/**
 * AI Provider Interface
 * Supports: Ollama (local), OpenAI, Mistral
 */

import path from 'path';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import MistralClient from '@mistralai/mistralai';

let config = null;
let openaiClient = null;
let mistralClient = null;

/**
 * Initialize providers with config
 */
export async function initProviders() {
  const configPath = path.join(process.cwd(), 'interintel.config.js');

  try {
    const importedModule = await import(configPath);
    config = importedModule.default;
  } catch (error) {
    console.error('Failed to load interintel.config.js:', error.message);
    console.error('Run setup or create config manually.');
    process.exit(1);
  }

  // Initialize clients lazily based on service
  if (config.aiService === 'openai' && config.apiKey) {
    openaiClient = new OpenAI({ apiKey: config.apiKey });
  }
  if (config.aiService === 'mistral' && config.apiKey) {
    mistralClient = new MistralClient(config.apiKey);
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
    if (aiService === 'openai') {
      if (!openaiClient) {
        throw new Error('OpenAI client not initialized. Check API key.');
      }
      const params = { messages, model, stream: false };
      if (tools) params.tools = tools;
      return await openaiClient.chat.completions.create(params);
    }

    if (aiService === 'mistral') {
      if (!mistralClient) {
        throw new Error('Mistral client not initialized. Check API key.');
      }
      return await mistralClient.chat({ model, messages });
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
