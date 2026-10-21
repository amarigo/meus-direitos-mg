// Famílias-modelo com resposta conferida à mão pela lei (oráculo), e propriedades com famílias aleatórias.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Motor, REGRAS, SM, familia, calc, ids } from '../ajuda.mjs';

const modelos = [
  { nome: 'Mãe solo, 2 filhos pequenos, sem renda, aluguel, Copasa',
    f: familia([{ idade: 24, renda: 0, sexo: 'F' }, { idade: 3 }, { idade: 1 }], { moradia: 'alugada', agua: 'copasa', luz: 'familia' }),
    tem: ['cadunico', 'bolsa_familia', 'tarifa_social_luz', 'gas_do_povo', 'copasa_social', 'creche', 'mcmv', 'beneficio_eventual', 'absorvente'],
    naoTem: ['bpc_idoso', 'bpc_pcd', 'pe_de_meia', 'desconto_social_luz'], bf: 600 + 150 * 2 },
  { nome: 'Casal de idosos, um aposentado com 1 salário mínimo',
    f: familia([{ idade: 68, renda: SM, fonte: 'aposentadoria' }, { idade: 66, renda: 0 }], { moradia: 'propria' }),
    tem: ['bpc_idoso', 'cadunico', 'pessoa_idosa_viagem'], naoTem: ['bolsa_familia', 'mcmv', 'creche'], bpcPara: ['P2'] },
  { nome: 'Família de classe média baixa (renda de 2 salários por pessoa)',
    f: familia([{ idade: 40, renda: SM * 4, fonte: 'formal' }, { idade: 38 }], { moradia: 'propria' }),
    tem: [], naoTem: ['bolsa_familia', 'tarifa_social_luz', 'desconto_social_luz', 'gas_do_povo', 'bpc_idoso', 'mcmv', 'cadunico'] },
  { nome: 'Pessoa com deficiência adulta, família com renda baixa',
    f: familia([{ idade: 35, renda: 0, pcd: true }, { idade: 60, renda: 380 }]),
    tem: ['bpc_pcd', 'passe_livre_pcd', 'tarifa_social_luz'], naoTem: ['bpc_idoso'] },
  { nome: 'Estudante de ensino médio público em família de renda média-baixa',
    f: familia([{ idade: 45, renda: 1500 }, { idade: 17, estudo: 'medio', rede: 'publica' }]),
    tem: ['pe_de_meia', 'id_jovem', 'trilhas_futuro', 'tarifa_social_luz'], naoTem: ['bolsa_familia'] },
  { nome: 'Gestante empregada com carteira',
    f: familia([{ idade: 28, renda: 2500, fonte: 'formal', sexo: 'F', gestante: true }]),
    tem: ['prenatal', 'salario_maternidade', 'sus_basico'], naoTem: ['bolsa_familia', 'bpc_pcd'] },
  { nome: 'Trabalhador demitido recentemente',
    f: familia([{ idade: 33, renda: 0, demitido: true }, { idade: 30 }]),
    tem: ['seguro_desemprego', 'bolsa_familia'], naoTem: [] },
  { nome: 'Situação de rua',
    f: familia([{ idade: 45, renda: 0 }], { moradia: 'rua' }),
    tem: ['situacao_rua', 'cadunico', 'bolsa_familia'], naoTem: ['creche'] },
  { nome: 'Violência doméstica tem prioridade máxima no plano',
    f: familia([{ idade: 30, renda: 3000, sexo: 'F' }, { idade: 8 }], { sit: { violencia: true } }),
    tem: ['violencia'], naoTem: [], primeiro: 'violencia' },
  { nome: 'Agricultor familiar e pescador',
    f: familia([{ idade: 50, renda: 900 }], { sit: { agricultor: true, pescador: true } }),
    tem: ['garantia_safra', 'seguro_defeso'], naoTem: [] }
];
for (const m of modelos) {
  test('Família-modelo: ' + m.nome, () => {
    const { res } = calc(m.f);
    const lista = res.map(r => r.pr.id);
    for (const id of m.tem) assert.ok(lista.includes(id), 'deveria ter ' + id + ' (tem: ' + lista.join(', ') + ')');
    for (const id of m.naoTem) assert.ok(!lista.includes(id), 'não deveria ter ' + id);
    if (m.bf) assert.equal(res.find(r => r.pr.id === 'bolsa_familia').mensal, m.bf);
    if (m.bpcPara) assert.deepEqual(res.find(r => r.pr.id === 'bpc_idoso').quem, m.bpcPara);
    if (m.primeiro) assert.equal(res.filter(r => r.status === 'sim').sort((a, b) => a.pr.prioridade - b.pr.prioridade)[0].pr.id, m.primeiro);
  });
}

