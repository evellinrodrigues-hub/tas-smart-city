/**
 * scripts/sensibilidade.js - A suite detecta defeito?
 *
 * Uma suite verde so tem valor se ela souber ficar vermelha. Este script sobe
 * o duplo de referencia uma vez para cada defeito conhecido, executa a suite
 * inteira contra ele e registra QUAIS casos falharam.
 *
 * O resultado que interessa nao e "falhou": e "falhou exatamente onde deveria".
 * Um defeito que nenhum caso percebe e um ponto cego declarado, e o script
 * termina com codigo de saida diferente de zero quando encontra um.
 *
 * Uso: npm run sensibilidade
 */

'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const PORTA = Number(process.env.PORTA_SENSIBILIDADE || 5099);
const BASE_URL = `http://localhost:${PORTA}`;

/**
 * Cada defeito declara qual assercao ele deveria acordar. A coluna
 * `casoEsperado` e o oraculo desta verificacao: se o defeito derruba outro
 * caso que nao esse, a suite esta detectando pelo motivo errado.
 */
const DEFEITOS = [
  {
    id: 'transicao-extra',
    descricao: 'abre a transicao RESOLVED -> IN_PROGRESS, que o contrato recusa',
    casoEsperado: 'RESOLVED -> IN_PROGRESS',
  },
  {
    id: 'role-do-cliente',
    descricao: 'cadastro obedece ao campo role enviado pelo cliente',
    casoEsperado: 'C16',
  },
  {
    id: '403-em-vez-de-404',
    descricao: 'demanda de terceiro responde 403 e confirma que existe',
    casoEsperado: 'A5',
  },
  {
    id: 'vaza-senha',
    descricao: 'respostas de usuario passam a incluir a senha',
    casoEsperado: 'C09',
  },
  {
    id: 'sem-code',
    descricao: 'respostas de erro perdem o campo code',
    casoEsperado: 'C49',
  },
  {
    id: 'status-inicial',
    descricao: 'demanda nasce em IN_PROGRESS em vez do status inicial',
    casoEsperado: 'C19',
  },
];

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function subirServidor(defeito) {
  const servidor = spawn(process.execPath, ['sut-referencia/server.js'], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(PORTA), DEFEITO: defeito },
    stdio: 'ignore',
  });

  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`${BASE_URL}/api/demandas`, { signal: AbortSignal.timeout(500) });
      return servidor;
    } catch {
      await esperar(150);
    }
  }

  servidor.kill();
  throw new Error(`O duplo de referencia nao subiu na porta ${PORTA}`);
}

function executarSuite() {
  return new Promise(resolve => {
    const proc = spawn(
      process.execPath,
      ['--test', '--test-reporter=tap', 'tests/api/**/*.test.js'],
      { cwd: RAIZ, env: { ...process.env, BASE_URL }, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let saida = '';
    proc.stdout.on('data', d => (saida += d));
    proc.stderr.on('data', d => (saida += d));
    proc.on('close', () => {
      const reprovados = saida
        .split('\n')
        .filter(l => /^not ok \d+/.test(l.trim()))
        .map(l => l.replace(/^\s*not ok \d+ - /, '').trim());
      resolve(reprovados);
    });
  });
}

async function main() {
  console.log('');
  console.log('== Verificacao de sensibilidade ===========================');
  console.log(`Alvo: ${BASE_URL} (duplo de referencia com defeito injetado)`);
  console.log('');

  const linhas = [];
  let pontosCegos = 0;

  for (const defeito of DEFEITOS) {
    process.stdout.write(`-> ${defeito.id.padEnd(20)} `);
    const servidor = await subirServidor(defeito.id);

    let reprovados;
    try {
      reprovados = await executarSuite();
    } finally {
      servidor.kill();
      await esperar(200);
    }

    const acordouOCasoCerto = reprovados.some(nome => nome.includes(defeito.casoEsperado));
    if (reprovados.length === 0) pontosCegos++;

    const veredito =
      reprovados.length === 0
        ? 'PONTO CEGO: nenhum caso percebeu'
        : acordouOCasoCerto
          ? `detectado por ${reprovados.length} caso(s), incluindo o esperado`
          : `DETECTADO PELO MOTIVO ERRADO: ${reprovados.length} caso(s), nenhum contendo "${defeito.casoEsperado}"`;

    console.log(veredito);
    linhas.push({ defeito, reprovados, acordouOCasoCerto });
  }

  console.log('');
  console.log('== Detalhe ================================================');
  for (const { defeito, reprovados } of linhas) {
    console.log('');
    console.log(`[${defeito.id}] ${defeito.descricao}`);
    if (reprovados.length === 0) {
      console.log('   nenhum caso reprovou — este defeito passaria despercebido');
    } else {
      for (const nome of reprovados) console.log(`   reprovou: ${nome}`);
    }
  }

  console.log('');
  console.log('-----------------------------------------------------------');
  console.log(`Defeitos injetados: ${DEFEITOS.length} | pontos cegos: ${pontosCegos}`);
  console.log('');

  if (pontosCegos > 0) process.exitCode = 1;
}

main().catch(erro => {
  console.error(erro.message);
  process.exitCode = 1;
});
