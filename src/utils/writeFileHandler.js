/**
 * Handler for //writefile command
 */

import { chatCompletion } from '../providers.js';
import { writeFileFromPrompt } from './files.js';

export async function handleWriteFile(config, messages, currentState, userInput, promptFileName) {
  let contentToWrite = '';

  if (currentState === null) {
    return {
      currentState: 'awaitingFileName',
      messages,
      promptFileName,
      response: 'Please provide a name for the session file:',
    };
  }

  if (currentState === 'awaitingFileName') {
    return {
      currentState: 'awaitingAIprompt',
      messages,
      promptFileName: userInput,
      response: `Please provide a prompt for ${config.aiVersion}:`,
    };
  }

  if (currentState === 'awaitingAIprompt') {
    const promptForAI = userInput;
    const updatedMessages = [...messages, { role: 'user', content: promptForAI }];

    try {
      const completionResponse = await chatCompletion(
        config.aiService,
        updatedMessages,
        config.aiVersion
      );

      contentToWrite = config.aiService === 'openai' || config.aiService === 'mistral'
        ? completionResponse.choices[0].message.content
        : completionResponse;

      await writeFileFromPrompt(promptFileName, contentToWrite);

      return {
        currentState: null,
        messages: updatedMessages,
        promptFileName,
        contentToWrite,
        response: `Content written to ${promptFileName}`,
      };
    } catch (error) {
      console.error('Error in handleWriteFile:', error);
      return {
        currentState: null,
        messages: updatedMessages,
        promptFileName,
        contentToWrite,
        response: 'An error occurred while writing the file.',
      };
    }
  }

  return { currentState, messages, promptFileName, contentToWrite, response: '' };
}
