// Ponta a ponta: página "Documentos e cartas" e "Quem tem direito a quê, e por quê".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from './servidor.mjs';
import { chromium, semRolagemLateral } from './navegador.mjs';

let srv, nav;
before(async () => { srv = await iniciar(); nav = await chromium.launch(); });
after(async () => { await nav?.close(); await srv?.fechar(); });

async function abrirExemplo(vp = { width: 390, height: 844 }) {
  const ctx = await nav.newContext({ viewport: vp });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await pg.goto(srv.url);
  await pg.click('#ver-exemplo');
  await pg.waitForSelector('#n-sim');
  return { ctx, pg, erros };
}

test('Resultado mostra quem da família tem direito a quê e por quê', async () => {
  const { ctx, pg, erros } = await abrirExemplo();
  const q = (await pg.textContent('#quem-tem-direito')).replace(/\s/g, ' ');
  assert.match(q, /José \(exemplo\) \(\d+ anos\)/);
  assert.match(q, /Benefício de Prestação Continuada \(BPC\/LOAS\) para pessoa idosa.*José \(exemplo\) tem \d+ anos/);
  assert.match(q, /Família toda/);
  assert.ok((await pg.$$('.porque')).length > 0, 'cartões sem "Por quê"');
  assert.deepEqual(erros, []);
  await ctx.close();
});

for (const [nome, vp] of [['celular pequeno', { width: 360, height: 740 }], ['computador', { width: 1366, height: 800 }]]) {
  test('Documentos e cartas no ' + nome + ': um bloco por local, checklist, carta e e-mail', async () => {
    const { ctx, pg, erros } = await abrirExemplo(vp);
    await pg.click('#abrir-documentos');
    await pg.waitForSelector('#local-cras');
    const locais = await pg.$$eval('section.local', els => els.map(e => e.dataset.canal));
    assert.equal(locais[0], 'cras');
    assert.equal(new Set(locais).size, locais.length);
    // Carta do CRAS explica a situação e pede a verificação.
    const carta = await pg.textContent('#local-cras pre.carta');
    for (const trecho of ['Maria Aparecida (exemplo)', 'SITUAÇÃO DA FAMÍLIA', 'PEDIDO', 'Peço a verificação', 'Motivo:', 'DOCUMENTOS QUE APRESENTO', 'protocolo', 'Itajubá']) assert.ok(carta.includes(trecho), 'carta sem: ' + trecho);
    // Checklist com nomes das pessoas.
    const nomes = await pg.$$eval('#local-cras .doc-item label', els => els.map(e => e.textContent));
    assert.ok(nomes.includes('José (exemplo)'));
    assert.ok(await semRolagemLateral(pg), 'rolagem lateral');
    assert.deepEqual(erros, []);
    await ctx.close();
  });
}

