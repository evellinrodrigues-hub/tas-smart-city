/**
 * Verificacao de configuracao da propria TAS. Nao toca no SUT.
 *
 * Esta suite nao verifica o produto: verifica o ORACULO. E o gate mais barato
 * da esteira e roda antes de o servidor subir, porque um oraculo incoerente
 * produz uma suite que aprova ou reprova o SUT pelo motivo errado — e essa e a
 * falha mais cara de descobrir, porque ela nao aparece como falha.
 *
 * A regra de negocio do SUT (a maquina de estados) NAO e verificada aqui: ela
 * vive no back-end Flask, em Python, fora do alcance de um runner Node. Ver a
 * nota em tests/api/hu13-atualizacao-status.test.js e o item 1 do backlog.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const contrato = require('../../data/contrato');
const matriz = require('../../data/matriz-autorizacao');
const demandas = require('../../data/demandas');
const api = require('../../api/smart-city');

test('TAS-01 a maquina de estados do contrato tem 25 pares e 5 transicoes validas', () => {
  const pares = contrato.paresDeTransicao();

  assert.equal(pares.length, 25, 'a tabela deveria cobrir 5 estados de origem x 5 de destino');
  assert.equal(
    pares.filter(p => p.permitida).length,
    5,
    'o contrato declara exatamente 5 transicoes permitidas',
  );
  assert.equal(pares.filter(p => !p.permitida).length, 20, 'logo, 20 pares devem ser recusados');
});

test('TAS-02 repetir o status atual e recusado em todos os estados', () => {
  for (const estado of contrato.ESTADOS) {
    assert.equal(
      contrato.transicaoPermitida(estado, estado),
      false,
      `o contrato recusa a repeticao do status atual, inclusive em ${estado}`,
    );
  }
});

test('TAS-03 os estados finais nao tem transicao de saida', () => {
  for (const final of contrato.ESTADOS_FINAIS) {
    const saidas = contrato.ESTADOS.filter(destino => contrato.transicaoPermitida(final, destino));
    assert.deepEqual(saidas, [], `${final} e estado final, mas o oraculo permite sair para ${saidas}`);
  }
});

test('TAS-04 todo estado do contrato e alcancavel a partir do estado inicial', () => {
  // Se um estado nao fosse alcancavel, os casos de transicao que partem dele
  // ficariam sem preparacao possivel e a suite reprovaria por impossibilidade
  // de montar o cenario, nao por defeito do produto.
  for (const estado of contrato.ESTADOS) {
    assert.doesNotThrow(
      () => api.caminhoAte(estado),
      `nao ha caminho de transicoes validas do estado inicial ate ${estado}`,
    );
  }
});

test('TAS-05 a massa de dados valida satisfaz todas as regras do contrato', () => {
  const d = demandas.valida();

  assert.ok(contrato.CATEGORIAS.includes(d.category), 'a categoria da massa valida saiu da lista fechada');
  assert.ok(
    d.description.length >= contrato.LIMITES.descricaoMin &&
      d.description.length <= contrato.LIMITES.descricaoMax,
    'a descricao da massa valida esta fora dos limites do contrato',
  );
  assert.ok(contrato.REGIOES.includes(d.location.region), 'a regiao da massa valida nao existe no contrato');
});

test('TAS-06 valida() devolve uma instancia nova a cada chamada', () => {
  // Objeto compartilhado entre testes pode ser mutado por um deles e
  // contaminar os demais, produzindo falhas que dependem da ordem de execucao.
  const primeira = demandas.valida();
  primeira.category = 'CONTAMINADA';

  assert.notEqual(demandas.valida().category, 'CONTAMINADA', 'a massa de dados esta sendo compartilhada');
});

test('TAS-07 cada caso invalido aponta um campo que existe na massa valida', () => {
  const validos = new Set(['category', 'description', 'location.latitude', 'location.longitude', 'location.region']);

  for (const caso of demandas.invalidas()) {
    assert.ok(
      validos.has(caso.campoEsperado),
      `o caso "${caso.nome}" espera erro no campo "${caso.campoEsperado}", que nao pertence ao contrato`,
    );
  }
});

test('TAS-08 a matriz de autorizacao cobre os tres perfis e nao tem celula vazia', () => {
  const celulas = matriz.celulas();
  assert.ok(celulas.length > 0, 'matriz de autorizacao vazia');

  for (const celula of celulas) {
    assert.equal(typeof celula.permitido, 'boolean', `celula ${celula.id} sem veredito`);
    assert.ok(celula.origem, `celula ${celula.id} sem a origem da regra: nao e rastreavel ao contrato`);
    assert.ok(
      Object.values(contrato.PERFIS).includes(celula.perfil),
      `celula ${celula.id} usa um perfil que nao existe no contrato`,
    );
  }
});
