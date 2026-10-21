// Segurança: ataques por texto digitado, senha e criptografia dos dados no aparelho.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from './servidor.mjs';
import { chromium, preencherFamilia } from './navegador.mjs';

let srv, nav;
before(async () => { srv = await iniciar(); nav = await chromium.launch(); });
after(async () => { await nav?.close(); await srv?.fechar(); });
async function abrir() {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  pg.on('dialog', d => { erros.push('janela aberta: ' + d.message()); d.dismiss(); });
  await pg.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective); }));
  await pg.goto(srv.url); await pg.waitForSelector('#comecar');
  return { ctx, pg, erros };
}
const ATAQUES = ['<img src=x onerror="window.__xss=1">', '"><script>window.__xss=2</script>', "'><svg onload=window.__xss=3>", 'javascript:window.__xss=4', '</textarea><iframe src="javascript:window.__xss=5">', '{{constructor.constructor("window.__xss=6")()}}'];

test('Texto de ataque digitado em todos os campos não executa código e aparece como texto', async () => {
  const { ctx, pg, erros } = await abrir();
  await preencherFamilia(pg, { cidade: ATAQUES[0], pessoas: ATAQUES.map((a, i) => ({ nome: a, nasc: '1950-01-0' + (i + 1), fonte: 'informal', renda: '100', cpf: '123.456.789-09' })) });
  await pg.click('[data-ir="1"]');
  await pg.fill('#bairro', ATAQUES[1]); await pg.fill('#rua', ATAQUES[2]); await pg.fill('#referencia', ATAQUES[4]); await pg.fill('#contato2Nome', ATAQUES[5]); await pg.fill('#telefone', ATAQUES[3]);
  for (let i = 0; i < 4; i++) await pg.click('#avancar');
  await pg.click('#abrir-relatorio');
  assert.equal(await pg.evaluate(() => window.__xss), undefined);
  assert.equal(await pg.$$eval('#relatorio img, #relatorio script, #relatorio svg, #relatorio iframe', e => e.length), 0);
  assert.ok((await pg.textContent('#relatorio')).includes('<img src=x onerror="window.__xss=1">'));
  // Página de documentos e cartas: o ataque vira texto na carta e no e-mail.
  await pg.click('[data-ir="5"]');
  await pg.click('#abrir-documentos');
  await pg.fill('input[data-email] >> nth=0', '"><img src=x onerror="window.__xss=2">');
  assert.equal(await pg.evaluate(() => window.__xss), undefined);
  assert.equal(await pg.$$eval('main img, main script, main svg, main iframe', e => e.length), 0);
  assert.ok((await pg.textContent('pre.carta >> nth=0')).includes('<img src=x onerror="window.__xss=1">'));
  const href = await pg.getAttribute('a[data-mailto] >> nth=0', 'href');
  assert.ok(href.startsWith('mailto:?subject='), 'e-mail inválido não pode entrar no endereço: ' + href.slice(0, 60));
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Com senha: nada legível no aparelho, senha errada não abre, senha certa abre', async () => {
  const { ctx, pg, erros } = await abrir();
  await preencherFamilia(pg, { pessoas: [{ nome: 'Maria Sigilosa', nasc: '1980-01-01', fonte: 'informal', renda: '700', cpf: '987.654.321-00' }] });
  await pg.click('[data-ir="1"]'); await pg.click('[data-ir="0"]');
  await pg.click('#criar-senha');
  await pg.fill('#senha1', '123'); await pg.fill('#senha2', '123'); await pg.click('#salvar-senha');
  assert.match(await pg.textContent('#erro-senha'), /pelo menos 6/);
  await pg.fill('#senha1', '482913'); await pg.fill('#senha2', '482914'); await pg.click('#salvar-senha');
  assert.match(await pg.textContent('#erro-senha'), /diferentes/);
  await pg.fill('#senha2', '482913'); await pg.fill('#senha1', '482913'); await pg.click('#salvar-senha');
  await pg.waitForSelector('#tirar-senha');
  await pg.waitForTimeout(400);
  const tudo = await pg.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  for (const segredo of ['Maria Sigilosa', '987.654.321', 'Sigilosa', '700']) assert.ok(!tudo.includes(segredo), 'aparece no armazenamento: ' + segredo);
  await pg.reload(); await pg.waitForSelector('#senha');
  assert.ok(!(await pg.content()).includes('Sigilosa'));
  await pg.fill('#senha', '000000'); await pg.click('#desbloquear');
  await pg.waitForSelector('#erro-senha:not([hidden])');
  assert.match(await pg.textContent('#erro-senha'), /Senha errada/);
  await pg.fill('#senha', '482913'); await pg.press('#senha', 'Enter');
  await pg.waitForSelector('#comecar');
  await pg.click('#comecar'); await pg.click('#avancar');
  assert.equal(await pg.inputValue('#p0_nome'), 'Maria Sigilosa');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Bloquear agora e "Esqueci a senha" apaga tudo', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#ver-exemplo'); await pg.click('[data-ir="1"]'); await pg.click('[data-ir="0"]');
  await pg.click('#criar-senha'); await pg.fill('#senha1', 'abcdef'); await pg.fill('#senha2', 'abcdef'); await pg.click('#salvar-senha');
  await pg.waitForSelector('#bloquear'); await pg.click('#bloquear');
  await pg.waitForSelector('#senha');
  await pg.click('#esqueci'); await pg.click('#limpar-sim');
  await pg.waitForSelector('#comecar');
  assert.equal(await pg.evaluate(() => localStorage.getItem('md_familia')), null);
  await ctx.close();
});

test('Muitas senhas erradas: espera obrigatória', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#ver-exemplo'); await pg.click('[data-ir="1"]'); await pg.click('[data-ir="0"]');
  await pg.click('#criar-senha'); await pg.fill('#senha1', 'certa1'); await pg.fill('#senha2', 'certa1'); await pg.click('#salvar-senha');
  await pg.waitForSelector('#bloquear'); await pg.click('#bloquear'); await pg.waitForSelector('#senha');
  for (let i = 0; i < 5; i++) { await pg.fill('#senha', 'errada' + i); await pg.click('#desbloquear'); await pg.waitForFunction(() => !document.getElementById('desbloquear').disabled); }
  await pg.fill('#senha', 'certa1'); await pg.click('#desbloquear');
  await pg.waitForTimeout(200);
  assert.match(await pg.textContent('#erro-senha'), /Muitas tentativas/);
  await ctx.close();
});

test('Política de segurança bloqueia script injetado de fora', async () => {
  const { ctx, pg } = await abrir();
  const executou = await pg.evaluate(async () => {
    const s = document.createElement('script'); s.textContent = 'window.__injetado = 1'; document.body.appendChild(s);
    const e = document.createElement('script'); e.src = 'https://exemplo.invalid/x.js'; document.body.appendChild(e);
    await new Promise(r => setTimeout(r, 200));
    return window.__injetado;
  });
  assert.equal(executou, undefined);
  assert.ok((await pg.evaluate(() => window.__csp || [])).length >= 1);
  await ctx.close();
});
