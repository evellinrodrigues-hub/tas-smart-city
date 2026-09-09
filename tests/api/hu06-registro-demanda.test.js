/**
 * HU-06 Registro da demanda urbana.
 *
 * Risco: Alto / Probabilidade: Alta.
 * Fluxo principal do produto, com validacoes numerosas e mudancas frequentes
 * durante o semestre. Todas as variacoes de validacao ficam AQUI, no nivel de
 * servico: replicar cada uma no E2E multiplicaria o tempo por dezenas sem
 * acrescentar informacao nova.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const { USUARIOS, ROTAS } = require('../../lib/config');
const http = require('../../lib/http');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');
const demandas = require('../../data/demandas');

test('HU-06 C19 registro valido cria a demanda no status inicial', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const { status, body } = await api.criarDemanda(token, demandas.valida());

  assert.equal(status, 201, `esperado 201 no registro valido; recebido ${status}`);

  const demanda = insp.carga(body);

  // O teste nao se contenta com 201. Um teste que verifica apenas o codigo
  // HTTP e um falso negativo esperando para acontecer: a demanda poderia ser
  // criada com a categoria errada e ele continuaria verde.
  assert.equal(
    demanda.status,
    contrato.STATUS_INICIAL,
    `o contrato diz que toda demanda nasce em ${contrato.STATUS_INICIAL}`,
  );
  assert.equal(demanda.category, demandas.valida().categoria, 'a categoria enviada nao foi persistida');
  assert.equal(demanda.resolvedAt ?? null, null, 'demanda recem-criada ja nasceu com data de resolucao');
  assert.ok(demanda.id, 'a demanda criada nao devolveu identificador');
});

test('HU-06 C20 o protocolo segue o formato especificado', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const { body } = await api.criarDemanda(token, demandas.valida());
  const protocolo = insp.carga(body).protocol;

  // O valor e gerado pelo servidor e imprevisivel, mas o FORMATO e
  // especificado. As ancoras da expressao importam: sem elas, um protocolo
  // com lixo antes passaria.
  assert.ok(
    protocolo && contrato.FORMATO_PROTOCOLO.test(protocolo),
    `protocolo "${protocolo}" nao casa com ${contrato.FORMATO_PROTOCOLO}`,
  );
});

test('HU-06 C21 protocolos de demandas diferentes nao se repetem', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const primeira = await api.criarDemanda(token, demandas.valida());
  const segunda = await api.criarDemanda(token, demandas.valida());

  const p1 = insp.carga(primeira.body).protocol;
  const p2 = insp.carga(segunda.body).protocol;

  assert.notEqual(p1, p2, `duas demandas receberam o mesmo protocolo (${p1}): o identificador do cidadao nao e unico`);
});

test('HU-06 C22 registro sem autenticacao responde 401', async () => {
  const { status, body } = await http.post(ROTAS.demandas, demandas.valida());

  assert.equal(status, 401, `esperado 401 sem token; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.NAO_AUTENTICADO);
});

test('HU-06 C23 campos controlados pelo servidor sao ignorados no corpo', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);

  // Mass assignment: se o cliente conseguir definir o status, uma demanda
  // nasce RESOLVED sem ninguem ter feito nada, e o indicador de tempo de
  // atendimento vira ficcao.
  const forjada = demandas.com({
    status: contrato.STATUS.RESOLVIDA,
    protocol: 'DEM-0000-000000',
    id: 'id-escolhido-pelo-cliente',
  });

  const { status, body } = await api.criarDemanda(token, forjada);
  assert.equal(status, 201, `preparacao: esperado 201; recebido ${status}: ${JSON.stringify(body)}`);

  const criada = insp.carga(body);
  assert.equal(
    criada.status,
    contrato.STATUS_INICIAL,
    `MASS ASSIGNMENT: o cliente definiu o status da demanda (${criada.status})`,
  );
  assert.notEqual(criada.protocol, 'DEM-0000-000000', 'MASS ASSIGNMENT: o cliente definiu o protocolo');
  assert.notEqual(criada.id, 'id-escolhido-pelo-cliente', 'MASS ASSIGNMENT: o cliente definiu o id');
});

test('HU-06 C24 a autoria e atribuida ao usuario autenticado', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const perfil = insp.carga((await api.meuPerfil(token)).body);

  const { body } = await api.criarDemanda(token, demandas.com({ author: { id: 'outro-cidadao' } }));
  const autor = insp.carga(body).author;

  assert.ok(autor, 'a demanda criada nao registrou autoria');
  assert.equal(
    autor.id,
    perfil.id,
    'FALHA DE AUTORIZACAO: a demanda foi atribuida a outro cidadao, e nao a quem a registrou',
  );
});

// Um caso por regra de validacao. Os dois lacos gerariam dezenas de linhas
// escritas a mao, e alguem esqueceria um campo.
for (const caso of demandas.invalidas()) {
  test(`HU-06 C25 registro recusado: ${caso.nome}`, async () => {
    const token = await api.tokenDe(USUARIOS.cidadao);
    const { status, body } = await api.criarDemanda(token, caso.corpo);

    assert.equal(status, 400, `esperado 400 para "${caso.nome}"; recebido ${status}`);
    assert.equal(insp.codigoDeErro(body), contrato.ERROS.VALIDACAO);

    const apontados = insp.camposComErro(body);
    assert.ok(
      apontados.some(c => c.includes(caso.campoEsperado)),
      `o erro deveria apontar "${caso.campoEsperado}"; apontou ${JSON.stringify(apontados)}`,
    );
  });
}

// Valor limite: a fronteira e inclusiva. Recusar o limite exato e o defeito
// classico de "off by one", e so um caso na fronteira o encontra.
for (const caso of demandas.limitesAceitos()) {
  test(`HU-06 C26 registro aceito no valor limite: ${caso.nome}`, async () => {
    const token = await api.tokenDe(USUARIOS.cidadao);
    const { status, body } = await api.criarDemanda(token, caso.corpo);

    assert.equal(
      status,
      201,
      `o contrato aceita o valor limite em "${caso.nome}", mas a API respondeu ${status}: ` +
      `${JSON.stringify(body)}`,
    );
  });
}
