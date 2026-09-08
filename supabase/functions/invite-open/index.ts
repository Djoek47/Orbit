/**
 * HTTPS invite landing (fallback until www.choremaxx.app/join is deployed).
 * Opens choremaxx://join/CODE — deploy with --no-verify-jwt.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CHOREMAXX-/, 'CMX-')
    .replace(/^(CMX|ORBIT)(?=[A-Z0-9])/, '$1-');
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const url = new URL(req.url);
  const code = normalizeCode(url.searchParams.get('code') || url.pathname.split('/').pop() || '');
  if (!code || code.length < 4) {
    return new Response('Missing invite code', { status: 400, headers: cors });
  }

  const appUrl = `choremaxx://join/${encodeURIComponent(code)}`;
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Join ${code} — Choremaxx</title>
<meta http-equiv="refresh" content="0;url=${appUrl}"/>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#F7F4F2;display:flex;min-height:100vh;align-items:center;justify-content:center}
card{display:block;background:#fff;border-radius:24px;padding:32px;max-width:400px;text-align:center;box-shadow:0 8px 32px rgba(216,90,48,.12)}
h1{font-size:24px;margin:16px 0 8px;color:#0F0E17}
code{font-size:28px;font-weight:800;letter-spacing:.06em}
a.btn{display:inline-block;margin-top:20px;background:#D85A30;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700}
</style>
</head><body>
<card>
  <div><span style="color:#C4922A;font-weight:800;font-size:22px">chore</span><span style="color:#D85A30;font-weight:800;font-size:22px">maxx</span></div>
  <h1>You're invited</h1>
  <code>${code}</code>
  <p style="color:#3D3A4E">Opening Choremaxx…</p>
  <a class="btn" href="${appUrl}">Open in Choremaxx</a>
</card>
<script>location.href=${JSON.stringify(appUrl)};</script>
</body></html>`;

  return new Response(html, {
    headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' },
  });
});
