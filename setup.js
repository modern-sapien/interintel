#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// INIT_CWD is set by npm to the directory where `npm install` was run.
// process.cwd() during postinstall points to the package dir inside node_modules.
const projectRoot = process.env.INIT_CWD || process.cwd();

const configPath = path.join(projectRoot, 'interintel.config.js');
const templatePath = path.join(__dirname, 'templates/config.js');

console.log('Interintel setup...');
console.log(`Project root: ${projectRoot}`);

// Create config file in user's project root
try {
  if (!fs.existsSync(configPath)) {
    console.log('Creating interintel.config.js...');
    fs.copyFileSync(templatePath, configPath);
    console.log('Config created! Edit interintel.config.js to set your AI service and model.');
  } else {
    console.log('interintel.config.js already exists.');
  }
} catch (error) {
  // Likely running in a context where we can't write (e.g., global install)
  console.log('Note: Could not create config file. Create interintel.config.js manually.');
}

console.log('Setup complete. Run "interintel" or "node index.js" to start.');
