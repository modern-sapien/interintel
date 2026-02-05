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

async function processAIResponse(response, messages, config) {
  if (response.message?.tool_calls && response.message.tool_calls.length > 0) {
    messages.push(response.message);

    for (const toolCall of response.message.tool_calls) {
      const toolName = toolCall.function.name;
      const args = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

      console.log(`[Tool: ${toolName}]`.cyan, JSON.stringify(args).gray);

      const result = await executeTool(toolName, args);

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
      });

      if (result.success) {
        console.log(`[Tool result: success]`.green);
      } else {
        console.log(`[Tool retry: ${result.error}]`.yellow);
      }
    }

    const followUp = await chatCompletion(
      config.aiService,
      messages,
      config.aiVersion,
      toolDefinitions
    );

    return processAIResponse(followUp, messages, config);
  }

  const content = response.message?.content || response;
  return { content, messages };
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

    let botMessage;
    if (config.aiService === 'openai' || config.aiService === 'mistral') {
      botMessage = completion?.choices?.[0]?.message?.content || 'No response';
      messages.push({ role: 'assistant', content: botMessage });
    } else if (config.aiService === 'ollama') {
      const result = await processAIResponse(completion, messages, config);
      botMessage = result.content;
      messages = result.messages;
      messages.push({ role: 'assistant', content: botMessage });
    }

    console.log(`${config.aiVersion}`.bgGreen, botMessage.green);
    console.log('----------------'.bgGreen);
  }
}

export { main };

main();
