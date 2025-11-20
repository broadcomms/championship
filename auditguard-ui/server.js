const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Check if certificates exist
const certPath = path.join(__dirname, 'localhost+2.pem');
const keyPath = path.join(__dirname, 'localhost+2-key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ SSL certificates not found!');
  console.error('\nPlease generate certificates first:');
  console.error('  1. Install mkcert: sudo apt install libnss3-tools && wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 && chmod +x mkcert-v1.4.4-linux-amd64 && sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert');
  console.error('  2. Install local CA: mkcert -install');
  console.error('  3. Generate certs: cd /home/patrick/championship/auditguard-ui && mkcert localhost 127.0.0.1 ::1');
  console.error('\nOr run without HTTPS: npm run dev:http\n');
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`✅ Ready on https://${hostname}:${port}`);
    console.log('🎤 Microphone access enabled (HTTPS)');
  });
});
