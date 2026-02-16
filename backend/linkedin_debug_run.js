const fs = require('fs');
const path = require('path');

function masked(v) { return v ? (v.slice(0,6) + '...') : '<unset>'; }

console.log('\n=== LinkedIn OAuth Runtime Debug ===\n');
console.log('Node version:', process.version);
console.log('global.fetch available:', typeof fetch === 'function');

console.log('\nEnvironment variables (masked):');
console.log('  LINKEDIN_CLIENT_ID:', masked(process.env.LINKEDIN_CLIENT_ID));
console.log('  LINKEDIN_CLIENT_SECRET:', masked(process.env.LINKEDIN_CLIENT_SECRET));
console.log('  LINKEDIN_REDIRECT_URI:', process.env.LINKEDIN_REDIRECT_URI || '<unset>');

// Check package.json for cookie-parser
try {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  console.log('\nDependency check:');
  console.log('  cookie-parser present:', !!deps['cookie-parser']);
} catch (e) {
  console.error('Failed to read package.json', e.message);
}

// Check server.js usage of cookieParser
try {
  const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const used = /cookieParser\(\)/.test(serverJs) || /cookie-parser/.test(serverJs);
  console.log('  cookie-parser used in server.js:', used);
} catch (e) {
  console.error('Failed to read server.js to check cookie-parser usage', e.message);
}

console.log('\nNote: Authorization redirect URL and callback details are logged when the `/api/linkedin` and `/api/linkedin/callback` routes are hit.');
console.log('To reproduce:');
console.log('  1) Visit: http://localhost:3001/api/linkedin  (will redirect to LinkedIn; auth URL logged)');
console.log('  2) Complete the flow on LinkedIn to hit /api/linkedin/callback (callback logs token response, req.cookies, state).');
console.log('\n=====================================\n');
