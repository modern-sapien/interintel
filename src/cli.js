#!/usr/bin/env node
/**
 * Interintel CLI - Local AI Development Assistant
 */

import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import colors from 'colors';

import { initProviders, chatCompletion, getConfig } from './providers.js';
import { readSpecificFiles } from './utils/files.js';
import { askQuestion } from './utils/chat.js';
import { handleWriteFile } from './utils/writeFileHandler.js';
import {
  toolDefinitions,
  executors,
  setReadlineInterface,
  loadPermissions,
  showPermissions
} from './tools/index.js';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

setReadlineInterface(rl);

async function executeTool(toolName, args) {
  const executor = executors[toolName];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }
  return await executor(args);
}

/**
 * Normalize a completion response into a common shape:
 *   { content: string|null, toolCalls: Array|null, rawMessage: object }
 *
 * rawMessage is the provider-native message object to push onto the history.
 */
function normalizeResponse(aiService, response) {
  if (aiService === 'ollama') {
    const msg = response?.message;
    return {
      content: msg?.content || null,
      toolCalls: msg?.tool_calls?.length ? msg.tool_calls.map(tc => ({
        id: tc.id || tc.function?.name,
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments,
      })) : null,
      rawMessage: msg,
    };
  }

  // OpenAI and Mistral both use the choices[0].message shape
  const msg = response?.choices?.[0]?.message;
  return {
    content: msg?.content || null,
    toolCalls: msg?.tool_calls?.length ? msg.tool_calls.map(tc => ({
      id: tc.id || tc.function?.name,
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    })) : null,
    rawMessage: msg,
  };
}

/**
 * Build a tool result message in the format each provider expects.
 */
function toolResultMessage(aiService, toolCallId, result) {
  if (aiService === 'ollama') {
    return { role: 'tool', content: JSON.stringify(result) };
  }
  // OpenAI / Mistral expect tool_call_id
  return { role: 'tool', tool_call_id: toolCallId, content: JSON.stringify(result) };
}

/**
 * Process a completion response, executing any tool calls in a loop
 * until the model returns a final text response.
 */
async function processResponse(aiService, response, messages, model) {
  const normalized = normalizeResponse(aiService, response);

  if (!normalized.toolCalls) {
    return { content: normalized.content || 'No response', messages };
  }

  // Push the assistant message with tool calls onto history
  messages.push(normalized.rawMessage);

  for (const tc of normalized.toolCalls) {
    console.log(`[Tool: ${tc.name}]`.cyan, JSON.stringify(tc.arguments).gray);

    const result = await executeTool(tc.name, tc.arguments);

    messages.push(toolResultMessage(aiService, tc.id, result));

    if (result.success) {
      console.log(`[Tool result: success]`.green);
    } else {
      console.log(`[Tool retry: ${result.error}]`.yellow);
    }
  }

  // Follow up with the model so it can use the tool results
  const followUp = await chatCompletion(aiService, messages, model, toolDefinitions);
  if (!followUp) {
    return { content: 'Error: No response from AI after tool call.', messages };
  }

  return processResponse(aiService, followUp, messages, model);
}

async function main() {
  // Initialize
  const config = await initProviders();
  loadPermissions();

  const configPath = path.join(process.cwd(), 'interintel.config.js');
  const initialContent = await readSpecificFiles(configPath);
  let messages = initialContent ? [{ role: 'system', content: initialContent }] : [];

  let currentState = null;
  let promptFileName = '';

  console.log('Interintel started. Type "exit" to quit.'.green);
  console.log('Tools: read_file, list_directory, search_directory, edit_file, write_file, run_command'.cyan);
  console.log('Write/execute require permission. Type //permissions to view.'.gray);

  while (true) {
    const userMessage = await askQuestion(rl, 'You: '.blue.bold);

    if (userMessage.toLowerCase() === 'exit') {
      console.log('Exiting...'.bgRed);
      rl.close();
      break;
    }

    if (userMessage.toLowerCase() === '//permissions') {
      showPermissions();
      continue;
    }

    if (userMessage.toLowerCase().startsWith('//writefile') && currentState === null) {
      const result = await handleWriteFile(config, messages, currentState, '');
      ({ currentState, messages, promptFileName } = result);
      console.log(result.response.yellow);
      continue;
    }

    if (currentState === 'awaitingFileName' || currentState === 'awaitingAIprompt') {
      const result = await handleWriteFile(config, messages, currentState, userMessage, promptFileName);
      ({ currentState, messages, promptFileName } = result);
      console.log(result.response.yellow);
      continue;
    }

    if (userMessage.toLowerCase() === '//readrefs') {
      console.log('Loading reference files...'.yellow);
      const content = await readSpecificFiles(configPath);
      messages.push({
        role: 'user',
        content: `Reference files loaded: ${content}`,
      });
      continue;
    }

    // Regular chat with tool support
    messages.push({ role: 'user', content: userMessage });

    const completion = await chatCompletion(
      config.aiService,
      messages,
      config.aiVersion,
      toolDefinitions
    );

    if (!completion) {
      console.log('Error: No response from AI. Check your config and connection.'.red);
      messages.pop(); // Remove the user message that got no response
      continue;
    }

    const result = await processResponse(config.aiService, completion, messages, config.aiVersion);
    const botMessage = result.content;
    messages = result.messages;
    messages.push({ role: 'assistant', content: botMessage });

    console.log(`${config.aiVersion}`.bgGreen, botMessage.green);
    console.log('----------------'.bgGreen);
  }
}

export { main };

main();
