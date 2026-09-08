/**
 * lib/diagnostico.js - Contra quem a suite vai falar?
 *
 * O valor padrao de BASE_URL e divida tecnica consciente: um dia alguem vai
 * rodar contra o alvo errado sem perceber e passar meia hora interpretando
 * falhas de um servidor que nao e o produto. Este script existe para tornar o
 * alvo explicito ANTES da execucao, e para distinguir "SUT fora do ar" de
 * "defeito no produto" logo na primeira mensagem.
 *
 * Uso: npm run diagnostico
 */

'use strict';

const { BASE_URL, ROTAS, USUARIOS } = require('./config');
const http = require('./http');
const insp = require('./inspecao');

const marca = ok => (ok ? '  OK  ' : ' FALHA');

async function main() {
  console.log('');
  console.log('== Diagnostico da TAS =====================================');
  console.log(`Alvo (BASE_URL):   ${BASE_URL}`);
  console.log(`Rota de login:     ${ROTAS.login}`);
  console.log(`Rota de demandas:  ${ROTAS.demandas}`);
  console.log(`Node:              ${process.version}`);
  console.log('-----------------------------------------------------------');

  let alvoRespondeu = false;
  try {
    const r = await http.get(ROTAS.demandas);
    alvoRespondeu = true;
    console.log(`${marca(true)} o alvo respondeu (${r.status} em ${ROTAS.demandas})`);
    console.log(`       tipo de midia: ${insp.tipoDeMidia(r.headers) || '(nao declarado)'}`);
  } catch (erro) {
    console.log(`${marca(false)} ${erro.message}`);
    console.log('');
    console.log('       Para subir o duplo de referencia do contrato:');
    console.log('         npm run sut:referencia');
    console.log('       Para apontar ao back-end Flask do Projeto Integrador:');
    console.log('         BASE_URL=http://localhost:5000 npm test');
    console.log('');
    process.exitCode = 1;
    return;
  }

  for (const [papel, usuario] of Object.entries(USUARIOS)) {
    try {
      const r = await http.post(ROTAS.login, { email: usuario.email, password: usuario.senha });
      const ok = r.status === 200;
      console.log(`${marca(ok)} usuario de teste "${papel}" (${usuario.email}) -> ${r.status}`);
      if (!ok) {
        console.log(`       o usuario existe no alvo? corpo: ${r.raw.slice(0, 160)}`);
      }
    } catch (erro) {
      console.log(`${marca(false)} usuario "${papel}": ${erro.message}`);
    }
  }

  console.log('-----------------------------------------------------------');
  console.log(
    alvoRespondeu
      ? 'Pronto para executar: npm test'
      : 'Corrija o acesso ao alvo antes de interpretar qualquer falha.',
  );
  console.log('');
}

main();
