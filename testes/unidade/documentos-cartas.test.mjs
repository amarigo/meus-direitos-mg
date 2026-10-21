// Documentos por local e quem tem direito a quê (pedido: lista de documentos, carta por local, por quê).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, REGRAS, familia, calc } from '../ajuda.mjs';

const FAM = () => familia([
  { nome: 'Maria', idade: 38, renda: 800, sexo: 'F' },
  { nome: 'Pedro', idade: 16, estudo: 'medio', rede: 'publica' },
  { nome: 'Ana', idade: 4 },
  { nome: 'José', idade: 71, fonte: 'sem' }
], { cidade: 'Itajubá', moradia: 'alugada', agua: 'copasa', luz: 'familia', cad: 'nao', bf: 'nao' });

test('cada programa das regras explica o porquê e usa só documentos que existem', () => {
  for (const pr of REGRAS.programas) {
    assert.ok(pr.porque && pr.porque.length >= 12, pr.id + ' sem porquê');
    for (const d of pr.documentos || []) assert.ok(REGRAS.documentos[d], pr.id + ': documento ' + d);
  }
});

test('plano por local: cada lugar uma vez, com programas, e o CRAS primeiro quando precisa de CadÚnico', () => {
  const pl = Motor.planoPorLocal(calc(FAM()), REGRAS);
  const canais = pl.map(g => g.canal);
  assert.equal(new Set(canais).size, canais.length, 'local repetido');
  assert.equal(canais[0], 'cras');
  for (const g of pl) assert.ok(g.programas.length > 0, g.canal + ' sem programa');
});

test('checklist: documento pessoal aparece com o nome de quem precisa levar, sem repetir documento', () => {
  const pl = Motor.planoPorLocal(calc(FAM()), REGRAS);
  const cras = pl.find(g => g.canal === 'cras');
  const textos = cras.itens.map(i => i.texto);
  assert.equal(new Set(textos).size, textos.length, 'documento repetido no mesmo local');
  const cpf = cras.itens.find(i => /CPF/.test(i.texto) && i.pessoas && i.pessoas.length === 4);
  assert.ok(cpf, 'CadÚnico pede CPF de todos da casa');
  assert.deepEqual(cpf.pessoas.map(p => p.nome), ['Maria', 'Pedro', 'Ana', 'José']);
  for (const it of cras.itens) {
    assert.ok(it.para.length > 0, it.texto + ' sem "para"');
    if (it.pessoas) assert.ok(it.pessoas.length > 0);
  }
  // Escola: declaração escolar só para quem estuda
  const escolar = pl.flatMap(g => g.itens).find(i => /escolar|matrícula/i.test(i.texto) && i.pessoas);
  if (escolar) assert.ok(escolar.pessoas.every(p => p.nome === 'Pedro'), 'declaração escolar para quem não estuda');
});

test('quem tem direito: cada pessoa com seus programas e o motivo com o nome dela', () => {
  const q = Motor.direitosPorPessoa(calc(FAM()));
  const jose = q.pessoas.find(p => p.nome === 'José');
  const bpc = jose.itens.find(i => /BPC/.test(i.titulo));
  assert.ok(bpc, 'José (71) deve ter BPC');
  assert.match(bpc.motivo, /José/);
  assert.match(bpc.motivo, /71/);
  const pedro = q.pessoas.find(p => p.nome === 'Pedro');
  assert.ok(pedro.itens.some(i => /Pé-de-Meia/.test(i.titulo)));
  const ana = q.pessoas.find(p => p.nome === 'Ana');
  assert.ok(!ana.itens.some(i => /BPC|Pé-de-Meia/.test(i.titulo)), 'Ana não tem BPC nem Pé-de-Meia');
  assert.ok(q.familia.some(i => /Bolsa Família/.test(i.titulo)), 'Bolsa Família é da família');
  for (const i of [...q.familia, ...q.pessoas.flatMap(p => p.itens)]) {
    assert.ok(i.motivo && !/\{[a-zA-Z$]+\}/.test(i.motivo), 'motivo vazio ou com campo não preenchido: ' + i.titulo + ' → ' + i.motivo);
  }
});

test('motivo usa os números da família (renda por pessoa formatada em reais)', () => {
  const r = calc(FAM()).res.find(x => x.pr.id === 'bolsa_familia');
  assert.match(r.motivos[0].texto.replace(/\s/g, ' '), /R\$ 200,00/);
});

test('família sem nenhum direito: plano e lista vazios, sem erro', () => {
  const f = familia([{ nome: 'Rico', idade: 40, renda: 50000, fonte: 'clt' }], { moradia: 'propria', agua: 'outra', luz: 'familia', cad: 'nao', bf: 'nao' });
  const c = calc(f);
  const pl = Motor.planoPorLocal(c, REGRAS);
  for (const g of pl) assert.ok(g.programas.length > 0);
  const q = Motor.direitosPorPessoa(c);
  assert.equal(q.pessoas.length, 1);
});

