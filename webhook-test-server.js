const http = require('http');

const PORT = 4000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const timestamp = new Date().toISOString();
      console.log('\n' + '='.repeat(60));
      console.log(`[${timestamp}] ${req.method} ${req.url}`);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      try {
        console.log('Body:', JSON.stringify(JSON.parse(body), null, 2));
      } catch {
        console.log('Body (raw):', body);
      }
      console.log('='.repeat(60));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Webhook test server running\n');
  }
});

server.listen(PORT, () => {
  console.log(`Webhook test server listening on http://localhost:${PORT}`);
  console.log('Waiting for events...\n');
});
