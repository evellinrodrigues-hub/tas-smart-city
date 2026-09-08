/**
 * data/matriz-autorizacao.js - Oraculo de autorizacao por perfil.
 *
 * Transcrito da secao 8 do README do Smart-City:
 *
 *   CITIZEN  cria demandas, edita e exclui apenas as proprias (enquanto
 *            pendentes), visualiza o proprio historico.
 *   MANAGER  atualiza status e prioridade de qualquer demanda, nao pode
 *            excluir demandas ja concluidas.
 *   ADMIN    pode promover usuarios para Gestor via PATCH /auth/update.
 *
 * A regra de autorizacao vive no servidor; a interface apenas reflete a
 * decisao. Por isso ela e verificada aqui, no nivel de servico, e nao pela
 * tela: pela interface, 403 e 404 produzem a mesma mensagem, e a distincao
 * entre os dois e justamente a regra de maior consequencia.
 */

const { PERFIS } = require('./contrato');

/**
 * Cada celula declara o resultado esperado do PERFIL naquela operacao.
 * `permitido: true` significa "a API deve executar"; `false` significa
 * "a API deve recusar com 403".
 */
const MATRIZ = [
  {
    id: 'A1',
    operacao: 'POST /api/demandas (registrar demanda)',
    origem: 'README secao 8: "CITIZEN cria demandas"',
    permissoes: {
      [PERFIS.CIDADAO]: true,
      [PERFIS.GESTOR]: false,
      [PERFIS.ADMIN]: false,
    },
  },
  {
    id: 'A2',
    operacao: 'GET /api/demandas (listar)',
    origem: 'README secao 6.2 + 8: cidadao ve o proprio historico, gestor consulta',
    permissoes: {
      [PERFIS.CIDADAO]: true,
      [PERFIS.GESTOR]: true,
      [PERFIS.ADMIN]: true,
    },
  },
  {
    id: 'A3',
    operacao: 'PATCH /api/demandas/{id} (status e prioridade)',
    origem: 'README secao 8: "MANAGER atualiza status e prioridade de qualquer demanda"',
    permissoes: {
      [PERFIS.CIDADAO]: false,
      [PERFIS.GESTOR]: true,
    },
  },
  {
    id: 'A4',
    operacao: 'PATCH /auth/update com role (promover usuario)',
    origem: 'README secao 8: "ADMIN pode promover usuarios para Gestor"',
    permissoes: {
      [PERFIS.CIDADAO]: false,
      [PERFIS.GESTOR]: false,
      [PERFIS.ADMIN]: true,
    },
  },
];

/**
 * Celulas que o README NAO decide. Nao inventamos o resultado esperado: sao
 * perguntas abertas para a equipe de back-end, registradas em docs/tas.md
 * (risco R-04) e reportadas pela suite como pendencia, nunca como falha.
 */
const NAO_DOCUMENTADO = [
  {
    id: 'A3-admin',
    pergunta: 'ADMIN pode atualizar status/prioridade de demanda, ou apenas promover usuarios?',
  },
  {
    id: 'A5-admin-delete',
    pergunta: 'ADMIN pode excluir demanda concluida, ou a restricao do MANAGER tambem vale para ele?',
  },
  {
    id: 'A6-gestor-setor',
    pergunta:
      'Ha isolamento por setor entre gestores (cenario TS16 dos casos de teste da squad)? ' +
      'O README fala em "qualquer demanda", o que contradiz o isolamento por setor.',
  },
];

/** Achata a matriz em uma celula por linha, pronta para gerar um caso cada. */
const celulas = () =>
  MATRIZ.flatMap(linha =>
    Object.entries(linha.permissoes).map(([perfil, permitido]) => ({
      id: `${linha.id}-${perfil}`,
      operacao: linha.operacao,
      origem: linha.origem,
      perfil,
      permitido,
    })),
  );

module.exports = { MATRIZ, NAO_DOCUMENTADO, celulas };
