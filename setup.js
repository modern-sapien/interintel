#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import colors from 'colors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When installed via npm, process.cwd() is the user's project root
// When running locally, it's the interintel directory
const projectRoot = process.cwd();

const configPath = path.join(projectRoot, 'interintel.config.js');
const templatePath = path.join(__dirname, 'templates/config.js');

console.log('Interintel setup...'.cyan);
console.log(`Project root: ${projectRoot}`.gray);

// Create config file in user's project root
try {
  if (!fs.existsSync(configPath)) {
    console.log('Creating interintel.config.js...'.yellow);
    fs.copyFileSync(templatePath, configPath);
    console.log('Config created! Edit interintel.config.js to set your AI service and model.'.green);
  } else {
    console.log('interintel.config.js already exists.'.gray);
  }
} catch (error) {
  // Likely running in a context where we can't write (e.g., global install)
  console.log('Note: Could not create config file. Create interintel.config.js manually.'.yellow);
}

console.log('Setup complete. Run "interintel" or "node index.js" to start.'.green);
