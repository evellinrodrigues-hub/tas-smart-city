/**
 * HU-03 Segregacao por perfil.
 *
 * Risco: Alto / Probabilidade: ALTA.
 * A probabilidade e a mais alta da matriz nao porque autorizacao seja dificil
 * de implementar, mas porque e facil de quebrar sem que ninguem perceba: uma
 * refatoracao afrouxa a regra e nada visivel quebra. E exatamente o perfil de
 * risco que a automacao combate melhor.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const { USUARIOS } = require('../../lib/config');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');
const demandas = require('../../data/demandas');
const matriz = require('../../data/matriz-autorizacao');

/** Traduz o perfil do contrato no usuario de teste correspondente. */
const usuarioCom = perfil =>
  ({
    [contrato.PERFIS.CIDADAO]: USUARIOS.cidadao,
    [contrato.PERFIS.GESTOR]: USUARIOS.gestor,
    [contrato.PERFIS.ADMIN]: USUARIOS.admin,
  })[perfil];

/** Executa a operacao da celula com o token dado. Sem assercoes aqui. */
async function executar(operacaoId, token, perfil) {
  switch (operacaoId) {
    case 'A1':
      return api.criarDemanda(token, demandas.valida());

    case 'A2':
      return api.listarDemandas(token);

    case 'A3': {
      const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());
      return api.atualizarDemanda(token, id, { status: contrato.STATUS.EM_ANALISE });
    }

    case 'A4': {
      // Promover o gestor para gestor: operacao idempotente, para que o teste
      // possa rodar quantas vezes for preciso sem sujar o ambiente.
      const alvo = USUARIOS.gestor;
      return api.atualizarPerfil(token, { email: alvo.email, role: contrato.PERFIS.GESTOR });
    }

    default:
      throw new Error(`Operacao ${operacaoId} sem implementacao no executor de autorizacao`);
  }
}

for (const celula of matriz.celulas()) {
  const rotulo = celula.permitido ? 'permite' : 'recusa com 403';

  test(`HU-03 ${celula.id} ${celula.operacao} ${rotulo} para ${celula.perfil}`, async () => {
    const token = await api.tokenDe(usuarioCom(celula.perfil));
    const operacaoId = celula.id.split('-')[0];
    const resposta = await executar(operacaoId, token, celula.perfil);

    if (celula.permitido) {
      assert.ok(
        resposta.status >= 200 && resposta.status < 300,
        `${celula.perfil} deveria poder executar "${celula.operacao}" (${celula.origem}), ` +
        `mas a API respondeu ${insp.resumo(resposta)}`,
      );
      return;
    }

    assert.equal(
      resposta.status,
      403,
      `FALHA DE AUTORIZACAO: ${celula.perfil} NAO deveria poder executar ` +
      `"${celula.operacao}" (${celula.origem}), mas a API respondeu ${insp.resumo(resposta)}`,
    );
    assert.equal(insp.codigoDeErro(resposta.body), contrato.ERROS.PROIBIDO);
  });
}

test('HU-03 A5 demanda de terceiro responde 404 ao cidadao, e nao 403', async () => {
  // A distincao entre 403 e 404 e a regra mais sutil e a de maior
  // consequencia: 403 confirma que o recurso existe, e essa confirmacao
  // permite enumerar demandas de outros cidadaos. Pela interface, as duas
  // situacoes produzem a mesma tela de erro, e por isso ela e invisivel la.
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());

  const tokenOutroCidadao = await api.tokenDe(USUARIOS.cidadaoSecundario);
  const resposta = await api.obterDemanda(tokenOutroCidadao, id);

  assert.notEqual(
    resposta.status,
    200,
    'VAZAMENTO: um cidadao leu a demanda de outro cidadao',
  );
  assert.equal(
    resposta.status,
    404,
    `esperado 404 (recurso invisivel) e nao ${resposta.status}: responder 403 confirma a ` +
    'existencia da demanda alheia e permite enumeracao',
  );
  assert.equal(insp.codigoDeErro(resposta.body), contrato.ERROS.NAO_ENCONTRADO);
});

test('HU-03 A6 cidadao nao promove a si proprio a gestor', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const resposta = await api.atualizarPerfil(token, {
    email: USUARIOS.cidadao.email,
    role: contrato.PERFIS.GESTOR,
  });

  assert.equal(
    resposta.status,
    403,
    `ESCALONAMENTO DE PRIVILEGIO: cidadao alterou o proprio perfil (${insp.resumo(resposta)})`,
  );

  // Recusar com 403 e devolver o perfil alterado seria um 403 mentiroso.
  const { body } = await api.meuPerfil(token);
  assert.equal(insp.carga(body).role, contrato.PERFIS.CIDADAO, 'o perfil foi alterado apesar do 403');
});

test('HU-03 pendencias de contrato nao resolvidas estao registradas, nao esquecidas', () => {
  // Este caso nao verifica o SUT: verifica a propria TAS. Ele existe para que
  // as celulas que o contrato nao decide continuem visiveis a cada execucao,
  // em vez de virarem silencio. Nao inventamos o resultado esperado delas.
  assert.ok(matriz.NAO_DOCUMENTADO.length > 0);

  for (const pendencia of matriz.NAO_DOCUMENTADO) {
    console.log(`  [PENDENCIA DE CONTRATO ${pendencia.id}] ${pendencia.pergunta}`);
  }
});
