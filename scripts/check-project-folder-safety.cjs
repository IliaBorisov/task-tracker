const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'electron', 'main.cjs');
const source = fs.readFileSync(mainPath, 'utf8');

function fail(message) {
  console.error(`Project folder safety check failed: ${message}`);
  process.exit(1);
}

function stripCommentsAndStrings(text) {
  let output = '';
  let state = 'code';

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (state === 'line-comment') {
      if (current === '\n') {
        state = 'code';
        output += current;
      } else {
        output += ' ';
      }
      continue;
    }

    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        state = 'code';
        output += '  ';
        index += 1;
      } else {
        output += current === '\n' ? current : ' ';
      }
      continue;
    }

    if (state === 'single-quote' || state === 'double-quote' || state === 'template') {
      const closer =
        state === 'single-quote' ? "'" : state === 'double-quote' ? '"' : '`';

      if (current === '\\') {
        output += ' ';
        if (next) {
          output += next === '\n' ? '\n' : ' ';
          index += 1;
        }
        continue;
      }

      if (current === closer) {
        state = 'code';
        output += ' ';
      } else {
        output += current === '\n' ? current : ' ';
      }
      continue;
    }

    if (current === '/' && next === '/') {
      state = 'line-comment';
      output += '  ';
      index += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      state = 'block-comment';
      output += '  ';
      index += 1;
      continue;
    }

    if (current === "'") {
      state = 'single-quote';
      output += ' ';
      continue;
    }

    if (current === '"') {
      state = 'double-quote';
      output += ' ';
      continue;
    }

    if (current === '`') {
      state = 'template';
      output += ' ';
      continue;
    }

    output += current;
  }

  return output;
}

function findMatchingBrace(text, openingBraceIndex) {
  const cleanSource = stripCommentsAndStrings(text);
  let depth = 0;

  for (let index = openingBraceIndex; index < cleanSource.length; index += 1) {
    if (cleanSource[index] === '{') {
      depth += 1;
    }

    if (cleanSource[index] === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function getFunctionBody(functionSignature) {
  const functionStart = source.indexOf(functionSignature);

  if (functionStart === -1) {
    fail(`Could not find ${functionSignature}`);
  }

  const openingBraceIndex = source.indexOf('{', functionStart);

  if (openingBraceIndex === -1) {
    fail(`Could not find the body for ${functionSignature}`);
  }

  const closingBraceIndex = findMatchingBrace(source, openingBraceIndex);

  if (closingBraceIndex === -1) {
    fail(`Could not find the end of ${functionSignature}`);
  }

  return stripCommentsAndStrings(source.slice(openingBraceIndex + 1, closingBraceIndex));
}

function findUnexpectedCalls(body, allowedCalls) {
  const ignoredKeywords = new Set(['catch', 'for', 'function', 'if', 'switch', 'while']);
  const calls = [];
  const callPattern = /(?:\b([A-Za-z_$][\w$]*)\s*\.\s*)?\b([A-Za-z_$][\w$]*)\s*\(/g;
  let match = callPattern.exec(body);

  while (match) {
    const callName = match[1] ? `${match[1]}.${match[2]}` : match[2];

    if (!ignoredKeywords.has(callName) && !allowedCalls.has(callName)) {
      calls.push(callName);
    }

    match = callPattern.exec(body);
  }

  return [...new Set(calls)];
}

function assertNoFilesystemWrites(functionName, body) {
  const forbiddenPatterns = [
    /\bfs\s*\./,
    /\b(?:writeSettings|writeAppSettings|setDatabasePath)\s*\(/,
    /\b(?:readTaskDatabaseFromPath|readTaskDatabase|writeTaskDatabaseToPath|writeTaskDatabase)\s*\(/,
    /\b(?:chooseDatabaseFile|chooseProjectFolder)\s*\(/,
    /\bdialog\s*\./,
  ];

  forbiddenPatterns.forEach((pattern) => {
    if (pattern.test(body)) {
      fail(`${functionName} contains forbidden filesystem or dialog behavior`);
    }
  });
}

const openProjectFolderBody = getFunctionBody('async function openProjectFolder');
const normalizeFolderPathBody = getFunctionBody('function normalizeFolderPath');

assertNoFilesystemWrites('openProjectFolder', openProjectFolderBody);
assertNoFilesystemWrites('normalizeFolderPath', normalizeFolderPathBody);

const openPathCalls = openProjectFolderBody.match(/\bshell\s*\.\s*openPath\s*\(/g) || [];

if (openPathCalls.length !== 1) {
  fail('openProjectFolder must call shell.openPath exactly once');
}

if (!/\bshell\s*\.\s*openPath\s*\(\s*trimmedFolderPath\s*\)/.test(openProjectFolderBody)) {
  fail('openProjectFolder must open the validated trimmedFolderPath');
}

const unexpectedOpenProjectFolderCalls = findUnexpectedCalls(
  openProjectFolderBody,
  new Set(['normalizeFolderPath', 'shell.openPath']),
);

if (unexpectedOpenProjectFolderCalls.length > 0) {
  fail(
    `openProjectFolder calls unexpected helper(s): ${unexpectedOpenProjectFolderCalls.join(', ')}`,
  );
}

const unexpectedNormalizeFolderPathCalls = findUnexpectedCalls(
  normalizeFolderPathBody,
  new Set(['folderPath.trim']),
);

if (unexpectedNormalizeFolderPathCalls.length > 0) {
  fail(
    `normalizeFolderPath calls unexpected helper(s): ${unexpectedNormalizeFolderPathCalls.join(', ')}`,
  );
}

console.log('Project folder safety check passed.');
