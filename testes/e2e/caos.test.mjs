// Engenharia de caos: o app continua funcionando e seguro quando a internet, o servidor ou o aparelho falham.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from './servidor.mjs';
import { chromium, preencherFamilia } from './navegador.mjs';

let srv, nav;
before(async () => { srv = await iniciar(); nav = await chromium.launch(); });
after(async () => { await nav?.close(); await srv?.fechar(); });

const VERSAO_APP = JSON.parse((await import('node:fs')).readFileSync(new URL('../../dist/regras.json', import.meta.url), 'utf8')).versao;
async function abrir(initScript) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message));
  if (initScript) await pg.addInitScript(initScript);
  await pg.goto(srv.url); await pg.waitForSelector('#comecar');
  return { ctx, pg, erros };
}
async function tentarAtualizar(pg) {
  await pg.evaluate(() => window.__md.verificarAtualizacao(true));
  return pg.evaluate(() => ({ versao: window.__md.versaoRegras(), motivo: window.__md.ultimoResultado.motivo }));
}

const cenarios = [
  ['nova', 'atualização verdadeira é aceita', true, 'ok'],
  ['antiga', 'versão mais velha é ignorada (ataque de rebaixamento)', false, 'versão não é mais nova'],
  ['falsa', 'assinatura de outra chave é recusada', false, 'assinatura inválida'],
  ['corrompida', 'arquivo cortado no meio é recusado', false, 'arquivo corrompido'],
  ['invalida', 'regras assinadas mas com salário mínimo zero são recusadas', false, 'regras inválidas'],
  ['portal', 'página de login do Wi-Fi no lugar das regras é recusada', false, 'assinatura inválida'],
  ['erro500', 'servidor com erro não quebra o app', false, 'falha de rede'],
  ['cai', 'conexão que cai no meio não quebra o app (usa a cópia guardada)', false, /^(falha de rede|versão não é mais nova)/]
];
for (const [modo, nome, aceita, motivo] of cenarios) {
  test('Atualização: ' + nome, async () => {
    srv.definirModo('normal');
    const { ctx, pg, erros } = await abrir();
    srv.definirModo(modo);
    const r = await tentarAtualizar(pg);
    assert.equal(r.versao, aceita ? '2099.1.1' : VERSAO_APP);
    assert.ok(motivo instanceof RegExp ? motivo.test(r.motivo) : r.motivo.startsWith(motivo), 'motivo: ' + r.motivo);
    await pg.click('#ver-exemplo');                                 // o app segue funcionando
    assert.ok(Number(await pg.textContent('#n-sim')) > 0);
    if (aceita) assert.ok((await pg.textContent('main')).includes('Cadastro Único ATUALIZADO'));
    assert.deepEqual(erros, []);
    srv.definirModo('normal');
    await ctx.close();
  });
}

test('Atualização com texto de ataque (assinada) não executa código', async () => {
  srv.definirModo('normal');
  const { ctx, pg } = await abrir();
  srv.definirModo('xss');
  await tentarAtualizar(pg);
  await pg.click('#ver-exemplo');
  await pg.click('[data-programa=cadunico] summary');
  await pg.click('#abrir-relatorio');
  assert.equal(await pg.evaluate(() => window.__xss), undefined);
  srv.definirModo('normal');
  await ctx.close();
});

test('Servidor lento (25 s): o app continua respondendo enquanto espera', async () => {
  srv.definirModo('normal');
  const { ctx, pg } = await abrir();
  srv.definirModo('lento');
  pg.evaluate(() => window.__md.verificarAtualizacao(false)).catch(() => {});
  const t0 = Date.now();
  await pg.click('#ver-exemplo');
  await pg.waitForSelector('#n-sim');
  assert.ok(Date.now() - t0 < 3000, 'demorou ' + (Date.now() - t0) + ' ms');
  srv.definirModo('normal');
  await ctx.close();
});

test('Rede instável (metade das conexões cai): 10 tentativas sem quebrar', async () => {
  srv.definirModo('normal');
  const { ctx, pg, erros } = await abrir();
  srv.definirModo('instavel');
  for (let i = 0; i < 10; i++) await tentarAtualizar(pg);
  assert.equal(await pg.evaluate(() => window.__md.versaoRegras()), VERSAO_APP);
  assert.deepEqual(erros, []);
  srv.definirModo('normal');
  await ctx.close();
});

