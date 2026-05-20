import { bot } from '../src/bot.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, hint: 'POST updates here' });
  }
  try {
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error('Webhook error:', err);
  }
  res.status(200).end();
}
