const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Load environment variables early
require('dotenv').config();

// Cookie parser for this router (safe to apply only here)
const cookieParser = require('cookie-parser');
router.use(cookieParser());

// Polyfill fetch on older Node versions
if (typeof fetch !== 'function') {
  try {
    // node-fetch v3 exports ESM by default; require returns a function when installed with CJS interop
    // This works if `npm install node-fetch` was run.
    global.fetch = require('node-fetch');
  } catch (e) {
    console.warn('node-fetch not available; global.fetch may be undefined in this Node runtime');
  }
}

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;

// Start-up debug (masked)
try {
  console.log('LinkedIn OAuth debug:');
  console.log('  LINKEDIN_CLIENT_ID:', CLIENT_ID ? `${CLIENT_ID.slice(0,6)}...` : '<unset>');
  console.log('  LINKEDIN_CLIENT_SECRET:', CLIENT_SECRET ? `${CLIENT_SECRET.slice(0,6)}...` : '<unset>');
  console.log('  LINKEDIN_REDIRECT_URI:', REDIRECT_URI || '<unset>');
  console.log('  Node version:', process.version);
  console.log('  global.fetch available:', typeof fetch === 'function');
} catch (e) {
  console.error('Error logging LinkedIn debug info', e);
}

function genState() {
  return crypto.randomBytes(12).toString('hex');
}

// Redirect user to LinkedIn authorization
router.get('/linkedin', (req, res) => {
  if (!CLIENT_ID || !REDIRECT_URI) return res.status(500).send('OIDC not configured');
  const state = genState();
  // store state in cookie for validation (short lived)
  res.cookie('ln_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 5 * 60 * 1000 });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile email',
    state,
  });

  // Ensure spaces in scope are percent-encoded as %20 (LinkedIn accepts either, but
  // some platforms expect %20 rather than '+').
  const rawQs = params.toString();
  const qs = rawQs.replace(/\+/g, '%20');
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${qs}`;
  console.log('LinkedIn authorization redirect URL:', authUrl);
  res.redirect(authUrl);
});

// Callback that LinkedIn will redirect to
router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('LinkedIn callback received. query:', req.query);
    console.log('req.cookies object:', req.cookies);
    const savedState = req.cookies && req.cookies.ln_state;
    console.log('LinkedIn callback savedState cookie:', savedState);
    console.log('state (query):', state, ' savedState (cookie):', savedState);
    if (!state || !savedState || state !== savedState) {
      return res.status(400).send('Invalid state');
    }

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return res.status(500).send('OIDC not configured');
    }

    // Exchange code for access token
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code || ''),
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    // Mask client_secret before logging
    const rawTokenBody = tokenBody.toString();
    const maskedTokenBody = rawTokenBody.replace(/(client_secret=)[^&]+/, '$1<masked>');
    console.log('LinkedIn token request body (masked):', maskedTokenBody);
    const tokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });
    console.log('LinkedIn token endpoint status:', tokenResp.status, tokenResp.statusText);
    console.log('LinkedIn token endpoint content-type:', tokenResp.headers.get('content-type'));

    // Log token endpoint response for debugging
    let tokenJson;
    try {
      tokenJson = await tokenResp.json();
    } catch (e) {
      const txt = await tokenResp.text().catch(() => '<no-body>');
      console.error('LinkedIn token endpoint non-json response:', txt);
      return res.status(500).send('Token exchange failed');
    }
    console.log('LinkedIn token response (parsed):', tokenJson);
    if (!tokenJson || !tokenJson.access_token) {
      console.error('LinkedIn token error', tokenJson);
      if (tokenJson && (tokenJson.error || (tokenJson.error_description && /redirect|mismatch/i.test(tokenJson.error_description)))) {
        console.error('Possible redirect_uri mismatch detected in token response');
      }
      return res.status(500).send('Token exchange failed');
    }

    const accessToken = tokenJson.access_token;

    // Fetch basic profile
    const profileRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();

    // Fetch email
    const emailRes = await fetch(
      'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const emailJson = await emailRes.json();
    const email = emailJson?.elements?.[0]?.['handle~']?.emailAddress;

    const user = {
      id: profile.id,
      firstName: profile.localizedFirstName,
      lastName: profile.localizedLastName,
      email,
    };

    // For simplicity (easy setup for non-coders) store a small user cookie that frontend can read.
    // In production, use secure sessions or a signed JWT.
    // encode the JSON so it is safe to store in a cookie and readable by frontend script
    res.cookie('peerRateUser', encodeURIComponent(JSON.stringify(user)), { maxAge: 60 * 60 * 1000 });

    // Clear state cookie
    res.clearCookie('ln_state');

    // Redirect to profile or landing page
    res.redirect('/profile.html');
  } catch (err) {
    console.error('LinkedIn callback error', err);
    res.status(500).send('Authentication failed');
  }
});

module.exports = router;
