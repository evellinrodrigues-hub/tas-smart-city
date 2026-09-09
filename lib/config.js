/**
 * lib/config.js - Biblioteca base. Configuracao do alvo.
 *
 * Requisito R4 da TAS: trocar o endereco do SUT NAO deve alterar codigo de
 * teste. Todo endereco, credencial e caminho vive aqui e vem do ambiente.
 *
 * O valor padrao e conveniencia e e divida tecnica consciente: um dia alguem
 * vai rodar contra o alvo errado sem perceber. Por isso `npm run diagnostico`
 * imprime contra QUEM a suite vai falar antes de qualquer execucao.
 */

// Porta 5000 e o padrao do Flask e o exemplo do README do Smart-City
// (EXPO_PUBLIC_API_URL=http://localhost:5000).
const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

/**
 * [A] Caminhos documentados no README do Smart-City, secao 6.
 * Prefixos configuraveis porque o back-end pode versionar as rotas (/api/v1)
 * sem que nenhum teste mude.
 */
const PREFIXO_AUTH = process.env.PREFIXO_AUTH ?? '/auth';
const PREFIXO_API = process.env.PREFIXO_API ?? '/api';

const ROTAS = {
  registrar: `${PREFIXO_AUTH}/register`,
  login: `${PREFIXO_AUTH}/login`,
  eu: `${PREFIXO_AUTH}/me`,
  atualizarPerfil: `${PREFIXO_AUTH}/update`,
  renovarToken: `${PREFIXO_AUTH}/refresh`,
  logout: `${PREFIXO_AUTH}/logout`,
  demandas: `${PREFIXO_API}/demandas`,
  demanda: id => `${PREFIXO_API}/demandas/${id}`,
};

/**
 * Credenciais dos usuarios de teste. Credencial literal em codigo de teste
 * vira credencial literal no GitHub: tudo vem do ambiente, e o valor padrao
 * so serve para o SUT de referencia local.
 */
// Perfis vem de data/contrato.js (unica fonte): PERFIS.CIDADAO/GESTOR/ADMIN
// ja refletem a grafia real do back-end ('cidadao'/'gestor'/'admin'), nao
// mais o enum hipotetico em ingles.
const { PERFIS } = require('../data/contrato');

const USUARIOS = {
  cidadao: {
    email: process.env.USUARIO_CIDADAO || 'ana@exemplo.com',
    senha: process.env.SENHA_CIDADAO || process.env.SENHA_PADRAO || 'senha123',
    perfil: PERFIS.CIDADAO,
  },
  cidadaoSecundario: {
    email: process.env.USUARIO_CIDADAO_2 || 'bruno@exemplo.com',
    senha: process.env.SENHA_CIDADAO_2 || process.env.SENHA_PADRAO || 'senha123',
    perfil: PERFIS.CIDADAO,
  },
  gestor: {
    email: process.env.USUARIO_GESTOR || 'gestor@exemplo.com',
    senha: process.env.SENHA_GESTOR || process.env.SENHA_PADRAO || 'senha123',
    perfil: PERFIS.GESTOR,
  },
  admin: {
    email: process.env.USUARIO_ADMIN || 'admin@exemplo.com',
    senha: process.env.SENHA_ADMIN || process.env.SENHA_PADRAO || 'senha123',
    perfil: PERFIS.ADMIN,
  },
};

/** Tempo maximo de espera por resposta, para nao pendurar a esteira. */
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000);

module.exports = { BASE_URL, ROTAS, USUARIOS, TIMEOUT_MS, PREFIXO_AUTH, PREFIXO_API };
