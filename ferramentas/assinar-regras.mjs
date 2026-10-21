// Assina src/regras.json (do jeito que vai para o ar) e grava src/regras.json.sig.pronta.
// Rode depois de qualquer mudança nas regras: CHAVE_PRIVADA=/caminho/chave.jwk npm run assinar
import { readFileSync, writeFileSync } from 'node:fs';
import { assinar } from './assinar.mjs';
const caminho = process.env.CHAVE_PRIVADA || '/mnt/project-files/direitos-app-segredos/chave-privada-regras.jwk';
const texto = JSON.stringify(JSON.parse(readFileSync(new URL('../src/regras.json', import.meta.url), 'utf8')));
writeFileSync(new URL('../src/regras.json.sig.pronta', import.meta.url), await assinar(texto, JSON.parse(readFileSync(caminho, 'utf8'))) + '\n');
console.log('Regras assinadas.');