test('Todo programa do arquivo aparece para alguma família (nenhuma regra morta)', () => {
  const vistos = new Set();
  for (const m of modelos) calc(m.f).res.forEach(r => vistos.add(r.pr.id));
  const extras = [
    familia([{ idade: 30, renda: 1200, pcd: true, fonte: 'bpc' }].map(p => ({ ...p, fonte: 'formal' })).concat([{ idade: 20, pcd: true, renda: SM, fonte: 'bpc' }])),
    familia([{ idade: 75, renda: 0, incontinencia: true, doencas: ['diabetes'], semDocumento: true }], { saude: { especialista: true, dentista: true, mental: true }, sit: { justica: true, emergencia: true } }),
    familia([{ idade: 30, renda: SM * 1.5 }, { idade: 30 }]),
    familia([{ idade: 40, renda: 0 }, { idade: 19, estudo: 'eja', rede: 'publica' }])
  ];
  const pcdTrabalha = familia([{ idade: 30, renda: 1800, fonte: 'formal', pcd: true }]);
  pcdTrabalha.pessoas[0].fonte = 'formal';
  for (const f of extras.concat([pcdTrabalha])) calc(f).res.forEach(r => vistos.add(r.pr.id));
  // Auxílio-Inclusão: PcD que recebe BPC e tem carteira assinada é um caso que o formulário não separa; vale como 'não alcançável'.
  const faltam = REGRAS.programas.map(p => p.id).filter(id => !vistos.has(id) && id !== 'auxilio_inclusao');
  assert.deepEqual(faltam, []);
});

// ---------- Propriedades com famílias aleatórias (semente fixa para repetir) ----------
function aleatorio(semente) { let s = semente >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function familiaAleatoria(r) {
  const n = 1 + Math.floor(r() * 7);
  const fontes = ['sem', 'formal', 'informal', 'aposentadoria', 'bpc', 'outro'];
  const estudos = ['nao', 'creche', 'fundamental', 'medio', 'eja', 'superior'];
  const pessoas = [];
  for (let i = 0; i < n; i++) {
    const fonte = fontes[Math.floor(r() * fontes.length)];
    pessoas.push({ idade: Math.floor(r() * 95), fonte, renda: fonte === 'sem' ? undefined : Math.round(r() * 5000), sexo: r() < .5 ? 'F' : 'M', pcd: r() < .1, gestante: r() < .05, estudo: estudos[Math.floor(r() * estudos.length)], rede: r() < .8 ? 'publica' : 'particular', doencas: r() < .2 ? ['pressao'] : [] });
  }
  const f = familia(pessoas, { moradia: ['propria', 'alugada', 'cedida', 'rua'][Math.floor(r() * 4)], agua: ['copasa', 'outra', 'naosei'][Math.floor(r() * 3)], bf: r() < .3 ? 'sim' : 'nao', cad: ['sim', 'velho', 'nao', 'naosei'][Math.floor(r() * 4)] });
  f.pessoas.forEach((p, i) => { if (pessoas[i].fonte === 'sem') { p.fonte = 'sem'; p.renda = ''; } else p.fonte = pessoas[i].fonte; });
  return f;
}
const PELA_RENDA = ['bolsa_familia', 'bpc_idoso', 'bpc_pcd', 'tarifa_social_luz', 'gas_do_povo', 'pe_de_meia', 'copasa_social', 'mcmv'];

test('Propriedade: ganhar mais nunca cria direito que depende de renda baixa (2.000 famílias)', () => {
  const r = aleatorio(42);
  for (let k = 0; k < 2000; k++) {
    const f = familiaAleatoria(r);
    const antes = new Set(ids(f));
    const g = structuredClone(f);
    const quem = g.pessoas.find(p => p.fonte !== 'sem' && p.fonte !== 'bpc' && p.fonte !== 'aposentadoria');
    if (!quem) continue;
    quem.renda = String(Number(quem.renda) + 300 + Math.round(r() * 3000));
    for (const id of ids(g)) if (PELA_RENDA.includes(id)) assert.ok(antes.has(id), 'caso ' + k + ': ' + id + ' apareceu ao aumentar a renda');
  }
});
test('Propriedade: a ordem das pessoas não muda o resultado (1.000 famílias)', () => {
  const r = aleatorio(7);
  for (let k = 0; k < 1000; k++) {
    const f = familiaAleatoria(r);
    const g = structuredClone(f); g.pessoas.reverse();
    const a = calc(f).res.map(x => x.pr.id + x.status + x.mensal).sort(), b = calc(g).res.map(x => x.pr.id + x.status + x.mensal).sort();
    assert.deepEqual(a, b, 'caso ' + k);
  }
});
test('Propriedade: nunca quebra e nunca dá valor negativo ou NaN (3.000 famílias, inclusive lixo)', () => {
  const r = aleatorio(99);
  const lixo = ['', '-', 'abc', '-1000', '99999999999', '1.2.3', '<b>', '1,2,3', '  '];
  for (let k = 0; k < 3000; k++) {
    const f = familiaAleatoria(r);
    if (k % 3 === 0) f.pessoas.forEach(p => { p.renda = lixo[Math.floor(r() * lixo.length)]; p.nasc = ['', '2099-01-01', '1990-02-31', 'x'][Math.floor(r() * 4)] || p.nasc; });
    const { fx, res } = Motor.calcular(Motor.normalizarFamilia(f), REGRAS, '2026-10-21');
    assert.ok(Number.isFinite(fx.rpc) && fx.rpc >= 0);
    for (const x of res) { assert.ok(Number.isFinite(x.mensal) && x.mensal >= 0); assert.ok(['sim', 'talvez'].includes(x.status)); }
  }
});
