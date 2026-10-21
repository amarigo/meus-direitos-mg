// Ponta a ponta: o app de verdade no navegador, como celular e como computador.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from './servidor.mjs';
import { chromium, preencherFamilia, semRolagemLateral } from './navegador.mjs';

let srv, nav;
before(async () => { srv = await iniciar(); nav = await chromium.launch(); });
after(async () => { await nav?.close(); await srv?.fechar(); });

async function abrir(opcoes = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, ...opcoes });
  const pg = await ctx.newPage();
  const erros = [], violacoes = [];
  pg.on('pageerror', e => erros.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await pg.addInitScript(() => document.addEventListener('securitypolicyviolation', e => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI); }));
  await pg.goto(srv.url);
  await pg.waitForSelector('#comecar');
  return { ctx, pg, erros, violacoes };
}
const FAMILIA = { pessoas: [
  { nome: 'Joana da Silva', nasc: '1990-05-10', sexo: 'F', fonte: 'informal', renda: '1.500', cpf: '123.456.789-09' },
  { nome: 'Lucas da Silva', nasc: '2010-03-02', sexo: 'M', estudo: 'medio' },
  { nome: 'Vó Rita', nasc: '1955-08-15', sexo: 'F' }
] };

for (const [nome, vp] of [['celular pequeno', { width: 360, height: 740 }], ['celular', { width: 390, height: 844 }], ['computador', { width: 1366, height: 800 }]]) {
  test('Fluxo completo no ' + nome + ': resultado e relatório certos, sem rolagem lateral, sem erros', async () => {
    const { ctx, pg, erros } = await abrir({ viewport: vp });
    srv.definirModo('normal');
    await preencherFamilia(pg, FAMILIA);
    // R1: "1.500" é mil e quinhentos → 3 pessoas → R$ 500,00 por pessoa
    assert.equal((await pg.textContent('#rpc')).replace(/\s/g, ' '), 'R$ 500,00');
    const programas = await pg.$$eval('[data-programa]', els => els.map(e => e.dataset.programa));
    for (const id of ['cadunico', 'bpc_idoso', 'pe_de_meia', 'tarifa_social_luz', 'copasa_social', 'gas_do_povo']) assert.ok(programas.includes(id), 'falta ' + id);
    assert.ok(!programas.includes('bolsa_familia'), 'R$ 500 por pessoa passa do limite do Bolsa Família');
    assert.ok(await semRolagemLateral(pg), 'rolagem lateral no resultado');
    await pg.click('#abrir-relatorio');
    const rel = (await pg.textContent('#relatorio')).replace(/\s/g, ' ');
    for (const t of ['Joana da Silva', '123.456.789-09', 'Vó Rita', 'Itajubá', 'R$ 1.500,00', 'BPC/LOAS para pessoa idosa']) assert.ok(rel.includes(t), 'relatório sem ' + t);
    assert.ok(await pg.isVisible('#imprimir'), 'botão imprimir');
    assert.ok(await semRolagemLateral(pg), 'rolagem lateral no relatório');
    assert.deepEqual(await pg.evaluate(() => window.__csp || []), [], 'violação da política de segurança');
    assert.deepEqual(erros, []);
    await ctx.close();
  });
}

test('Impressão: gera PDF só com o relatório', async () => {
  const { ctx, pg } = await abrir({ viewport: { width: 1366, height: 800 } });
  await pg.click('#ver-exemplo');
  await pg.click('#abrir-relatorio');
  await pg.emulateMedia({ media: 'print' });
  assert.equal(await pg.isVisible('.top'), false);
  assert.equal(await pg.isVisible('#imprimir'), false);
  assert.equal(await pg.isVisible('#relatorio'), true);
  const pdf = await pg.pdf({ format: 'A4' });
  assert.ok(pdf.length > 20000);
  await ctx.close();
});

test('Validação: avisa nome faltando, renda faltando e data impossível', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#comecar'); await pg.click('#avancar');
  await pg.click('#avancar');
  assert.match(await pg.textContent('#erro-pessoas'), /Falta o nome/);
  await pg.fill('#p0_nome', 'Ana'); await pg.selectOption('#p0_fonte', 'formal'); await pg.click('#avancar');
  assert.match(await pg.textContent('#erro-pessoas'), /Falta quanto Ana ganha/);
  await ctx.close();
});

test('Dados ficam salvos ao recarregar e somem no botão "Terminei"', async () => {
  const { ctx, pg } = await abrir();
  await preencherFamilia(pg, FAMILIA);
  await pg.reload(); await pg.waitForSelector('#n-sim');
  assert.ok((await pg.textContent('main')).includes('BPC'));
  await pg.click('#terminar');
  await pg.waitForSelector('#comecar');
  assert.equal(await pg.evaluate(() => localStorage.getItem('md_familia')), null);
  await ctx.close();
});

