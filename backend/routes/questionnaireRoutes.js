const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const STORAGE = path.join(__dirname, '..', '..', 'data', 'questionnaire_responses.json');

function readStorage() {
  try {
    if (!fs.existsSync(STORAGE)) return [];
    const raw = fs.readFileSync(STORAGE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Could not read questionnaire storage', err);
    return [];
  }
}

function writeStorage(arr) {
  try {
    fs.writeFileSync(STORAGE, JSON.stringify(arr, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Could not write questionnaire storage', err);
    return false;
  }
}

// Create new questionnaire response
router.post('/', (req, res) => {
  const body = req.body;
  if (!body || !body.responses || !body.responses.reviewer_name || !body.responses.reviewer_email) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const store = readStorage();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    engagement: body.engagement || null,
    responses: body.responses || {},
    metadata: body.metadata || {},
  };

  store.push(entry);
  const ok = writeStorage(store);
  if (!ok) return res.status(500).json({ ok: false, error: 'Failed to persist response' });

  // Return a minimal public-safe acknowledgement (do not echo private fields)
  return res.status(201).json({ ok: true, id: entry.id, createdAt: entry.createdAt });
});

// Send questionnaire invitation to an email address.
// If SMTP env vars are configured and nodemailer is available, attempt to send.
// Otherwise queue the email to data/questionnaire_emails.json for later processing.
router.post('/send', async (req, res) => {
  try {
    const { to, subject, engagement, message } = req.body || {};
    if (!to || typeof to !== 'string') return res.status(400).json({ ok: false, error: 'Missing target email (to)' });

    const EMAILS = path.join(__dirname, '..', '..', 'data', 'questionnaire_emails.json');

    // Build default subject/body
    const mailSubject = subject || `PeerRate: Feedback request for ${engagement && engagement.consultant ? engagement.consultant : 'consultant'}`;
    const baseUrl = process.env.BASE_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`;
    // Public feedback page (no login) with engagement context encoded in query string
    const params = new URLSearchParams();
    if (engagement && engagement.consultant) params.set('consultant', engagement.consultant);
    if (engagement && engagement.role) params.set('role', engagement.role);
    if (engagement && engagement.type) params.set('type', engagement.type);
    const replyLink = `${baseUrl}/feedback.html?${params.toString()}`;
    const bodyHtml = message || `<p>You have been invited to provide feedback for the engagement:</p>
      <p><strong>${(engagement && engagement.consultant) || ''}</strong><br>${(engagement && engagement.role) || ''}<br>${(engagement && engagement.type) || ''}</p>
      <p>Please click the link to open the feedback form:</p>
      <p><a href="${replyLink}">${replyLink}</a></p>`;

    // If SMTP configured, try to send using nodemailer
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      try {
        const nodemailer = require('nodemailer');
        const transportOpts = {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        };
        if (process.env.SMTP_USER) {
          transportOpts.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
        }

        const transporter = nodemailer.createTransport(transportOpts);
        const info = await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@peerrate.ai', to, subject: mailSubject, html: bodyHtml });
        return res.status(200).json({ ok: true, sent: true, info });
      } catch (err) {
        console.warn('SMTP send failed, falling back to queue:', err && err.message ? err.message : err);
        // fallthrough to queue
      }
    }

    // Queue the email
    let queue = [];
    try {
      if (fs.existsSync(EMAILS)) {
        const raw = fs.readFileSync(EMAILS, 'utf8');
        queue = JSON.parse(raw || '[]');
      }
    } catch (err) {
      console.error('Could not read email queue', err);
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      to,
      subject: mailSubject,
      bodyHtml,
      engagement: engagement || null,
      queuedAt: new Date().toISOString(),
    };

    queue.push(entry);

    try {
      fs.writeFileSync(EMAILS, JSON.stringify(queue, null, 2), 'utf8');
    } catch (err) {
      console.error('Could not write email queue', err);
      return res.status(500).json({ ok: false, error: 'Failed to queue email' });
    }

    return res.status(200).json({ ok: true, queued: true, id: entry.id });
  } catch (err) {
    console.error('Send endpoint error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;

