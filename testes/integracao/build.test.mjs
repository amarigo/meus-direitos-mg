// Saída do build: o que vai para o ar está seguro e coerente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Seguranca, Motor } from '../ajuda.mjs';
const dist = f => new URL('../../dist/' + f, import.meta.url);
const ler = f => readFileSync(dist(f), 'utf8');

test('build existe', () => { assert.ok(existsSync(dist('index.html')), 'rode npm run build antes'); });
test('index.html tem política de segurança rígida e nenhum recurso de terceiros', () => {
  const h = ler('index.html');
  const csp = h.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const d of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(d), d);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
  assert.ok(!/<script(?![^>]*application\/json)[^>]*>[^<]+<\/script>/.test(h), 'não pode ter script embutido executável');
  assert.ok(!/(src|href)="https?:/.test(h), 'nada carregado de outro site');
  assert.ok(!/style="/.test(h));
});
test('o código do app não usa eval, innerHTML com dados sem esc ou estilos embutidos', () => {
  const app = ler('app.js');
  assert.ok(!/\beval\(|new Function\(/.test(app));
  assert.ok(!/style="/.test(app));
});
test('regras publicadas são idênticas às embutidas e estão assinadas pela chave do app', async () => {
  const texto = ler('regras.json'), sig = ler('regras.json.sig');
  const h = ler('index.html');
  const embutida = JSON.parse(h.match(/id="regras-embutidas">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(embutida, JSON.parse(texto));
  const chave = JSON.parse(h.match(/id="chave-publica">([\s\S]*?)<\/script>/)[1]);
  assert.equal(chave.d, undefined, 'a chave PRIVADA nunca pode ir para o app');
  assert.equal(await Seguranca.conferirAssinatura(texto, sig, chave), true);
  assert.deepEqual(Motor.validarRegras(JSON.parse(texto)), []);
});
test('arquivos para instalar no celular e no computador', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  for (const t of ['192x192', '512x512']) assert.ok(m.icons.some(i => i.sizes === t && i.type === 'image/png'));
  for (const i of m.icons) assert.ok(existsSync(dist(i.src)), i.src);
  const sw = ler('sw.js');
  assert.ok(!sw.includes('__VERSAO__'));
  for (const f of sw.match(/'\.\/[^']*'/g).map(s => s.slice(3, -1)).filter(Boolean)) assert.ok(existsSync(dist(f)), 'service worker lista arquivo inexistente: ' + f);
});
