// Gera os ícones PNG a partir do icone.svg (precisa do Playwright). Uso: node ferramentas/icones.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const svg = readFileSync(new URL('../src/icone.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const t of [192, 512]) {
  const pg = await b.newPage({ viewport: { width: t, height: t } });
  await pg.setContent('<style>html,body{margin:0}svg{width:' + t + 'px;height:' + t + 'px;display:block}</style>' + svg);
  await pg.screenshot({ path: new URL('../src/icone-' + t + '.png', import.meta.url).pathname, omitBackground: true });
}
await b.close();
console.log('ícones ok');
