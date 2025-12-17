// backend/routes/agentRoutes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Minimal OpenAI-call (behåller din nuvarande modellval)
// OBS: Om du redan har en fungerande OpenAI-service kan vi byta till den senare.
async function callOpenAI({ systemPrompt, userPrompt, model }) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY saknas i environment.');
  }

  const payload = {
    model: model || 'gpt-4o-mini-2024-07-18',
    messages: [
      { role: 'system', content: systemPrompt || 'Du är en hjälpsam assistent.' },
      { role: 'user', content: userPrompt || '' },
    ],
    temperature: 0.3,
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}

  if (!resp.ok) {
    const msg =
      (json && (json.error && json.error.message)) ||
      (json && json.message) ||
      text ||
      'OpenAI error';
    throw new Error(msg);
  }

  const answer = json?.choices?.[0]?.message?.content || '';
  const usage = json?.usage || null;

  return {
    model: json?.model || payload.model,
    answer,
    usage,
  };
}

/**
 * POST /api/agent/chat
 * body:
 *  - email (valfri men rekommenderad)
 *  - conversationId (valfri; om saknas skapas ny)
 *  - systemPrompt (valfri)
 *  - userPrompt (krävs)
 *  - model (valfri)
 */
router.post('/agent/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const conversationIdIn = String(body.conversationId || '').trim();
    const systemPrompt = String(body.systemPrompt || '').trim();
    const userPrompt = String(body.userPrompt || '').trim();
    const model = String(body.model || '').trim();

    if (!userPrompt) {
      return res.status(400).json({ ok: false, error: 'Saknar userPrompt.' });
    }

    // 1) Hitta customer (om email skickas in)
    let customer = null;
    if (email) {
      customer = await prisma.customer.findFirst({
        where: { OR: [{ subjectRef: email }, { email }] },
        select: { id: true },
      });
    }

    // 2) Hämta/skapa konversation
    let convo = null;

    if (conversationIdIn) {
      convo = await prisma.agentConversation.findUnique({
        where: { id: conversationIdIn },
      });
    }

    if (!convo) {
      convo = await prisma.agentConversation.create({
        data: {
          customerId: customer?.id || null,
          title: 'Agent chat',
          systemPrompt: systemPrompt || null,
        },
      });
    } else {
      // Uppdatera systemPrompt om den skickas (så den sparas per konversation)
      if (systemPrompt && systemPrompt !== (convo.systemPrompt || '')) {
        convo = await prisma.agentConversation.update({
          where: { id: convo.id },
          data: { systemPrompt },
        });
      }
      // Om konversation saknar customer och vi nu har en customer -> koppla på
      if (!convo.customerId && customer?.id) {
        convo = await prisma.agentConversation.update({
          where: { id: convo.id },
          data: { customerId: customer.id },
        });
      }
    }

    // 3) Spara user-meddelande
    await prisma.agentMessage.create({
      data: {
        conversationId: convo.id,
        role: 'user',
        content: userPrompt,
      },
    });

    // 4) Kör OpenAI
    const ai = await callOpenAI({
      systemPrompt: systemPrompt || convo.systemPrompt || 'Du är en hjälpsam assistent.',
      userPrompt,
      model: model || undefined,
    });

    // 5) Spara assistant-meddelande + usage
    await prisma.agentMessage.create({
      data: {
        conversationId: convo.id,
        role: 'assistant',
        content: ai.answer || '',
        model: ai.model || null,
        promptTokens: ai.usage?.prompt_tokens ?? null,
        completionTokens: ai.usage?.completion_tokens ?? null,
        totalTokens: ai.usage?.total_tokens ?? null,
      },
    });

    return res.json({
      ok: true,
      conversationId: convo.id,
      model: ai.model,
      answer: ai.answer,
      usage: ai.usage || null,
    });
  } catch (err) {
    console.error('❌ /api/agent/chat error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// (Valfritt men praktiskt) Lista konversationer för en användare via email
router.get('/agent/conversations', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: 'Saknar email' });

    const customer = await prisma.customer.findFirst({
      where: { OR: [{ subjectRef: email }, { email }] },
      select: { id: true },
    });
    if (!customer) return res.json({ ok: true, conversations: [] });

    const conversations = await prisma.agentConversation.findMany({
      where: { customerId: customer.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });

    return res.json({ ok: true, conversations });
  } catch (err) {
    console.error('❌ /api/agent/conversations error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// (Valfritt) Hämta meddelanden för en konversation
router.get('/agent/conversations/:id/messages', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ ok: false, error: 'Saknar id' });

    const messages = await prisma.agentMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, model: true, createdAt: true },
    });

    return res.json({ ok: true, messages });
  } catch (err) {
    console.error('❌ /api/agent/conversations/:id/messages error:', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;
