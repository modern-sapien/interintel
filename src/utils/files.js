/**
 * File operation utilities
 */

import fs from 'fs';
import path from 'path';

/**
 * Read reference files specified in config
 */
export async function readSpecificFiles(configFilePath) {
  try {
    const absoluteConfigPath = path.resolve(configFilePath);
    const configModule = await import('file://' + absoluteConfigPath);
    const config = configModule.default;

    const filePaths = config.filePaths || [];

    if (filePaths.length === 0) {
      return '';
    }

    let allContent = 'Reference files loaded into context:\n';

    for (const filePath of filePaths) {
      try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        const fileContent = fs.readFileSync(absolutePath, 'utf8');
        allContent += `\n--- ${filePath} ---\n${fileContent}\n--- end ${filePath} ---\n`;
      } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
      }
    }

    const fileNames = filePaths.map(p => path.basename(p)).join(', ');
    console.log(`${config.aiVersion} sent reference files: ${fileNames}`.yellow);

    return allContent;
  } catch (error) {
    console.error(`Error reading config file: ${error.message}`);
    return '';
  }
}

/**
 * Write content to a file in session-samples directory
 */
export function writeFileFromPrompt(promptFileName, contentToWrite) {
  try {
    if (!promptFileName.includes('.')) {
      throw new Error('Invalid file name. Include an extension (e.g., output.txt)');
    }

    const projectRoot = process.cwd();
    const fullPath = path.join(projectRoot, `interintel/session-samples/${promptFileName}`);
    const directoryPath = path.dirname(fullPath);

    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.writeFileSync(fullPath, contentToWrite + '\n');
    console.log(`Content written to ${fullPath}`.yellow);
    return true;
  } catch (error) {
    console.error(`Error writing file: ${error.message}`.bgRed);
    return false;
  }
}
