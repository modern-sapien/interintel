import dotenv from 'dotenv';
dotenv.config();

const config = {
  // API key - only needed for cloud services (OpenAI, Mistral)
  apiKey: process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY || '',
  // Service: 'openai' | 'mistral' | 'ollama'
  aiService: 'ollama',
  // Model name - examples:
  //   ollama: 'llama3.1:8b', 'mixtral:latest', 'gpt-oss:20b'
  //   openai: 'gpt-4', 'gpt-3.5-turbo'
  //   mistral: 'mistral-tiny', 'mistral-small'
  aiVersion: 'llama3.1:8b',
  // Reference files to load into context
  filePaths: [],
};

export default config;
