// Assina um arquivo de regras. Uso: node ferramentas/assinar.mjs <regras.json> <chave-privada.jwk>
// Gera <regras.json>.sig com a assinatura ECDSA P-256 / SHA-256 em base64.
import { readFileSync, writeFileSync } from 'node:fs';
export async function assinar(texto, jwk) {
  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, new TextEncoder().encode(texto));
  return Buffer.from(sig).toString('base64');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [arq, chave] = process.argv.slice(2);
  if (!arq || !chave) { console.error('Uso: node ferramentas/assinar.mjs <regras.json> <chave-privada.jwk>'); process.exit(1); }
  writeFileSync(arq + '.sig', await assinar(readFileSync(arq, 'utf8'), JSON.parse(readFileSync(chave, 'utf8'))) + '\n');
  console.log('Assinado: ' + arq + '.sig');
}
