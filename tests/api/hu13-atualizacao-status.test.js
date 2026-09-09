/**
 * HU-13 Atualizacao de status e prioridade.
 *
 * Risco: Alto / Probabilidade: Media.
 * A maquina de estados e fechada: uma demanda que volta de RESOLVED para
 * IN_PROGRESS corrompe o historico e o calculo de tempo de atendimento, que
 * a disciplina de Dados usa como indicador.
 *
 * POR QUE A EXAUSTIVIDADE ESTA AQUI, E NAO NO NIVEL DE COMPONENTE
 * ---------------------------------------------------------------------------
 * O material recomenda verificar os 25 pares no nivel de componente, onde
 * custam milissegundos. Nao e possivel nesta TAS: a regra vive no back-end
 * Flask, em Python, e um runner Node nao alcanca aquele modulo. Verificar 2
 * ou 3 pares pela API e chamar isso de cobertura deixaria 20 recusas sem
 * verificacao nenhuma — e sao justamente as recusas que interessam.
 *
 * Decisao: manter os 25 pares no nivel de servico, assumindo o custo, ATE que
 * exista uma suite de unidade em Python no repositorio do back-end. Item 1 do
 * backlog em docs/tas.md, com o pedido de refatoracao ja formulado.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const { USUARIOS } = require('../../lib/config');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');
const demandas = require('../../data/demandas');

// Os dois lacos: 5 estados de origem x 5 de destino = 25 casos, dos quais 20
// negativos. O veredito de cada par vem do contrato (data/contrato.js), nunca
// do comportamento observado no SUT.
for (const par of contrato.paresDeTransicao()) {
  const rotulo = par.permitida ? 'e aceita' : 'e recusada com 409';

  test(`HU-13 C36 transicao ${par.de} -> ${par.para} ${rotulo}`, async () => {
    const { id } = await api.demandaNoEstado(par.de, demandas.valida());
    const tokenGestor = await api.tokenDe(USUARIOS.gestor);

    const resposta = await api.mudarStatus(tokenGestor, id, par.para);

    if (par.permitida) {
      assert.equal(
        resposta.status,
        200,
        `a transicao ${par.de} -> ${par.para} e permitida pelo contrato, mas a API ` +
        `respondeu ${insp.resumo(resposta)}`,
      );
      assert.equal(
        insp.carga(resposta.body).status,
        par.para,
        'a API respondeu 200 mas nao aplicou o novo status: status HTTP correto com estado ' +
        'errado e defeito, e so esta assercao o pega',
      );
      return;
    }

    assert.equal(
      resposta.status,
      409,
      `a transicao ${par.de} -> ${par.para} NAO e permitida pelo contrato, mas a API ` +
      `respondeu ${insp.resumo(resposta)}`,
    );
    assert.equal(insp.codigoDeErro(resposta.body), contrato.ERROS.TRANSICAO_INVALIDA);

    // Recusar com 409 e alterar o estado de todo modo seria o pior dos
    // mundos: o cliente ve o erro e a base fica corrompida.
    const depois = await api.obterDemanda(tokenGestor, id);
    assert.equal(
      insp.carga(depois.body).status,
      par.de,
      `a API recusou a transicao com 409 mas alterou o status de ${par.de} para ` +
      `${insp.carga(depois.body).status}`,
    );
  });
}

test('HU-13 C37 status fora da lista fechada responde 400, nao 409', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());
  const tokenGestor = await api.tokenDe(USUARIOS.gestor);

  // Valor inexistente e erro de validacao; 409 seria dizer "transicao
  // invalida" para algo que nem e um estado.
  const { status, body } = await api.mudarStatus(tokenGestor, id, 'CONCLUIDO_TALVEZ');

  assert.equal(status, 400, `esperado 400 para status inexistente; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.VALIDACAO);
  assert.ok(
    insp.camposComErro(body).some(c => c.includes('status')),
    `o erro deveria apontar o campo status; apontou ${JSON.stringify(insp.camposComErro(body))}`,
  );
});

test('HU-13 C38 gestor atualiza a prioridade da demanda', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());
  const tokenGestor = await api.tokenDe(USUARIOS.gestor);
  const novaPrioridade = contrato.PRIORIDADES.at(-1);

  const { status, body } = await api.atualizarDemanda(tokenGestor, id, { prioridade: novaPrioridade });

  assert.equal(status, 200, `esperado 200 ao atualizar prioridade; recebido ${status}`);
  assert.equal(insp.carga(body).priority, novaPrioridade, 'a prioridade nao foi aplicada');
});

test('HU-13 C39 prioridade fora da lista fechada responde 400', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS_INICIAL, demandas.valida());
  const tokenGestor = await api.tokenDe(USUARIOS.gestor);

  const { status, body } = await api.atualizarDemanda(tokenGestor, id, { prioridade: 'URGENTISSIMA' });

  assert.equal(status, 400, `esperado 400 para prioridade inexistente; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.VALIDACAO);
});

test('HU-13 C40 a resolucao registra a data de conclusao', async () => {
  const { id } = await api.demandaNoEstado(contrato.STATUS.RESOLVIDA, demandas.valida());
  const tokenGestor = await api.tokenDe(USUARIOS.gestor);

  const { body } = await api.obterDemanda(tokenGestor, id);
  const demanda = insp.carga(body);

  assert.equal(demanda.status, contrato.STATUS.RESOLVIDA, 'preparacao: a demanda deveria estar resolvida');
  assert.ok(
    demanda.resolvedAt,
    'demanda resolvida sem data de resolucao: o calculo de tempo de atendimento fica impossivel',
  );
});
