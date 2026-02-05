import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { checkWritePermission, checkExecutePermission } from './permissions.js';

export function read_file({ path: filePath }) {
  try {
    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function list_directory({ path: dirPath = '.', recursive = false }) {
  try {
    const resolvedPath = path.resolve(process.cwd(), dirPath);

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `Directory not found: ${dirPath}` };
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return { success: false, error: `Not a directory: ${dirPath}` };
    }

    const entries = [];

    function listDir(currentPath, relativePath = '') {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        // Skip hidden files and node_modules
        if (item.startsWith('.') || item === 'node_modules') continue;

        const fullPath = path.join(currentPath, item);
        const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
        const itemStats = fs.statSync(fullPath);

        if (itemStats.isDirectory()) {
          entries.push({ name: itemRelativePath, type: 'directory' });
          if (recursive) {
            listDir(fullPath, itemRelativePath);
          }
        } else {
          entries.push({ name: itemRelativePath, type: 'file' });
        }
      }
    }

    listDir(resolvedPath);

    return { success: true, entries };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function search_directory({ pattern, path: dirPath = '.', filePattern = null }) {
  try {
    const resolvedPath = path.resolve(process.cwd(), dirPath);

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `Directory not found: ${dirPath}` };
    }

    const results = [];

    // Generate fuzzy variants of the pattern
    function generatePatternVariants(input) {
      const words = input.toLowerCase().split(/[\s_-]+/);
      const variants = new Set();

      variants.add(input);
      variants.add(words.join(''));
      variants.add(words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
      variants.add(words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''));
      variants.add(words.join('_'));
      variants.add(words.join('-'));

      return Array.from(variants);
    }

    const variants = generatePatternVariants(pattern);
    const regexPattern = variants.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(regexPattern, 'gi');

    function matchesFilePattern(filename) {
      if (!filePattern) return true;

      // Handle brace expansion: *.{js,ts,jsx,tsx}
      if (filePattern.includes('{') && filePattern.includes('}')) {
        const match = filePattern.match(/\*\.?\{([^}]+)\}/);
        if (match) {
          const extensions = match[1].split(',').map(e => e.trim());
          return extensions.some(ext => filename.endsWith('.' + ext) || filename.endsWith(ext));
        }
      }

      // Simple *.ext pattern
      if (filePattern.startsWith('*.')) {
        const ext = filePattern.slice(1);
        return filename.endsWith(ext);
      }

      return filename.includes(filePattern);
    }

    function searchDir(currentPath, relativePath = '') {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules') continue;

        const fullPath = path.join(currentPath, item);
        const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
        const itemStats = fs.statSync(fullPath);

        if (itemStats.isDirectory()) {
          searchDir(fullPath, itemRelativePath);
        } else if (matchesFilePattern(item)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');

            const matches = [];
            lines.forEach((line, index) => {
              if (regex.test(line)) {
                matches.push({
                  line: index + 1,
                  content: line.trim().substring(0, 200)
                });
                regex.lastIndex = 0;
              }
            });

            if (matches.length > 0) {
              results.push({
                file: itemRelativePath,
                matches: matches.slice(0, 10)
              });
            }
          } catch (e) {
            // Skip binary or unreadable files
          }
        }
      }
    }

    searchDir(resolvedPath);

    return {
      success: true,
      pattern,
      results: results.slice(0, 20)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function edit_file({ path: filePath, old_text, new_text, dry_run = false, replace_all = false }) {
  try {
    // Check permission first
    const permission = await checkWritePermission(filePath);
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');

    if (!content.includes(old_text)) {
      return {
        success: false,
        error: `Text not found in file. Make sure old_text matches exactly, including whitespace.`,
        hint: `File has ${content.length} characters. Search for a unique snippet.`
      };
    }

    const occurrences = content.split(old_text).length - 1;

    if (occurrences > 1 && !replace_all) {
      return {
        success: false,
        error: `Found ${occurrences} occurrences. Use replace_all: true to replace all, or provide a unique snippet.`
      };
    }

    const newContent = replace_all
      ? content.split(old_text).join(new_text)
      : content.replace(old_text, new_text);

    if (dry_run) {
      return {
        success: true,
        dry_run: true,
        file: filePath,
        occurrences,
        preview: {
          old: old_text.substring(0, 200),
          new: new_text.substring(0, 200)
        },
        message: `Dry run - would replace ${replace_all ? occurrences : 1} occurrence(s). Set dry_run to false to apply.`
      };
    }

    fs.writeFileSync(resolvedPath, newContent, 'utf-8');

    return {
      success: true,
      file: filePath,
      message: `Replaced ${replace_all ? occurrences : 1} occurrence(s) in ${filePath}`,
      changed: {
        old: old_text.substring(0, 100),
        new: new_text.substring(0, 100)
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function write_file({ path: filePath, content, overwrite = false }) {
  try {
    // Check permission first
    const permission = await checkWritePermission(filePath);
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);

    if (fs.existsSync(resolvedPath) && !overwrite) {
      return {
        success: false,
        error: `File already exists: ${filePath}. Set overwrite: true to replace it.`
      };
    }

    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');

    return {
      success: true,
      file: filePath,
      message: `Created ${filePath}`,
      size: content.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function run_command({ command, timeout = 30000 }) {
  try {
    // Check permission first
    const permission = await checkExecutePermission(command);
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    return new Promise((resolve) => {
      exec(command, { timeout, cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
            stderr: stderr?.substring(0, 500)
          });
          return;
        }

        resolve({
          success: true,
          command,
          stdout: stdout?.substring(0, 2000),
          stderr: stderr?.substring(0, 500)
        });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Map of tool names to executor functions
export const executors = {
  read_file,
  list_directory,
  search_directory,
  edit_file,
  write_file,
  run_command
};

export default executors;
