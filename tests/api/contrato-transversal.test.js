/**
 * Contrato transversal: o que vale para TODA a API.
 *
 * Estes casos nao pertencem a uma historia de usuario. Verificam as promessas
 * que o contrato faz em todas as rotas: tipo de midia, formato de erro
 * padronizado, semantica dos metodos HTTP e ausencia de erro interno vazando
 * para o cliente.
 *
 * Sao baratos, estaveis e pegam a classe de defeito mais chata de descobrir em
 * producao: a que aparece no cliente como "erro inesperado".
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const http = require('../../lib/http');
const { USUARIOS, ROTAS } = require('../../lib/config');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');
const demandas = require('../../data/demandas');

test('CT C47 respostas de sucesso declaram content-type application/json', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const resposta = await api.listarDemandas(token);

  assert.equal(
    insp.tipoDeMidia(resposta.headers),
    'application/json',
    `a API declarou "${insp.tipoDeMidia(resposta.headers)}": um cliente que espera JSON ` +
    'quebra ao receber outro tipo',
  );
});

test('CT C48 respostas de erro tambem sao JSON, e nao HTML', async () => {
  // Muitos frameworks devolvem pagina de erro HTML em 401/404/500. O app
  // mobile tenta fazer JSON.parse e estoura com uma mensagem que nao ajuda
  // ninguem a diagnosticar nada.
  const semToken = await http.get(ROTAS.eu);

  assert.equal(semToken.status, 401);
  assert.ok(
    semToken.ehJson,
    `a resposta 401 nao e JSON valido: ${semToken.raw.slice(0, 200)}`,
  );
  assert.equal(insp.tipoDeMidia(semToken.headers), 'application/json');
});

test('CT C49 todo erro traz um code legivel por maquina', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);

  const respostas = [
    ['401 sem token', await http.get(ROTAS.eu)],
    ['400 validacao', await api.criarDemanda(token, {})],
    ['404 inexistente', await api.obterDemanda(token, '00000000-0000-0000-0000-000000000000')],
  ];

  for (const [rotulo, resposta] of respostas) {
    const code = insp.codigoDeErro(resposta.body);
    assert.ok(
      code,
      `${rotulo}: resposta de erro sem "code". Sem ele, o cliente e o teste so podem ` +
      `depender da mensagem em portugues, que muda a cada ajuste de redacao. ` +
      `Corpo: ${resposta.raw.slice(0, 200)}`,
    );
    assert.equal(typeof code, 'string');
  }
});

test('CT C50 rota inexistente responde 404 com corpo JSON padronizado', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const resposta = await http.get('/api/rota-que-nao-existe', { token });

  assert.equal(resposta.status, 404, `esperado 404 em rota inexistente; recebido ${resposta.status}`);
  assert.ok(resposta.ehJson, `rota inexistente devolveu corpo nao-JSON: ${resposta.raw.slice(0, 200)}`);
});

test('CT C51 metodo nao suportado responde 405, e nao 404 nem 500', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  // /auth/login existe e aceita POST. Um GET ali e metodo errado em rota
  // certa: a semantica REST distingue os dois casos.
  const resposta = await http.get(ROTAS.login, { token });

  assert.equal(
    resposta.status,
    405,
    `GET em rota que so aceita POST deveria responder 405; respondeu ${insp.resumo(resposta)}`,
  );
  assert.ok(
    resposta.headers.get('allow'),
    'a resposta 405 nao trouxe o header Allow, que e quem informa os metodos aceitos',
  );
});

test('CT C52 corpo JSON malformado responde 400, e nao 500', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);

  // Erro do cliente nunca deve virar erro interno do servidor: 500 aqui
  // significa excecao nao tratada, e excecao nao tratada e superficie de
  // ataque, alem de defeito.
  const resposta = await http.requisitar('POST', ROTAS.demandas, {
    token,
    corpoBruto: '{"category": "ROAD_MAINTENANCE",,,}',
  });

  assert.ok(
    resposta.status >= 400 && resposta.status < 500,
    `corpo malformado deveria produzir erro 4xx; a API respondeu ${insp.resumo(resposta)}`,
  );
  assert.notEqual(resposta.status, 500, 'corpo malformado produziu erro interno do servidor');
});

test('CT C53 nenhuma resposta da API vaza credencial em nenhuma rota verificada', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());

  const rotas = [
    ['GET /auth/me', await api.meuPerfil(token)],
    ['GET /api/demandas', await api.listarDemandas(token)],
    ['GET /api/demandas/{id}', await api.obterDemanda(token, id)],
  ];

  for (const [rotulo, resposta] of rotas) {
    const vazamentos = insp.camposProibidos(resposta.body, contrato.CAMPOS_PROIBIDOS_EM_RESPOSTA);
    assert.deepEqual(vazamentos, [], `${rotulo} expos credencial em: ${vazamentos.join(', ')}`);
  }
});

test('CT C54 a API nao responde 5xx em nenhum dos caminhos verificados', async () => {
  // Rede de seguranca: qualquer 5xx nos caminhos que a suite ja exercita e
  // achado, independentemente da regra que estivesse sendo verificada.
  const token = await api.tokenDe(USUARIOS.cidadao);

  const respostas = [
    ['login valido', await api.login(USUARIOS.cidadao.email, USUARIOS.cidadao.senha)],
    ['login invalido', await api.login(USUARIOS.cidadao.email, 'errada')],
    ['listagem', await api.listarDemandas(token)],
    ['criacao invalida', await api.criarDemanda(token, {})],
    ['detalhe inexistente', await api.obterDemanda(token, 'id-invalido')],
    ['perfil sem token', await http.get(ROTAS.eu)],
  ];

  const quinhentos = respostas.filter(([, r]) => r.status >= 500);
  assert.deepEqual(
    quinhentos.map(([rotulo, r]) => `${rotulo} -> ${r.status}`),
    [],
    'a API respondeu 5xx em caminhos previsiveis',
  );
});