test('Atualização aceita fica guardada e é conferida de novo ao abrir; adulterada no aparelho é descartada', async () => {
  srv.definirModo('normal');
  const { ctx, pg } = await abrir();
  srv.definirModo('nova');
  await tentarAtualizar(pg);
  srv.definirModo('normal');
  await pg.reload(); await pg.waitForSelector('#comecar'); await pg.waitForTimeout(300);
  assert.equal(await pg.evaluate(() => window.__md.versaoRegras()), '2099.1.1');
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('md_regras')); s.texto = s.texto.replace('"salarioMinimo":1621', '"salarioMinimo":9000'); localStorage.setItem('md_regras', JSON.stringify(s)); });
  await pg.reload(); await pg.waitForSelector('#comecar'); await pg.waitForTimeout(300);
  assert.equal(await pg.evaluate(() => window.__md.versaoRegras()), VERSAO_APP);
  assert.equal(await pg.evaluate(() => localStorage.getItem('md_regras')), null);
  await ctx.close();
});

test('Sem internet depois de instalado: abre, calcula e mostra relatório', async () => {
  srv.definirModo('normal');
  const { ctx, pg } = await abrir();
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.reload(); await pg.waitForSelector('#comecar');
  await ctx.setOffline(true);
  await pg.reload(); await pg.waitForSelector('#comecar');
  assert.match(await pg.textContent('#netstate'), /Sem internet/);
  await pg.click('#ver-exemplo');
  await pg.click('#abrir-relatorio');
  assert.ok((await pg.textContent('#relatorio')).includes('Relatório de direitos'));
  const fonte = await pg.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible"'));
  assert.ok(fonte, 'fonte guardada para uso offline');
  await ctx.setOffline(false);
  await ctx.close();
});

test('Armazenamento cheio (gravar sempre falha): app funciona e avisa', async () => {
  const { ctx, pg, erros } = await abrir(() => { Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError'); }; });
  await pg.click('#ver-exemplo');
  assert.ok(Number(await pg.textContent('#n-sim')) > 0);
  assert.match(await pg.textContent('#aviso-armazenamento'), /não está deixando guardar/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('Armazenamento bloqueado (navegador proíbe acesso): app funciona', async () => {
  const { ctx, pg, erros } = await abrir(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('negado', 'SecurityError'); } }); });
  await pg.click('#ver-exemplo');
  assert.ok(Number(await pg.textContent('#n-sim')) > 0);
  assert.deepEqual(erros, []);
  await ctx.close();
});

for (const [nome, valor] of [['texto que não é JSON', '{{{'], ['número', '42'], ['lista', '[1,2]'], ['família sem pessoas', '{"pessoas":null,"saude":7}'], ['pessoa estragada', '{"pessoas":[{"nome":5,"renda":{},"doencas":"x","nasc":"2099-99-99"}]}'], ['passo inválido', null]]) {
  test('Dados salvos estragados (' + nome + '): app abre e funciona', async () => {
    const { ctx, pg, erros } = await abrir();
    await pg.evaluate(v => { if (v !== null) localStorage.setItem('md_familia', v); localStorage.setItem('md_passo', '"xyz"'); }, valor);
    await pg.reload();
    await pg.waitForSelector('#comecar');
    await pg.click('#comecar');
    await pg.waitForSelector('#cidade');
    assert.deepEqual(erros, []);
    await ctx.close();
  });
}

test('Muitos cliques rápidos e pessoas adicionadas/removidas não quebram', async () => {
  const { ctx, pg, erros } = await abrir();
  await pg.click('#comecar'); await pg.click('#avancar');
  for (let i = 0; i < 25; i++) { const b = await pg.$('#add-pessoa'); if (b) await b.click(); }
  assert.equal(await pg.$$eval('.person', e => e.length), 20, 'limite de 20 pessoas');
  for (let i = 0; i < 19; i++) await pg.click('[data-remover]');
  assert.equal(await pg.$$eval('.person', e => e.length), 1);
  assert.deepEqual(erros, []);
  await ctx.close();
});
