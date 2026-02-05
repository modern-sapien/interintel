import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import colors from 'colors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join('../../interintel.config.js');
const templatePath = path.join(__dirname, '/resources/interintel.config.template.js');

const readMePath = path.join('../../interintel/interintelReadMe.md');
const readMeTemplate = path.join(__dirname, '/README.md');

// Creating directory to hold onto assets
try {
    fs.mkdirSync('../../interintel')
} catch (error) {
    console.log('Error occurred during setup:', error)
}

// Cloning config outside of node_modules and where root typically is
try {
    if (!fs.existsSync(configPath)) {
        console.log('Config file does not exist, creating...');
        fs.copyFileSync(templatePath, configPath);
        console.log('Interintel config created. Please update it with your settings.'.yellow);

    } else {
        console.log('Interintel config file already exists.');
    }
} catch (error) {
    console.error('Error occurred during setup:', error);
}

// Cloning README outside of node_modules and where root typically is
try {
    if (!fs.existsSync(readMePath)) {
        console.log('Readme file does not exist, creating...');
        fs.copyFileSync(readMeTemplate, readMePath);
        console.log('Interintel readme created. Please update it with your settings.'.yellow);

    } else {
        console.log('Interintel readme file already exists.');
    }
} catch (error) {
    console.error('Error occurred during setup:', error);
}

console.log("Finished running setup.js script.");
