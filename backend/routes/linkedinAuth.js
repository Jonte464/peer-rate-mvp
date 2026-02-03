const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;

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
    scope: 'r_liteprofile r_emailaddress',
    state,
  });

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});

// Callback that LinkedIn will redirect to
router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('LinkedIn callback received. query:', req.query);
    const savedState = req.cookies && req.cookies.ln_state;
    console.log('LinkedIn callback savedState cookie:', savedState);
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
    console.log('LinkedIn token request body:', tokenBody.toString());
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
    console.log('LinkedIn token response:', tokenJson);
    if (!tokenJson || !tokenJson.access_token) {
      console.error('LinkedIn token error', tokenJson);
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
