import fs from 'fs';
import path from 'path';

const PERMISSIONS_FILE = path.join(process.cwd(), 'interintel.permissions.json');

// Clear permission states - always visible in config
const defaultPermissions = {
  read: true,       // Always allowed
  search: true,     // Always allowed
  edit: false,      // Requires permission
  write: false,     // Requires permission
  execute: false,   // Requires permission
  allowedPaths: [], // Specific paths granted write/edit access
  allowedCommands: [] // Specific commands granted execute access
};

let permissions = null;
let sessionPermissions = { paths: [], commands: [] };
let rl = null;

export function setReadlineInterface(readline) {
  rl = readline;
}

export function loadPermissions() {
  try {
    if (fs.existsSync(PERMISSIONS_FILE)) {
      const data = fs.readFileSync(PERMISSIONS_FILE, 'utf-8');
      permissions = { ...defaultPermissions, ...JSON.parse(data) };
    } else {
      permissions = { ...defaultPermissions };
      // Create file with defaults so it's always visible
      savePermissions();
    }
  } catch (error) {
    console.error('Error loading permissions:', error.message);
    permissions = { ...defaultPermissions };
  }
  sessionPermissions = { paths: [], commands: [] };
  return permissions;
}

function savePermissions() {
  try {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(permissions, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving permissions:', error.message);
  }
}

function pathMatches(filePath, allowedPaths) {
  for (const pattern of allowedPaths) {
    if (filePath === pattern) return true;
    if (pattern.endsWith('/**')) {
      const dir = pattern.slice(0, -3);
      if (filePath.startsWith(dir)) return true;
    }
    if (pattern === '**/*' || pattern === '*') return true;
  }
  return false;
}

function commandMatches(command, allowedCommands) {
  for (const pattern of allowedCommands) {
    if (command === pattern) return true;
    if (pattern.endsWith(' *')) {
      const prefix = pattern.slice(0, -2);
      if (command.startsWith(prefix + ' ') || command === prefix) return true;
    }
    if (pattern === '*') return true;
  }
  return false;
}

async function promptUser(question) {
  return new Promise((resolve) => {
    if (!rl) {
      resolve('no');
      return;
    }
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim());
    });
  });
}

export async function checkWritePermission(filePath) {
  if (!permissions) loadPermissions();

  // If global write is enabled, allow
  if (permissions.write || permissions.edit) {
    return { allowed: true };
  }

  // Check allowed paths
  const allPaths = [...permissions.allowedPaths, ...sessionPermissions.paths];
  if (pathMatches(filePath, allPaths)) {
    return { allowed: true };
  }

  console.log('');
  const answer = await promptUser(
    `AI wants to write: ${filePath}\n[y]es (once) / [n]o / [a]lways (save) / [g]lobal (trust all writes): `.yellow
  );

  if (answer === 'y' || answer === 'yes') {
    sessionPermissions.paths.push(filePath);
    console.log(`[Session: write allowed for ${filePath}]`.gray);
    return { allowed: true };
  } else if (answer === 'a' || answer === 'always') {
    const dirPath = path.dirname(filePath) + '/**';
    permissions.allowedPaths.push(dirPath);
    savePermissions();
    console.log(`[Saved: write allowed for ${dirPath}]`.green);
    return { allowed: true };
  } else if (answer === 'g' || answer === 'global') {
    permissions.write = true;
    permissions.edit = true;
    savePermissions();
    console.log(`[Saved: global write/edit enabled]`.green);
    return { allowed: true };
  }

  return { allowed: false, reason: 'User denied permission' };
}

export async function checkExecutePermission(command) {
  if (!permissions) loadPermissions();

  // If global execute is enabled, allow
  if (permissions.execute) {
    return { allowed: true };
  }

  // Check allowed commands
  const allCommands = [...permissions.allowedCommands, ...sessionPermissions.commands];
  if (commandMatches(command, allCommands)) {
    return { allowed: true };
  }

  console.log('');
  const answer = await promptUser(
    `AI wants to run: ${command}\n[y]es (once) / [n]o / [a]lways (save) / [g]lobal (trust all commands): `.yellow
  );

  if (answer === 'y' || answer === 'yes') {
    sessionPermissions.commands.push(command);
    console.log(`[Session: execute allowed for ${command}]`.gray);
    return { allowed: true };
  } else if (answer === 'a' || answer === 'always') {
    const baseCmd = command.split(' ')[0] + ' *';
    permissions.allowedCommands.push(baseCmd);
    savePermissions();
    console.log(`[Saved: execute allowed for ${baseCmd}]`.green);
    return { allowed: true };
  } else if (answer === 'g' || answer === 'global') {
    permissions.execute = true;
    savePermissions();
    console.log(`[Saved: global execute enabled]`.green);
    return { allowed: true };
  }

  return { allowed: false, reason: 'User denied permission' };
}

export function getPermissions() {
  if (!permissions) loadPermissions();
  return permissions;
}

export function showPermissions() {
  if (!permissions) loadPermissions();

  console.log('\nPermission settings:'.cyan);
  console.log(`  read:    ${permissions.read ? '✓ enabled'.green : '✗ disabled'.red}`);
  console.log(`  search:  ${permissions.search ? '✓ enabled'.green : '✗ disabled'.red}`);
  console.log(`  edit:    ${permissions.edit ? '✓ enabled'.green : '✗ disabled'.red}`);
  console.log(`  write:   ${permissions.write ? '✓ enabled'.green : '✗ disabled'.red}`);
  console.log(`  execute: ${permissions.execute ? '✓ enabled'.green : '✗ disabled'.red}`);

  if (permissions.allowedPaths.length > 0) {
    console.log('\nAllowed paths:'.cyan);
    permissions.allowedPaths.forEach(p => console.log(`  ${p}`.gray));
  }

  if (permissions.allowedCommands.length > 0) {
    console.log('\nAllowed commands:'.cyan);
    permissions.allowedCommands.forEach(c => console.log(`  ${c}`.gray));
  }

  if (sessionPermissions.paths.length > 0 || sessionPermissions.commands.length > 0) {
    console.log('\nSession only (not saved):'.cyan);
    sessionPermissions.paths.forEach(p => console.log(`  write: ${p}`.gray));
    sessionPermissions.commands.forEach(c => console.log(`  execute: ${c}`.gray));
  }

  console.log('');
}
