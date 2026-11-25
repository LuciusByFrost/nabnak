/* Offline, deliberately small pattern scanner. Never prints matched values. */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/],
  ['aws-access-id', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['google-api-key', /\bAIza[\w-]{35}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,255}\b/],
  ['openai-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,255}\b/],
  ['assigned-secret', /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][A-Za-z0-9_+\/-]{24,}["']/i]
];
function scan(bytes, label, findings) {
  if (bytes.includes(0)) return; // binary assets
  const text = bytes.toString('utf8');
  for (const [name, pattern] of rules) if (pattern.test(text)) findings.push({file: label, rule: name});
}
function scanWorkingTree() {
  const findings = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (['.git', 'node_modules', 'artifacts', '.tool-cache', '.agents', '.codex'].includes(entry.name) || entry.isSymbolicLink()) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) scan(fs.readFileSync(file), path.relative(root, file), findings);
    }
  }
  walk(root); return findings;
}
function scanHistory() {
  const findings = [];
  const git = args => execFileSync('git', args, {cwd: root, maxBuffer: 64 * 1024 * 1024});
  const objects = git(['rev-list', '--objects', '--all']).toString().trim().split('\n');
  for (const line of objects) {
    const space = line.indexOf(' '); if (space < 0) continue;
    const sha = line.slice(0, space), name = line.slice(space + 1);
    if (git(['cat-file', '-t', sha]).toString().trim() !== 'blob') continue;
    scan(git(['cat-file', 'blob', sha]), `${name} (history ${sha.slice(0, 12)})`, findings);
  }
  return findings;
}
if (require.main === module) {
  try {
    const findings = [...scanWorkingTree(), ...(process.argv.includes('--history') ? scanHistory() : [])];
    if (findings.length) { console.error(JSON.stringify(findings, null, 2)); process.exitCode = 1; }
    else console.log('No matching secret patterns found' + (process.argv.includes('--history') ? ' in working tree and locally available Git history.' : ' in working tree.'));
  } catch (error) { console.error('Secret scan could not complete: ' + error.code); process.exitCode = 1; }
}
module.exports = {rules, scan, scanWorkingTree};
