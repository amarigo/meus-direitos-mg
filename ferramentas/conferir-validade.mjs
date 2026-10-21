// Lista programas e cidades cuja informação não é conferida há mais de N dias (padrão 90).
// Usado toda semana pelo GitHub Actions para lembrar de revisar leis e valores.
import { readFileSync, writeFileSync } from 'node:fs';
const dias = Number(process.argv[2] || 90);
const r = JSON.parse(readFileSync(new URL('../src/regras.json', import.meta.url), 'utf8'));
const limite = Date.now() - dias * 864e5;
const velhos = r.programas.filter(p => !p.verificadoEm || Date.parse(p.verificadoEm) < limite).map(p => '- ' + p.titulo + ' (conferido em ' + (p.verificadoEm || 'nunca') + ')')
  .concat(Object.entries(r.municipios || {}).filter(([, m]) => m.verificadoEm && Date.parse(m.verificadoEm) < limite).map(([c, m]) => '- Cidade ' + c + ' (conferido em ' + m.verificadoEm + ')'));
const texto = velhos.length ? 'Itens sem conferência há mais de ' + dias + ' dias:\n\n' + velhos.join('\n') + '\n\nConfira nas fontes oficiais, atualize src/regras.json (verificadoEm e versao), rode npm run assinar e publique.' : '';
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, 'vencidos=' + velhos.length + '\n', { flag: 'a' });
writeFileSync('validade.md', texto);
console.log(texto || 'Tudo conferido nos últimos ' + dias + ' dias.');
