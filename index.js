import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import colors from 'colors';
const configPath = path.join(process.cwd(), 'interintel.config.js');

import config from './interintel.config.js';
import { readSpecificFiles } from './functions/file-functions.js';
import { askQuestion } from './functions/chat-functions.js';
import { handleWriteFile } from './functions/handleWriteFile.js';
import { chatCompletion } from './serviceInterface.js';
import { toolDefinitions, executors } from './tools/index.js';
import { setReadlineInterface, loadPermissions, showPermissions } from './tools/permissions.js';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Share readline with permissions module
setReadlineInterface(rl);

// Execute a tool and return the result (async for permission checks)
async function executeTool(toolName, args) {
  const executor = executors[toolName];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }
  return await executor(args);
}

// Process AI response, handling any tool calls
async function processAIResponse(response, messages) {
  // Check if response contains tool calls
  if (response.message?.tool_calls && response.message.tool_calls.length > 0) {
    // Add assistant message with tool calls to history
    messages.push(response.message);

    // Execute each tool call
    for (const toolCall of response.message.tool_calls) {
      const toolName = toolCall.function.name;
      // Handle both string (OpenAI) and object (Ollama) formats
      const args = typeof toolCall.function.arguments === 'string'
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

      console.log(`[Tool: ${toolName}]`.cyan, JSON.stringify(args).gray);

      const result = await executeTool(toolName, args);

      // Add tool result to messages
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

    // Continue conversation with tool results
    const followUp = await chatCompletion(
      config.aiService,
      messages,
      config.aiVersion,
      toolDefinitions
    );

    // Recursively process in case AI makes more tool calls
    return processAIResponse(followUp, messages);
  }

  // No tool calls, return the text response
  const content = response.message?.content || response;
  return { content, messages };
}

async function main() {
  // Load permissions config
  loadPermissions();

  let initialContent = await readSpecificFiles(configPath);
  let messages = [{ role: 'system', content: initialContent }];

  let currentState = null;
  let promptFileName = '';

  console.log('Interintel started. Type "exit" to quit.'.green);
  console.log('Tools: read_file, list_directory, search_directory, edit_file, write_file, run_command'.cyan);
  console.log('Write/execute require permission. Type //permissions to view.'.gray);

  while (true) {
    const userMessage = await askQuestion(rl, 'You: '.blue.bold);
    let response = '';

    // Exit condition
    if (userMessage.toLowerCase() === 'exit') {
      console.log('Exiting chat...'.bgRed);
      rl.close();
      break;
    }

    // Show permissions
    if (userMessage.toLowerCase() === '//permissions') {
      showPermissions();
      continue;
    }

    if (userMessage.toLowerCase().startsWith('//writefile') && currentState === null) {
      let result = await handleWriteFile(config, messages, currentState, '');
      ({ currentState, messages, promptFileName, response } = result);
      console.log(response.yellow);
    } else if (currentState === 'awaitingFileName') {
      ({ currentState, messages, promptFileName, response } = await handleWriteFile(
        config,
        messages,
        currentState,
        userMessage,
        promptFileName
      ));
      console.log(response.yellow);
    } else if (currentState === 'awaitingAIprompt') {
      ({ currentState, messages, promptFileName, response } = await handleWriteFile(
        config,
        messages,
        currentState,
        userMessage,
        promptFileName
      ));
      console.log(response.yellow);
    } else if (currentState === null && userMessage.toLowerCase() === '//readrefs') {
      console.log('System message:'.bgYellow);
      console.log('Processing //readRefs command...'.yellow);

      let content = readSpecificFiles(configPath);
      messages.push({
        role: 'user',
        content: `please just acknowledge you have read the name and the content of the files I have provided. once you have done this a single time you do not need to do it again. ${content}`,
      });
      const completion = await chatCompletion(config.aiService, messages, config.aiVersion);

      let botMessage = '';

      if (config.aiService === 'openai' || config.aiService === 'mistral') {
        botMessage = completion.choices[0].message.content;
      } else if (config.aiService === 'ollama') {
        botMessage = completion;
      }
    } else {
      // Regular message processing with tool support
      messages.push({ role: 'user', content: userMessage });

      const completion = await chatCompletion(
        config.aiService,
        messages,
        config.aiVersion,
        toolDefinitions
      );

      let botMessage;
      if (config.aiService === 'openai' || config.aiService === 'mistral') {
        botMessage = completion.choices[0].message.content;
        messages.push({ role: 'assistant', content: botMessage });
      } else if (config.aiService === 'ollama') {
        // Process response with potential tool calls
        const result = await processAIResponse(completion, messages);
        botMessage = result.content;
        messages = result.messages;
        messages.push({ role: 'assistant', content: botMessage });
      }

      console.log(`${config.aiVersion}`.bgGreen, botMessage.green);
      console.log('----------------'.bgGreen);
    }
  }
}

export { main };

main();
