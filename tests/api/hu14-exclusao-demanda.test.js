/**
 * HU-14 Exclusao de demanda.
 *
 * Risco: Alto / Probabilidade: Media.
 * Exclusao e a operacao irreversivel do produto. As duas regras do README
 * ("cidadao exclui apenas as proprias, enquanto pendentes" e "gestor nao pode
 * excluir demandas ja concluidas") sao restricoes de estado, e restricao de
 * estado e o tipo de regra que passa a valer para todos quando alguem
 * simplifica o handler.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const { USUARIOS, ROTAS } = require('../../lib/config');
const http = require('../../lib/http');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');
const demandas = require('../../data/demandas');

test('HU-14 C41 cidadao exclui a propria demanda enquanto ela esta pendente', async () => {
  const { id, tokenCidadao } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());

  const resposta = await api.excluirDemanda(tokenCidadao, id);
  assert.ok(
    [200, 204].includes(resposta.status),
    `esperado 200 ou 204 ao excluir demanda propria e pendente; recebido ${insp.resumo(resposta)}`,
  );

  // Um 204 que nao exclui e pior que um erro: o cidadao acredita que apagou.
  const depois = await api.obterDemanda(tokenCidadao, id);
  assert.equal(
    depois.status,
    404,
    `a API confirmou a exclusao (${resposta.status}) mas a demanda continua acessivel ` +
    `(${depois.status})`,
  );
});

test('HU-14 C42 cidadao nao exclui a propria demanda depois de ela sair de pendente', async () => {
  // A regra do README e "enquanto pendentes". Uma vez em analise, o gestor ja
  // esta trabalhando nela e o cidadao nao pode mais apagar o rastro.
  const { id, tokenCidadao } = await api.demandaNoEstado(contrato.STATUS.EM_ANALISE, demandas.valida());

  const resposta = await api.excluirDemanda(tokenCidadao, id);
  assert.equal(
    resposta.status,
    403,
    `o cidadao nao deveria excluir demanda fora do estado pendente; a API respondeu ` +
    `${insp.resumo(resposta)}`,
  );

  const depois = await api.obterDemanda(tokenCidadao, id);
  assert.equal(depois.status, 200, 'a demanda foi excluida apesar da recusa');
});

test('HU-14 C43 cidadao nao exclui demanda de outro cidadao', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());
  const tokenOutro = await api.tokenDe(USUARIOS.cidadaoSecundario);

  const resposta = await api.excluirDemanda(tokenOutro, id);

  // 404 mantem o recurso invisivel, coerente com a leitura (HU-03 A5); 403
  // tambem recusa, mas confirma a existencia. Ambos impedem a exclusao, e e
  // isso que esta assercao garante.
  assert.ok(
    [403, 404].includes(resposta.status),
    `um cidadao excluiu (ou tentou com resposta inesperada) a demanda de outro: ` +
    `${insp.resumo(resposta)}`,
  );

  const tokenGestor = await api.tokenDe(USUARIOS.gestor);
  const depois = await api.obterDemanda(tokenGestor, id);
  assert.equal(depois.status, 200, 'PERDA DE DADOS: a demanda alheia foi de fato excluida');
});

test('HU-14 C44 gestor nao exclui demanda ja concluida', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS.RESOLVIDA, demandas.valida());
  const tokenGestor = await api.tokenDe(USUARIOS.gestor);

  const resposta = await api.excluirDemanda(tokenGestor, id);
  assert.equal(
    resposta.status,
    403,
    `README secao 8: o gestor "nao pode excluir demandas ja concluidas". A API respondeu ` +
    `${insp.resumo(resposta)}`,
  );

  const depois = await api.obterDemanda(tokenGestor, id);
  assert.equal(depois.status, 200, 'a demanda concluida foi excluida apesar da recusa');
});

test('HU-14 C45 exclusao sem autenticacao responde 401', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());

  const { status, body } = await http.del(ROTAS.demanda(id));

  assert.equal(status, 401, `esperado 401 sem token; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.NAO_AUTENTICADO);
});

test('HU-14 C46 exclusao de demanda inexistente responde 404', async () => {
  const tokenGestor = await api.tokenDe(USUARIOS.gestor);
  const { status } = await api.excluirDemanda(tokenGestor, '00000000-0000-0000-0000-000000000000');

  assert.equal(status, 404, `esperado 404 ao excluir id inexistente; recebido ${status}`);
});
