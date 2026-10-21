// Gera o par de chaves que assina as atualizações de regras.
// A chave PRIVADA nunca deve ir para o repositório. Uso: node ferramentas/gerar-chaves.mjs <pasta-segura>
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const pasta = process.argv[2];
if (!pasta) { console.error('Informe a pasta onde guardar a chave privada (fora do repositório).'); process.exit(1); }
const destino = join(pasta, 'chave-privada-regras.jwk');
if (existsSync(destino)) { console.error('Já existe uma chave em ' + destino + '. Não vou sobrescrever.'); process.exit(1); }
const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await crypto.subtle.exportKey('jwk', par.privateKey);
const pub = await crypto.subtle.exportKey('jwk', par.publicKey);
writeFileSync(destino, JSON.stringify(priv), { mode: 0o600 });
writeFileSync(new URL('../src/chave-publica.json', import.meta.url), JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }) + '\n');
console.log('Chave privada: ' + destino + '\nChave pública: src/chave-publica.json');
