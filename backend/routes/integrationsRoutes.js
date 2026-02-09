// backend/routes/integrationsRoutes.js
// Hanterar integrationer: Tradera (koppling, summary, mock, sync, import) + eBay (OAuth) + Agent (OpenAI)

const express = require('express');
const { PrismaClient } = require('@prisma/client');

// Kryptering (vi använder samma som för Tradera-lösenord)
const { encryptSecret } = require('../services/secretService');

// Tradera and eBay integrations removed from this routes file

const prisma = new PrismaClient();
const router = express.Router();

/* -------------------------------------------------------
   Helpers
   ------------------------------------------------------- */

function safeTrimStr(v, maxLen) {
  const s = String(v || '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/* -------------------------------------------------------
   Agent (OpenAI) – POST /api/agent/chat
   Body: { systemPrompt, userPrompt, model }
   ------------------------------------------------------- */
router.post('/agent/chat', async (req, res) => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'OPENAI_API_KEY saknas i environment (Render/.env).',
      });
    }

    // Node 18+ har fetch globalt. Om inte: ge tydlig feltext.
    if (typeof fetch !== 'function') {
      return res.status(500).json({
        ok: false,
        error:
          'Servern saknar global fetch (kräver normalt Node 18+). Uppgradera Node-version på Render eller säg till så löser vi med annan metod.',
      });
    }

    const body = req.body || {};
    const systemPrompt = safeTrimStr(body.systemPrompt, 25000); // stora system-prompter kan vara tunga
    const userPrompt = safeTrimStr(body.userPrompt, 8000);

    // Default-modell (kan ändras senare via env eller UI)
    const model = safeTrimStr(body.model, 100) || 'gpt-4o-mini';

    if (!userPrompt) {
      return res.status(400).json({ ok: false, error: 'Saknar userPrompt.' });
    }

    // Minimera kostnad/abuse: enkel maxlängd redan ovan + låg temp.
    const payload = {
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}

    if (!resp.ok) {
      const msg =
        (json && (json.error?.message || json.message || json.error)) ||
        text ||
        `OpenAI API error (${resp.status})`;

      return res.status(502).json({
        ok: false,
        error: msg,
        status: resp.status,
      });
    }

    const answer =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.text ??
      '';

    return res.json({
      ok: true,
      model: json?.model || model,
      answer: String(answer || '').trim(),
      usage: json?.usage || null,
    });
  } catch (err) {
    console.error('Agent chat error', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Kunde inte anropa OpenAI.',
    });
  }
});

// Tradera and associated endpoints removed

// eBay and Tradera endpoints removed

module.exports = router;