test('dados salvos de documentos e e-mails são limpos ao abrir (nada estranho entra)', () => {
  const f = Motor.normalizarFamilia({ pessoas: [], docsOk: { 'cras|cpf|0': true, 'x': 'sim', 'y': false }, emails: { cras: 'a@b.com', ubs: { mal: 1 } } });
  assert.deepEqual(f.docsOk, { 'cras|cpf|0': true });
  assert.deepEqual(Object.keys(f.emails), ['cras']);
});

test('a sigla BPC nunca aparece sozinha: sempre com o nome completo no mesmo texto', () => {
  const textos = [];
  const andar = (x, k) => { if (Array.isArray(x)) x.forEach(v => andar(v, k)); else if (x && typeof x === 'object') Object.entries(x).forEach(([kk, v]) => andar(v, kk)); else if (typeof x === 'string' && !['f', 'v', 'id', 'op'].includes(k)) textos.push(x); };
  andar(REGRAS);
  for (const t of textos) if (/\bBPC\b/.test(t)) assert.match(t, /Benefício de Prestação Continuada/, 'sigla sem explicação: ' + t);
});

// ---------- Benefícios das Prefeituras ----------
const pobre = cidade => familia([{ nome: 'Rosa', idade: 30, renda: 0, sexo: 'F', gestante: true }], { cidade, sit: { emergencia: true } });
test('programa de uma Prefeitura só aparece para quem mora naquela cidade', () => {
  const ids = c => calc(pobre(c)).res.map(r => r.pr.id);
  assert.ok(ids('Pouso Alegre').includes('pa_natalidade'));
  assert.ok(ids('pouso alegre').includes('pa_eventuais'), 'cidade escrita sem maiúscula também vale');
  assert.ok(!ids('Itajubá').includes('pa_natalidade'));
  assert.ok(!ids('').includes('pa_natalidade'));
  assert.ok(ids('Santa Rita do Sapucai').includes('srs_eventuais'), 'cidade sem acento também vale');
  assert.ok(ids('Belo Horizonte').includes('bh_restaurante'));
  assert.ok(!ids('Pouso Alegre').includes('bh_restaurante'));
});
test('benefício eventual genérico some onde a Prefeitura tem o seu próprio, e fica nas outras cidades', () => {
  const ids = c => calc(pobre(c)).res.map(r => r.pr.id);
  assert.ok(!ids('Pouso Alegre').includes('beneficio_eventual'));
  assert.ok(!ids('Santa Rita do Sapucaí').includes('beneficio_eventual'));
  assert.ok(ids('Itajubá').includes('beneficio_eventual'));
  assert.ok(ids('Paraisópolis').includes('beneficio_eventual'));
});
test('limites de renda das Prefeituras: Santa Rita usa "menos de 1/4", Pouso Alegre "até 1/4"', () => {
  const q = REGRAS.parametros.salarioMinimo / 4;
  const st = (cidade, id) => (calc(familia([{ idade: 40, renda: q }], { cidade })).res.find(r => r.pr.id === id) || {}).status;
  assert.equal(st('Pouso Alegre', 'pa_eventuais'), 'sim');
  assert.equal(st('Santa Rita do Sapucaí', 'srs_eventuais'), 'talvez');
});
test('transporte escolar só para estudante de escola pública na roça; ônibus grátis a partir de 65', () => {
  const rural = familia([{ nome: 'Mãe', idade: 40, renda: 500 }, { nome: 'Lia', idade: 9, estudo: 'fundamental', rede: 'publica' }], { zona: 'rural' });
  assert.deepEqual(calc(rural).res.find(r => r.pr.id === 'transporte_escolar').quem, ['Lia']);
  rural.zona = 'urbana';
  assert.ok(!calc(rural).res.some(r => r.pr.id === 'transporte_escolar'));
  const idosos = calc(familia([{ nome: 'Zé', idade: 66, renda: 3000 }, { nome: 'Lu', idade: 62 }])).res.find(r => r.pr.id === 'onibus_idoso');
  assert.equal(idosos.status, 'sim'); assert.deepEqual(idosos.quem, ['Zé']);
});
test('regras recusam programa de cidade com código que não existe', () => {
  const r = JSON.parse(JSON.stringify(REGRAS));
  r.programas.find(p => p.id === 'pa_natalidade').municipios = ['3199999'];
  assert.ok(Motor.validarRegras(r).some(e => /cidade desconhecida/.test(e)));
  delete r.municipios['3152501'].nome;
  assert.ok(Motor.validarRegras(r).some(e => /falta nome/.test(e)));
});
