// Monta o aplicativo:
//   dist/          → site para publicar (GitHub Pages). Funciona offline e instala no celular e no computador.
//   dist-previa/   → um único arquivo HTML para a prévia.
// Uso: node ferramentas/build.mjs   (assina as regras com a chave em $CHAVE_PRIVADA, se existir)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { assinar } from './assinar.mjs';
const require = createRequire(import.meta.url);
const raiz = new URL('..', import.meta.url).pathname;
const src = f => raiz + 'src/' + f;
const ler = f => readFileSync(src(f), 'utf8');
const Motor = require(src('motor.js'));

const regras = JSON.parse(ler('regras.json'));
const erros = Motor.validarRegras(regras);
if (erros.length) { console.error('Arquivo de regras com problemas:\n- ' + erros.join('\n- ')); process.exit(1); }
const textoRegras = JSON.stringify(regras);
const paraScript = t => t.replace(/</g, '\\u003c'); // impede fechar a tag <script> de dentro dos dados
const municipios = JSON.stringify(JSON.parse(ler('municipios-mg.json')));
const chave = JSON.stringify(JSON.parse(ler('chave-publica.json')));

let assinatura = '';
const { conferirAssinatura } = require(src('seguranca.js'));
const caminhoChave = process.env.CHAVE_PRIVADA || '/mnt/project-files/direitos-app-segredos/chave-privada-regras.jwk';
if (existsSync(caminhoChave)) assinatura = await assinar(textoRegras, JSON.parse(readFileSync(caminhoChave, 'utf8')));
else if (existsSync(src('regras.json.sig.pronta'))) assinatura = readFileSync(src('regras.json.sig.pronta'), 'utf8').trim();
else console.warn('AVISO: sem chave privada. As regras vão sem assinatura e os aparelhos vão recusar esta atualização.');
if (assinatura && !(await conferirAssinatura(textoRegras, assinatura, JSON.parse(chave)))) {
  console.error('ERRO: a assinatura não confere com as regras atuais. Depois de mudar src/regras.json, rode: npm run assinar');
  process.exit(1);
}

const corpo = ler('corpo.html');
const dados = '<script type="application/json" id="regras-embutidas">' + paraScript(textoRegras) + '</script>\n' +
  '<script type="application/json" id="municipios-mg">' + paraScript(municipios) + '</script>\n' +
  '<script type="application/json" id="chave-publica">' + paraScript(chave) + '</script>';

// ----- dist -----
const dist = raiz + 'dist/';
rmSync(dist, { recursive: true, force: true }); mkdirSync(dist, { recursive: true });
let index = ler('index.html').replace('<!--CORPO-->', corpo)
  .replace(/<script type="application\/json" id="regras-embutidas">[\s\S]*?id="chave-publica"><!--CHAVE--><\/script>/, dados);
writeFileSync(dist + 'index.html', index);
for (const f of ['estilo.css', 'fontes.css', 'motor.js', 'seguranca.js', 'app.js', 'manifest.webmanifest', 'icone.svg', 'icone-192.png', 'icone-512.png']) cpSync(src(f), dist + f);
cpSync(src('fontes'), dist + 'fontes', { recursive: true });
writeFileSync(dist + 'regras.json', textoRegras);
writeFileSync(dist + 'regras.json.sig', assinatura);
const hash = createHash('sha256');
for (const f of ['index.html', 'estilo.css', 'motor.js', 'seguranca.js', 'app.js', 'regras.json']) hash.update(readFileSync(dist + f));
writeFileSync(dist + 'sw.js', ler('sw.js').replace('__VERSAO__', hash.digest('hex').slice(0, 12)));
writeFileSync(dist + '.nojekyll', '');

// ----- prévia (arquivo único) -----
const previa = raiz + 'dist-previa/';
rmSync(previa, { recursive: true, force: true }); mkdirSync(previa, { recursive: true });
const js = f => '<script>\n' + ler(f).replace(/<\/script/gi, '<\\/script') + '\n</script>';
writeFileSync(previa + 'previa.html',
  '<title>Meus Direitos MG</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap">\n' +
  '<style>\n' + ler('estilo.css') + '\n</style>\n' + corpo + dados + '\n' + js('motor.js') + js('seguranca.js') + js('app.js') + '\n');
writeFileSync(previa + 'regras.json', textoRegras);
writeFileSync(previa + 'regras.json.sig', assinatura);
console.log('ok: regras ' + regras.versao + ', ' + regras.programas.length + ' programas' + (assinatura ? ', assinadas' : ', SEM assinatura'));