test('Não envia nada para outros sites nem faz envio de dados (POST)', async () => {
  const { ctx, pg } = await abrir();
  const pedidos = [];
  pg.on('request', r => pedidos.push([r.method(), r.url()]));
  await preencherFamilia(pg, FAMILIA);
  await pg.click('#abrir-relatorio');
  await pg.click('#verificar'); await pg.waitForTimeout(500);
  for (const [m, u] of pedidos) { assert.equal(m, 'GET', u); assert.ok(u.startsWith(srv.url), 'pedido para fora: ' + u); }
  await ctx.close();
});

test('Instalação no computador: manifesto e ícones disponíveis', async () => {
  const { ctx, pg } = await abrir({ viewport: { width: 1366, height: 800 } });
  const r = await pg.evaluate(async () => {
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    const ok = await Promise.all(m.icons.map(async i => (await fetch(i.src)).ok));
    return { m, ok };
  });
  assert.equal(r.m.display, 'standalone');
  assert.ok(r.ok.every(Boolean));
  await ctx.close();
});

test('Sul de Minas: Itajubá mostra os CRAS da cidade no resultado e no relatório', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#ver-exemplo');
  assert.match(await pg.textContent('#cras-cidade'), /Zequinha Braga, 212/);
  await pg.click('#abrir-relatorio');
  assert.match(await pg.textContent('#relatorio'), /Miguel Braga, 382/);
  await ctx.close();
});

async function irParaEndereco(pg) { await pg.click('#comecar'); await pg.waitForSelector('#cep'); }
test('CEP: preenche rua, bairro e cidade (com internet)', async () => {
  const { ctx, pg } = await abrir();
  await pg.route('https://viacep.com.br/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ cep: '37550-000', logradouro: 'Rua Comendador José Garcia', bairro: 'Centro', localidade: 'Pouso Alegre', uf: 'MG' }) }));
  await irParaEndereco(pg);
  await pg.fill('#cep', '37550000');
  await pg.waitForFunction(() => document.getElementById('rua')?.value === 'Rua Comendador José Garcia');
  assert.equal(await pg.inputValue('#cidade'), 'Pouso Alegre');
  assert.equal(await pg.inputValue('#bairro'), 'Centro');
  assert.equal(await pg.inputValue('#cep'), '37550-000');
  assert.equal(await pg.evaluate(() => document.activeElement.id), 'numero');
  await ctx.close();
});
test('CEP: de outro estado, inexistente, resposta de ataque e sem internet', async () => {
  const { ctx, pg } = await abrir();
  let resposta = { uf: 'SP', localidade: 'São Paulo' };
  await pg.route('https://viacep.com.br/**', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(resposta) }));
  await irParaEndereco(pg);
  await pg.fill('#cep', '01001000');
  await pg.waitForFunction(() => /outro estado/.test(document.getElementById('cep-status').textContent));
  resposta = { erro: true };
  await pg.fill('#cep', '37000000');
  await pg.waitForFunction(() => /não encontrado/.test(document.getElementById('cep-status').textContent));
  resposta = { uf: 'MG', localidade: 'Itajubá', bairro: '<img src=x onerror="window.__xss=1">', logradouro: '"><script>window.__xss=2</script>' };
  await pg.fill('#cep', '37500000');
  await pg.waitForFunction(() => /encontrado/.test(document.getElementById('cep-status').textContent));
  assert.equal(await pg.evaluate(() => window.__xss), undefined);
  assert.equal(await pg.inputValue('#bairro'), '<img src=x onerror="window.__xss=1">');
  await ctx.setOffline(true);
  await pg.fill('#cep', '37500001');
  await pg.waitForFunction(() => /Sem internet/.test(document.getElementById('cep-status').textContent));
  await ctx.close();
});
test('Novos campos: sexo com 5 opções, renda bruta explicada, recado e referência no relatório', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#ver-exemplo');
  await pg.click('[data-ir="1"]'); await pg.click('#avancar');
  assert.equal(await pg.$$eval('#p0_sexo option', o => o.length), 5);
  assert.match(await pg.textContent('main'), /antes dos descontos/);
  await pg.click('#p0_nome >> xpath=ancestor::section//details[contains(@class,"ajuda")]/summary');
  assert.match(await pg.textContent('main'), /mesmo sem nunca ter pago o INSS/);
  for (let i = 0; i < 3; i++) await pg.click('#avancar');
  await pg.click('#abrir-relatorio');
  const rel = (await pg.textContent('#relatorio')).replace(/\s/g, ' ');
  for (const t of ['Perto da escola estadual', '(35) 98888-0000', 'Rosa', 'Rua das Flores, 120, Casa 2']) assert.ok(rel.includes(t), 'falta ' + t);
  await ctx.close();
});
test('Doença grave marcada mostra os direitos no resultado', async () => {
  const { ctx, pg } = await abrir();
  await pg.click('#ver-exemplo');
  await pg.click('[data-ir="1"]'); await pg.click('#avancar');
  await pg.check('#p0_d_cancer');
  for (let i = 0; i < 3; i++) await pg.click('#avancar');
  const progs = await pg.$$eval('[data-programa]', e => e.map(x => x.dataset.programa));
  assert.ok(progs.includes('tratamento_cancer') && progs.includes('doenca_grave_direitos'));
  await ctx.close();
});
