// Função serverless da Vercel: envia eventos para a API de Conversões da Meta.
// O token NUNCA vai para o navegador — configure na Vercel a variável de
// ambiente META_CAPI_TOKEN (Settings → Environment Variables).
const crypto = require('crypto');

const PIXEL_ID = process.env.META_PIXEL_ID || '2164901857787257';
const API_VERSION = 'v21.0';

function sha256(v) {
  return v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;
}

function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d; // número BR sem DDI
  return d;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(500).json({ error: 'META_CAPI_TOKEN não configurado' });

  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;
  const firstName = String(b.nome || '').trim().split(/\s+/)[0];
  let fbc = b.fbc;
  if (!fbc && b.fbclid) fbc = `fb.1.${Date.now()}.${b.fbclid}`;

  const event = {
    event_name: b.event_name || 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    event_id: b.event_id,
    event_source_url: b.event_source_url,
    action_source: 'website',
    user_data: {
      em: sha256(b.email) ? [sha256(b.email)] : undefined,
      ph: normPhone(b.phone) ? [sha256(normPhone(b.phone))] : undefined,
      fn: sha256(firstName) ? [sha256(firstName)] : undefined,
      country: [sha256('br')],
      client_ip_address: ip,
      client_user_agent: req.headers['user-agent'],
      fbp: b.fbp || undefined,
      fbc: fbc || undefined,
    },
  };

  try {
    const r = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [event] }) }
    );
    const out = await r.json();
    return res.status(r.ok ? 200 : 502).json(out);
  } catch (e) {
    return res.status(502).json({ error: 'falha ao enviar para a Meta' });
  }
};
