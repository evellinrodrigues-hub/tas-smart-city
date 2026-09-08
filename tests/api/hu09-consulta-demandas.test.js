/**
 * HU-09 / HU-12 Consulta, isolamento e paginacao.
 *
 * Risco: Alto (isolamento) e Medio (consulta).
 * O caso de maior consequencia aqui nao e a listagem funcionar: e o cidadao
 * enxergar somente o proprio historico. Um filtro de visibilidade que
 * afrouxa nao quebra nada visivel na tela de quem testa.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const { USUARIOS } = require('../../lib/config');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');
const demandas = require('../../data/demandas');

test('HU-09 C27 cidadao lista apenas as proprias demandas', async () => {
  // Cada teste prepara o que precisa: os dois cidadaos registram uma demanda
  // agora, e nada depende de execucao anterior.
  const tokenA = await api.tokenDe(USUARIOS.cidadao);
  const tokenB = await api.tokenDe(USUARIOS.cidadaoSecundario);

  await api.criarDemanda(tokenA, demandas.valida());
  const demandaDeB = insp.carga((await api.criarDemanda(tokenB, demandas.valida())).body);

  // Percorre a listagem INTEIRA, e nao a primeira pagina. Uma assercao de
  // ausencia sobre uma pagina so passaria verde tanto com isolamento correto
  // quanto com vazamento na pagina 2.
  const itens = await api.percorrerListagem(tokenA);
  assert.ok(itens.length > 0, 'o cidadao nao viu nenhuma demanda propria');

  const alheias = itens.filter(d => d.id === demandaDeB.id);
  assert.deepEqual(
    alheias,
    [],
    `VAZAMENTO ENTRE CIDADAOS: a listagem de ${USUARIOS.cidadao.email} incluiu a demanda ` +
    `${demandaDeB.id}, registrada por ${USUARIOS.cidadaoSecundario.email}`,
  );

  const perfilA = insp.carga((await api.meuPerfil(tokenA)).body);
  const autoresEstranhos = [...new Set(itens.map(d => d.author?.id).filter(id => id && id !== perfilA.id))];
  assert.deepEqual(
    autoresEstranhos,
    [],
    `a listagem do cidadao trouxe demandas de outros autores: ${autoresEstranhos.join(', ')}`,
  );
});

test('HU-09 C28 gestor enxerga demandas de qualquer cidadao', async () => {
  const tokenCidadao = await api.tokenDe(USUARIOS.cidadao);
  const criada = insp.carga((await api.criarDemanda(tokenCidadao, demandas.valida())).body);

  const tokenGestor = await api.tokenDe(USUARIOS.gestor);

  // Procura em toda a listagem: com o ambiente acumulado, a demanda recem
  // criada pode nao estar na primeira pagina, e "nao esta na pagina 1" nao e
  // o mesmo que "o gestor nao enxerga".
  const encontrada = await api.localizarNaListagem(tokenGestor, criada.id);

  assert.ok(
    encontrada,
    'o gestor nao enxergou a demanda recem-registrada em nenhuma pagina da listagem: o ' +
    'README diz que ele atualiza "qualquer demanda", logo precisa consegui-la ver',
  );
  assert.equal(encontrada.id, criada.id);
});

test('HU-09 C29 a listagem devolve o bloco de paginacao do contrato', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  await api.criarDemanda(token, demandas.valida());

  const { body } = await api.listarDemandas(token);
  const pag = insp.paginacao(body);

  assert.ok(pag, `a resposta de listagem nao trouxe bloco de paginacao: ${JSON.stringify(body).slice(0, 300)}`);
  for (const campo of ['page', 'pageSize', 'totalItems', 'totalPages']) {
    assert.ok(pag[campo] !== undefined, `paginacao sem o campo "${campo}"`);
  }
  assert.equal(typeof pag.totalItems, 'number', 'totalItems deveria ser numero');
});

test('HU-09 C30 pageSize limita a quantidade de itens devolvidos', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  await api.criarDemanda(token, demandas.valida());
  await api.criarDemanda(token, demandas.valida());

  const { status, body } = await api.listarDemandas(token, { page: 1, pageSize: 1 });

  assert.equal(status, 200);
  assert.equal(
    insp.lista(body).length,
    1,
    `pageSize=1 deveria devolver 1 item; devolveu ${insp.lista(body).length}`,
  );
});

test('HU-12 C31 filtro por status devolve somente demandas naquele status', async () => {
  const tokenCidadao = await api.tokenDe(USUARIOS.cidadao);
  await api.criarDemanda(tokenCidadao, demandas.valida());

  const itens = await api.percorrerListagem(tokenCidadao, { status: contrato.STATUS_INICIAL });
  const fora = itens.filter(d => d.status !== contrato.STATUS_INICIAL);
  assert.deepEqual(
    fora.map(d => `${d.id}:${d.status}`),
    [],
    `o filtro status=${contrato.STATUS_INICIAL} devolveu itens em outro status`,
  );
});

test('HU-12 C32 filtro por categoria devolve somente aquela categoria', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const categoria = contrato.CATEGORIAS[0];
  await api.criarDemanda(token, demandas.com({ category: categoria }));

  const itens = await api.percorrerListagem(token, { category: categoria });
  const fora = itens.filter(d => d.category !== categoria);
  assert.deepEqual(fora.map(d => d.category), [], `o filtro category=${categoria} devolveu outras categorias`);
});

test('HU-09 C33 demanda inexistente responde 404', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const { status, body } = await api.obterDemanda(token, '00000000-0000-0000-0000-000000000000');

  assert.equal(status, 404, `esperado 404 para id inexistente; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.NAO_ENCONTRADO);
});

test('HU-09 C34 identificador malformado nao produz erro interno', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const resposta = await api.obterDemanda(token, 'nao-e-um-id-valido');

  // 400 ou 404 sao respostas legitimas; 500 significa excecao nao tratada
  // vazando para o cliente, e isso e defeito em qualquer contrato.
  assert.ok(
    [400, 404].includes(resposta.status),
    `id malformado deveria responder 400 ou 404; respondeu ${insp.resumo(resposta)}`,
  );
});

test('HU-09 C35 o detalhe da demanda expoe os campos do contrato', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());
  const token = await api.tokenDe(USUARIOS.cidadao);

  const { status, body } = await api.obterDemanda(token, id);
  assert.equal(status, 200);

  const ausentes = insp.camposAusentes(body, [
    'id',
    'protocol',
    'category',
    'description',
    'status',
    'location',
    'createdAt',
  ]);
  assert.deepEqual(ausentes, [], `o detalhe da demanda nao trouxe os campos: ${ausentes.join(', ')}`);
});
