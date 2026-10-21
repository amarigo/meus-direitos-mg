// Servidor de teste que entrega o app de dist/ e injeta falhas (engenharia de caos) nas atualizações de regras.
// Usa uma chave de TESTE: troca a chave pública no index.html e assina as regras com ela.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { assinar } from '../../ferramentas/assinar.mjs';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.sig': 'text/plain', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

export async function iniciar() {
  const dist = new URL('../../dist/', import.meta.url).pathname;
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const intruso = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwkPriv = await crypto.subtle.exportKey('jwk', par.privateKey);
  const jwkIntruso = await crypto.subtle.exportKey('jwk', intruso.privateKey);
  const pub = await crypto.subtle.exportKey('jwk', par.publicKey);
  const chavePub = JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y });
  const index = readFileSync(dist + 'index.html', 'utf8').replace(/(id="chave-publica">)[\s\S]*?(<\/script>)/, '$1' + chavePub + '$2');
  const base = readFileSync(dist + 'regras.json', 'utf8');
  const obj = JSON.parse(base);
  const nova = JSON.stringify({ ...obj, versao: '2099.1.1', programas: obj.programas.map(p => p.id === 'cadunico' ? { ...p, titulo: 'Cadastro Único ATUALIZADO' } : p) });
  const antiga = JSON.stringify({ ...obj, versao: '2000.1.1' });
  const invalida = JSON.stringify({ ...JSON.parse(nova), parametros: { ...obj.parametros, salarioMinimo: 0 } });
  const corrompida = nova.slice(0, Math.floor(nova.length / 2));
  const xss = JSON.stringify({ ...JSON.parse(nova), versao: '2099.2.1', programas: obj.programas.map(p => p.id === 'cadunico' ? { ...p, titulo: '<img src=x onerror="window.__xss=9">', fonte: { nome: 'x', url: 'https://ok.example/"><script>window.__xss=8</script>' } } : p) });
  const assinados = {};
  for (const [k, t] of Object.entries({ normal: base, nova, antiga, invalida, corrompida, xss })) assinados[k] = { texto: t, sig: await assinar(t, jwkPriv) };
  assinados.falsa = { texto: nova, sig: await assinar(nova, jwkIntruso) };

  let modo = 'normal';
  const pedidos = [];
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    pedidos.push({ metodo: req.method, caminho: url.pathname });
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const ehRegras = p === '/regras.json', ehSig = p === '/regras.json.sig';
    if (ehRegras || ehSig) {
      if (modo === 'erro500') { res.writeHead(500); return res.end('erro'); }
      if (modo === 'cai') { req.socket.destroy(); return; }
      if (modo === 'portal') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html><body>Faça login no Wi-Fi</body></html>'); }
      const enviar = () => { const a = assinados[modo] || assinados.normal; res.writeHead(200, { 'content-type': ehSig ? 'text/plain' : 'application/json', 'cache-control': 'no-store' }); res.end(ehSig ? a.sig : a.texto); };
      if (modo === 'lento') return setTimeout(() => { try { enviar(); } catch (e) {} }, 25000);
      if (modo === 'instavel' && Math.random() < 0.5) { req.socket.destroy(); return; }
      return enviar();
    }
    const arq = normalize(join(dist, p));
    if (!arq.startsWith(dist) || !existsSync(arq) || statSync(arq).isDirectory()) { res.writeHead(404); return res.end('não encontrado'); }
    res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(p === '/index.html' ? index : readFileSync(arq));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const porta = srv.address().port;
  return { url: 'http://localhost:' + porta + '/', definirModo: m => { modo = m; }, pedidos, fechar: () => new Promise(r => { srv.closeAllConnections?.(); srv.close(r); }) };
}