test('Checklist: marcar documento conta, fica salvo e volta marcado depois de fechar o app', async () => {
  const { ctx, pg, erros } = await abrirExemplo();
  await pg.click('#abrir-documentos');
  const conta = () => pg.textContent('#local-cras .conta-docs');
  const antes = await conta();
  const total = +antes.match(/de (\d+)/)[1];
  assert.match(antes, /^0 de/);
  await pg.check('#local-cras input[data-doc] >> nth=0');
  await pg.check('#local-cras input[data-doc] >> nth=1');
  assert.match(await conta(), /^2 de /);
  await pg.uncheck('#local-cras input[data-doc] >> nth=1');
  assert.match(await conta(), /^1 de /);
  const ch = await pg.getAttribute('#local-cras input[data-doc] >> nth=0', 'data-doc');
  await pg.waitForTimeout(700);
  await pg.reload();
  await pg.waitForSelector('#local-cras');
  assert.ok(await pg.isChecked(`input[data-doc="${ch}"]`), 'marcação perdida ao reabrir');
  assert.match(await conta(), new RegExp('^1 de ' + total));
  // Marcar tudo mostra "Tudo pronto!"
  for (const c of await pg.$$('#local-cras input[data-doc]')) await c.check();
  assert.match(await conta(), /Tudo pronto/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('E-mail: endereço válido entra no link, carta vai no corpo, e fica salvo', async () => {
  const { ctx, pg, erros } = await abrirExemplo();
  await pg.click('#abrir-documentos');
  await pg.fill('#local-cras input[data-email]', 'cras@itajuba.mg.gov.br');
  const href = await pg.getAttribute('#local-cras a[data-mailto]', 'href');
  assert.ok(href.startsWith('mailto:cras@itajuba.mg.gov.br?subject='), href.slice(0, 80));
  const corpo = decodeURIComponent(href.split('&body=')[1]);
  assert.ok(corpo.includes('SITUAÇÃO DA FAMÍLIA') && corpo.includes('Seguem em anexo'));
  await pg.fill('#local-cras input[data-email]', 'cras@ itajuba');
  assert.ok((await pg.getAttribute('#local-cras a[data-mailto]', 'href')).startsWith('mailto:?subject='), 'e-mail inválido não entra no link');
  await pg.fill('#local-cras input[data-email]', 'cras@itajuba.mg.gov.br');
  await pg.waitForTimeout(700);
  await pg.reload();
  await pg.waitForSelector('#local-cras');
  assert.equal(await pg.inputValue('#local-cras input[data-email]'), 'cras@itajuba.mg.gov.br');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Copiar a carta coloca o texto da carta na área de transferência', async () => {
  const { ctx, pg, erros } = await abrirExemplo();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url.replace(/\/$/, '') });
  await pg.click('#abrir-documentos');
  await pg.click('#local-cras [data-copiar]');
  await pg.waitForSelector('#toast:not([hidden])');
  const copiado = await pg.evaluate(() => navigator.clipboard.readText());
  assert.equal(copiado, await pg.textContent('#local-cras pre.carta'));
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Imprimir carta e lista de um local imprime só aquele local, com a carta aberta', async () => {
  const { ctx, pg, erros } = await abrirExemplo();
  await pg.click('#abrir-documentos');
  await pg.evaluate(() => { window.print = () => { window.__impresso = { classe: document.body.className, este: [...document.querySelectorAll('.imprimir-este')].map(e => e.id), aberta: document.querySelector('.imprimir-este details').open }; }; });
  const segundo = (await pg.$$eval('section.local', els => els.map(e => e.dataset.canal)))[1];
  await pg.click(`#local-${segundo} details.carta-bloco summary`);
  await pg.click(`#local-${segundo} [data-imprimir]`);
  const r = await pg.evaluate(() => window.__impresso);
  assert.match(r.classe, /imprimir-um/);
  assert.deepEqual(r.este, ['local-' + segundo]);
  assert.equal(r.aberta, true);
  await pg.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await pg.evaluate(() => document.body.classList.contains('imprimir-um')), false);
  // PDF de verdade: só um local aparece.
  await pg.click(`#local-${segundo} [data-imprimir]`);
  await pg.emulateMedia({ media: 'print' });
  const visiveis = await pg.$$eval('section.local', els => els.filter(e => getComputedStyle(e).display !== 'none').length);
  assert.equal(visiveis, 1);
  const pdf = await pg.pdf();
  assert.ok(pdf.length > 5000);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Relatório impresso traz quem tem direito e a carta de cada local', async () => {
  const { ctx, pg, erros } = await abrirExemplo();
  await pg.click('#abrir-relatorio');
  const rel = (await pg.textContent('#relatorio')).replace(/\s/g, ' ');
  assert.match(rel, /Quem tem direito a quê, e por quê/);
  assert.match(rel, /Peço a verificação/);
  assert.match(rel, /Por quê/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Questionário para WhatsApp: todas as perguntas, copiar e link do WhatsApp', async () => {
  const ctx = await nav.newContext({ viewport: { width: 360, height: 740 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url.replace(/\/$/, '') });
  const pg = await ctx.newPage(); const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(srv.url);
  await pg.click('#abrir-questionario');
  const t = await pg.textContent('#texto-questionario');
  for (const trecho of ['CEP', 'Ponto de referência', 'Outro telefone para recado', 'antes dos descontos', 'Benefício de Prestação Continuada', 'Câncer', 'Prefiro não responder', 'CadÚnico', 'Bolsa Família', 'emergência', 'não responda por aqui', 'DOCUMENTOS']) assert.ok(t.includes(trecho), 'questionário sem: ' + trecho);
  const href = await pg.getAttribute('#whatsapp-questionario', 'href');
  assert.ok(href.startsWith('https://wa.me/?text='));
  assert.equal(decodeURIComponent(href.split('text=')[1]), t);
  await pg.click('#copiar-questionario');
  await pg.waitForSelector('#toast:not([hidden])');
  assert.equal(await pg.evaluate(() => navigator.clipboard.readText()), t);
  assert.ok(await semRolagemLateral(pg));
  await pg.click('[data-ir="0"]');
  await pg.waitForSelector('#comecar');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Pouso Alegre: benefícios da Prefeitura aparecem no resultado e na carta do CRAS', async () => {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage(); const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(srv.url);
  await pg.click('#ver-exemplo');
  await pg.click('[data-ir="1"]');
  await pg.fill('#cidade', 'Pouso Alegre');
  for (let i = 0; i < 4; i++) await pg.click('#avancar');
  const progs = await pg.$$eval('[data-programa]', els => els.map(e => e.dataset.programa));
  assert.ok(progs.includes('pa_eventuais'), progs.join(','));
  assert.ok(!progs.includes('beneficio_eventual'));
  await pg.click('#abrir-documentos');
  assert.match(await pg.textContent('#local-cras pre.carta'), /Pouso Alegre: cesta básica/);
  assert.deepEqual(erros, []);
  await ctx.close();
});
