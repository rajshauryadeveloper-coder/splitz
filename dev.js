import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/ledger.js', ['ledger.js', 'text/javascript']],
]);
const port = Number(process.env.PORT || 3000);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const asset = assets.get(pathname);
  if (!asset) return res.writeHead(404).end();
  const [file, type] = asset;
  res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
  res.end(await readFile(new URL('./public/' + file, import.meta.url)));
}).listen(port, '127.0.0.1', () => console.log('Splitz is running at http://127.0.0.1:' + port));
