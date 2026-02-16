require('dotenv').config();
const { URLSearchParams } = require('url');

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;
const SCOPE = 'openid profile email';

if (!CLIENT_ID || !REDIRECT_URI) {
  console.error('Missing LINKEDIN_CLIENT_ID or LINKEDIN_REDIRECT_URI in .env');
  process.exit(2);
}

const params = new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  scope: SCOPE,
  state: 'TEST_STATE'
});

const rawQs = params.toString();
const qs = rawQs.replace(/\+/g, '%20');
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${qs}`;

console.log('Computed auth URL:');
console.log(authUrl);

// Print masked env
console.log('\nMasked env:');
console.log('  LINKEDIN_CLIENT_ID:', CLIENT_ID ? CLIENT_ID.slice(0,6) + '...' : '<unset>');
console.log('  LINKEDIN_REDIRECT_URI:', REDIRECT_URI || '<unset>');
