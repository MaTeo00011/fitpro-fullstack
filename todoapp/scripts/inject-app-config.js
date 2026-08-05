const fs = require('fs');
const path = require('path');

const outputDirs = [
  path.join(__dirname, '..', 'dist', 'todoapp', 'browser'),
  path.join(__dirname, '..', 'dist', 'todoapp')
];
const indexPath = outputDirs
  .map(dir => path.join(dir, 'index.html'))
  .find(fs.existsSync);
const apiBaseUrl = process.env.API_BASE_URL;
const apiBaseUrlExpression = apiBaseUrl ? JSON.stringify(apiBaseUrl) : 'window.location.origin';

if (!fs.existsSync(indexPath)) {
  console.error('Error: index.html not found. Run ng build first.');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
const injection = `<script>window.__APP_CONFIG__ = { apiBaseUrl: ${apiBaseUrlExpression} };</script>`;
const existingScriptRegex = /<script>window\.__APP_CONFIG__ = \{[\s\S]*?\};<\/script>/i;
let modified;

if (existingScriptRegex.test(html)) {
  modified = html.replace(existingScriptRegex, injection);
} else {
  modified = html.replace(/<body([^>]*)>/i, match => `${match}\n  ${injection}`);
}

fs.writeFileSync(indexPath, modified, 'utf8');
console.log(`Injected API base URL: ${apiBaseUrlExpression}`);
