/**
 * sut-referencia/server.js
 *
 * ISTO NAO E O SUT. E um DUPLO DE REFERENCIA DO CONTRATO.
 * ==========================================================================
 * O SUT do Projeto Integrador e a API Flask do Smart City, que roda a partir
 * do seu proprio repositorio. Este servidor existe por dois motivos, ambos
 * declarados como decisao em docs/tas.md (secao 3):
 *
 *   1. REPRODUTIBILIDADE. A suite precisa rodar na maquina de qualquer pessoa
 *      da squad e na esteira, hoje, sem depender de o back-end estar no ar.
 *
 *   2. TRIANGULACAO. Ele implementa o contrato ao pe da letra. Por isso,
 *      qualquer diferenca de resultado entre este alvo e o back-end real
 *      aponta uma divergencia — e cada divergencia exige a pergunta de tres
 *      vias: esta no back-end, no teste ou no proprio contrato?
 *
 * AVISO QUE NAO PODE SER ESQUECIDO: suite verde contra este servidor prova
 * que a SUITE funciona. Nao prova nada sobre o produto. Automacao de vitrine
 * e exatamente isso, e a entrega da U1 exige o contrario.
 *
 * Zero dependencias, por decisao didatica: runner e cliente HTTP vem do Node.
 */

'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const contrato = require('../data/contrato');

const PORTA = Number(process.env.PORT || 5000);
const SENHA_PADRAO = process.env.SENHA_PADRAO || 'senha123';

/**
 * VERIFICACAO DE SENSIBILIDADE
 * --------------------------------------------------------------------------
 * Um teste que nunca falhou nao foi testado. Rodar a suite contra uma versao
 * com defeito CONHECIDO e o unico jeito confiavel de saber se a assercao
 * verifica alguma coisa.
 *
 * Em vez de alterar o servidor a mao (e alguem esquecer de reverter), os
 * defeitos sao injetados por variavel de ambiente e ficam versionados. Cada
 * um mira uma assercao especifica da suite:
 *
 *   DEFEITO=transicao-extra     abre RESOLVED -> IN_PROGRESS (fora do contrato)
 *   DEFEITO=role-do-cliente     cadastro obedece ao `role` enviado pelo cliente
 *   DEFEITO=403-em-vez-de-404   recurso de terceiro confirma que existe
 *   DEFEITO=vaza-senha          respostas de usuario incluem a senha
 *   DEFEITO=sem-code            erros perdem o campo `code`
 *   DEFEITO=status-inicial      demanda nasce em IN_PROGRESS
 *
 * Uso: npm run sensibilidade
 */
const DEFEITO = process.env.DEFEITO || '';

// --------------------------------------------------------------------------
// Estado em memoria
// --------------------------------------------------------------------------

const usuarios = new Map(); // email -> usuario
const sessoes = new Map(); // token -> { email, tipo }
const demandas = []; // lista de demandas
let sequencia = 0;

function semearUsuario(email, nome, perfil) {
  usuarios.set(email, { id: randomUUID(), name: nome, email, role: perfil, password: SENHA_PADRAO });
}

semearUsuario('ana@exemplo.com', 'Ana Cidada', contrato.PERFIS.CIDADAO);
semearUsuario('bruno@exemplo.com', 'Bruno Cidadao', contrato.PERFIS.CIDADAO);
semearUsuario('gestor@exemplo.com', 'Gestor Publico', contrato.PERFIS.GESTOR);
semearUsuario('admin@exemplo.com', 'Administrador', contrato.PERFIS.ADMIN);

// --------------------------------------------------------------------------
// Utilitarios de resposta
// --------------------------------------------------------------------------

const enviar = (res, codigo, corpo) => {
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' });
  res.end(corpo === undefined ? '' : JSON.stringify(corpo));
};

const falhar = (res, codigo, code, message, details) =>
  enviar(res, codigo, {
    error: {
      ...(DEFEITO === 'sem-code' ? {} : { code }),
      message,
      ...(details ? { details } : {}),
    },
  });

const semConteudo = res => {
  res.writeHead(204);
  res.end();
};

/** Usuario publico: jamais devolve senha nem hash. */
const publico = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  ...(DEFEITO === 'vaza-senha' ? { password: u.password } : {}),
});

const agora = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

// --------------------------------------------------------------------------
// Validacao
// --------------------------------------------------------------------------

const ehTexto = v => typeof v === 'string' && v.trim().length > 0;
const naFaixa = (v, { min, max }) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function validarCadastro(corpo) {
  const d = [];
  if (!ehTexto(corpo.username)) d.push({ field: 'username', issue: 'Obrigatorio.' });
  if (!ehTexto(corpo.email) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(corpo.email)) {
    d.push({ field: 'email', issue: 'E-mail invalido.' });
  }
  if (!ehTexto(corpo.password) || corpo.password.length < contrato.LIMITES.senhaMin) {
    d.push({ field: 'password', issue: `Minimo de ${contrato.LIMITES.senhaMin} caracteres.` });
  }
  return d;
}

function validarDemanda(corpo) {
  const d = [];
  if (!ehTexto(corpo.titulo) || corpo.titulo.length < contrato.LIMITES.tituloMin || corpo.titulo.length > contrato.LIMITES.tituloMax) {
    d.push({
      field: 'titulo',
      issue: `Entre ${contrato.LIMITES.tituloMin} e ${contrato.LIMITES.tituloMax} caracteres.`,
    });
  }
  if (!contrato.CATEGORIAS.includes(corpo.categoria)) {
    d.push({ field: 'categoria', issue: 'Valor fora da lista fechada.' });
  }
  const desc = corpo.descricao;
  if (!ehTexto(desc) || desc.length < contrato.LIMITES.descricaoMin || desc.length > contrato.LIMITES.descricaoMax) {
    d.push({
      field: 'descricao',
      issue: `Entre ${contrato.LIMITES.descricaoMin} e ${contrato.LIMITES.descricaoMax} caracteres.`,
    });
  }
  const loc = corpo.localizacao;
  if (!ehTexto(loc) || loc.length < contrato.LIMITES.localizacaoMin || loc.length > contrato.LIMITES.localizacaoMax) {
    d.push({
      field: 'localizacao',
      issue: `Entre ${contrato.LIMITES.localizacaoMin} e ${contrato.LIMITES.localizacaoMax} caracteres.`,
    });
  }
  if (!contrato.PRIORIDADES.includes(corpo.prioridade)) {
    d.push({ field: 'prioridade', issue: 'Valor fora da lista fechada.' });
  }
  return d;
}

// --------------------------------------------------------------------------
// Rotas
// --------------------------------------------------------------------------

const ROTAS_CONHECIDAS = new Map([
  ['/auth/register', ['POST']],
  ['/auth/login', ['POST']],
  ['/auth/me', ['GET']],
  ['/auth/update', ['PATCH']],
  ['/auth/refresh', ['POST']],
  ['/auth/logout', ['GET']],
  ['/api/demandas', ['GET', 'POST']],
]);

const servidor = http.createServer((req, res) => {
  let bruto = '';
  req.on('data', pedaco => {
    bruto += pedaco;
    if (bruto.length > 2_000_000) req.destroy();
  });

  req.on('end', () => {
    try {
      tratar(req, res, bruto);
    } catch (erro) {
      falhar(res, 500, 'INTERNAL_ERROR', erro.message);
    }
  });
});

function tratar(req, res, bruto) {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  const caminho = url.pathname.replace(/\/+$/, '') || '/';
  const metodo = req.method;

  // Corpo malformado nunca deve virar 500.
  let corpo = {};
  if (bruto) {
    try {
      corpo = JSON.parse(bruto);
    } catch {
      return falhar(res, 400, contrato.ERROS.CORPO_INVALIDO, 'Corpo da requisicao nao e JSON valido.');
    }
    if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
      return falhar(res, 400, contrato.ERROS.CORPO_INVALIDO, 'Corpo deve ser um objeto JSON.');
    }
  }

  const metodosDaRota = ROTAS_CONHECIDAS.get(caminho);
  if (metodosDaRota && !metodosDaRota.includes(metodo)) {
    res.setHeader('allow', metodosDaRota.join(', '));
    return falhar(res, 405, contrato.ERROS.METODO_NAO_PERMITIDO, `Use ${metodosDaRota.join(' ou ')}.`);
  }

  // ---- Rotas publicas -----------------------------------------------------

  if (caminho === '/auth/login' && metodo === 'POST') {
    if (!ehTexto(corpo.email) || !ehTexto(corpo.password)) {
      return falhar(res, 400, contrato.ERROS.VALIDACAO, 'Verifique os campos.', [
        ...(ehTexto(corpo.email) ? [] : [{ field: 'email', issue: 'Obrigatorio.' }]),
        ...(ehTexto(corpo.password) ? [] : [{ field: 'password', issue: 'Obrigatorio.' }]),
      ]);
    }
    const u = usuarios.get(corpo.email);
    // Mesma resposta para usuario inexistente e senha errada: nao vaza quais
    // e-mails estao cadastrados.
    if (!u || u.password !== corpo.password) {
      return falhar(res, 401, contrato.ERROS.CREDENCIAL_INVALIDA, 'E-mail ou senha incorretos.');
    }
    const accessToken = randomUUID();
    const refreshToken = randomUUID();
    sessoes.set(accessToken, { email: u.email, tipo: 'access' });
    sessoes.set(refreshToken, { email: u.email, tipo: 'refresh' });
    return enviar(res, 200, {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: publico(u),
    });
  }

  if (caminho === '/auth/register' && metodo === 'POST') {
    const detalhes = validarCadastro(corpo);
    if (detalhes.length) {
      return falhar(res, 400, contrato.ERROS.VALIDACAO, 'Verifique os campos.', detalhes);
    }
    if (usuarios.has(corpo.email)) {
      return falhar(res, 409, contrato.ERROS.EMAIL_DUPLICADO, 'E-mail ja cadastrado.');
    }
    // O perfil e atribuido pelo servidor. Um `role` no corpo e ignorado:
    // promocao so acontece por ADMIN em PATCH /auth/update.
    const novo = {
      id: randomUUID(),
      name: corpo.username,
      email: corpo.email,
      role: DEFEITO === 'role-do-cliente' ? (corpo.role ?? contrato.PERFIS.CIDADAO) : contrato.PERFIS.CIDADAO,
      password: corpo.password,
    };
    usuarios.set(novo.email, novo);
    return enviar(res, 201, publico(novo));
  }

  // ---- A partir daqui, exige autenticacao ---------------------------------

  const cabecalho = req.headers.authorization || '';
  const casamento = /^Bearer (.+)$/.exec(cabecalho);
  const sessao = casamento ? sessoes.get(casamento[1]) : null;
  const usuario = sessao ? usuarios.get(sessao.email) : null;

  if (caminho === '/auth/refresh' && metodo === 'POST') {
    const alvo = corpo.refresh_token ?? corpo.refreshToken ?? (casamento ? casamento[1] : null);
    const s = alvo ? sessoes.get(alvo) : null;
    // Um access token nao serve para renovar: confundir os dois e falha de sessao.
    if (!s || s.tipo !== 'refresh') {
      return falhar(res, 401, contrato.ERROS.NAO_AUTENTICADO, 'Refresh token ausente ou invalido.');
    }
    const novoAccess = randomUUID();
    sessoes.set(novoAccess, { email: s.email, tipo: 'access' });
    return enviar(res, 200, { access_token: novoAccess });
  }

  if (!usuario || sessao.tipo !== 'access') {
    if (ROTAS_CONHECIDAS.has(caminho) || caminho.startsWith('/api/demandas')) {
      return falhar(res, 401, contrato.ERROS.NAO_AUTENTICADO, 'Token ausente ou invalido.');
    }
  }

  if (caminho === '/auth/me' && metodo === 'GET') {
    return enviar(res, 200, publico(usuario));
  }

  if (caminho === '/auth/logout' && metodo === 'GET') {
    sessoes.delete(casamento[1]);
    return enviar(res, 200, { message: 'Sessao encerrada.' });
  }

  if (caminho === '/auth/update' && metodo === 'PATCH') {
    if (corpo.role !== undefined) {
      if (usuario.role !== contrato.PERFIS.ADMIN) {
        return falhar(res, 403, contrato.ERROS.PROIBIDO, 'Apenas ADMIN promove usuarios.');
      }
      const alvo = usuarios.get(corpo.email);
      if (!alvo) return falhar(res, 404, contrato.ERROS.NAO_ENCONTRADO, 'Usuario inexistente.');
      if (!Object.values(contrato.PERFIS).includes(corpo.role)) {
        return falhar(res, 400, contrato.ERROS.VALIDACAO, 'Perfil invalido.', [
          { field: 'role', issue: 'Valor fora da lista fechada.' },
        ]);
      }
      alvo.role = corpo.role;
      return enviar(res, 200, publico(alvo));
    }
    if (corpo.name !== undefined) {
      if (!ehTexto(corpo.name)) {
        return falhar(res, 400, contrato.ERROS.VALIDACAO, 'Verifique os campos.', [
          { field: 'name', issue: 'Obrigatorio.' },
        ]);
      }
      usuario.name = corpo.name;
    }
    return enviar(res, 200, publico(usuario));
  }

  // ---- Demandas -----------------------------------------------------------

  if (caminho === '/api/demandas' && metodo === 'POST') {
    if (usuario.role !== contrato.PERFIS.CIDADAO) {
      return falhar(res, 403, contrato.ERROS.PROIBIDO, 'Operacao vedada ao seu perfil.');
    }
    const detalhes = validarDemanda(corpo);
    if (detalhes.length) {
      return falhar(res, 400, contrato.ERROS.VALIDACAO, 'Verifique os campos.', detalhes);
    }
    const instante = agora();
    // Campos controlados pelo servidor: id, protocol, status, author, createdAt,
    // updatedAt, resolvedAt. `prioridade` NAO e controlada pelo servidor: o
    // contrato real exige e persiste o valor enviado pelo cliente na criacao.
    const demanda = {
      id: randomUUID(),
      protocol: `DEM-${new Date().getFullYear()}-${String(++sequencia).padStart(6, '0')}`,
      title: corpo.titulo,
      category: corpo.categoria,
      description: corpo.descricao,
      priority: corpo.prioridade,
      status: DEFEITO === 'status-inicial' ? contrato.STATUS.EM_ANDAMENTO : contrato.STATUS_INICIAL,
      location: corpo.localizacao,
      author: { id: usuario.id, name: usuario.name },
      createdAt: instante,
      updatedAt: instante,
      resolvedAt: null,
    };
    demandas.push(demanda);
    return enviar(res, 201, demanda);
  }

  if (caminho === '/api/demandas' && metodo === 'GET') {
    const visiveis =
      usuario.role === contrato.PERFIS.CIDADAO
        ? demandas.filter(d => d.author.id === usuario.id)
        : demandas.slice();

    const filtradas = visiveis.filter(d => {
      const status = url.searchParams.get('status');
      const categoria = url.searchParams.get('categoria') || url.searchParams.get('category');
      if (status && d.status !== status) return false;
      if (categoria && d.category !== categoria) return false;
      return true;
    });

    const pagina = Math.max(1, Number(url.searchParams.get('page') || 1));
    const porPagina = Math.max(1, Number(url.searchParams.get('per_page') || url.searchParams.get('pageSize') || 20));
    const inicio = (pagina - 1) * porPagina;

    return enviar(res, 200, {
      data: filtradas.slice(inicio, inicio + porPagina),
      pagination: {
        page: pagina,
        pageSize: porPagina,
        totalItems: filtradas.length,
        totalPages: Math.max(1, Math.ceil(filtradas.length / porPagina)),
      },
    });
  }

  const casaDemanda = /^\/api\/demandas\/([^/]+)$/.exec(caminho);
  if (casaDemanda) {
    const id = decodeURIComponent(casaDemanda[1]);
    const demanda = demandas.find(d => d.id === id);

    // Recurso de terceiro responde 404, e nao 403: impede que um cidadao
    // descubra a existencia de demandas alheias por enumeracao.
    const deTerceiro =
      demanda && usuario.role === contrato.PERFIS.CIDADAO && demanda.author.id !== usuario.id;

    if (deTerceiro && DEFEITO === '403-em-vez-de-404') {
      return falhar(res, 403, contrato.ERROS.PROIBIDO, 'Demanda de outro cidadao.');
    }
    if (!demanda || deTerceiro) {
      return falhar(res, 404, contrato.ERROS.NAO_ENCONTRADO, 'Demanda inexistente.');
    }

    if (metodo === 'GET') return enviar(res, 200, demanda);

    if (metodo === 'PATCH') {
      if (usuario.role === contrato.PERFIS.CIDADAO) {
        return falhar(res, 403, contrato.ERROS.PROIBIDO, 'Cidadao nao altera status ou prioridade.');
      }
      if (corpo.prioridade !== undefined) {
        if (!contrato.PRIORIDADES.includes(corpo.prioridade)) {
          return falhar(res, 400, contrato.ERROS.VALIDACAO, 'Prioridade invalida.', [
            { field: 'prioridade', issue: 'Valor fora da lista fechada.' },
          ]);
        }
        demanda.priority = corpo.prioridade;
      }
      if (corpo.status !== undefined) {
        if (!contrato.ESTADOS.includes(corpo.status)) {
          return falhar(res, 400, contrato.ERROS.VALIDACAO, 'Status invalido.', [
            { field: 'status', issue: 'Valor fora da lista fechada.' },
          ]);
        }
        const permitidaAqui =
          contrato.transicaoPermitida(demanda.status, corpo.status) ||
          (DEFEITO === 'transicao-extra' &&
            demanda.status === contrato.STATUS.RESOLVIDA &&
            corpo.status === contrato.STATUS.EM_ANDAMENTO);

        if (!permitidaAqui) {
          return falhar(
            res,
            409,
            contrato.ERROS.TRANSICAO_INVALIDA,
            `Transicao de ${demanda.status} para ${corpo.status} nao e permitida.`,
          );
        }
        demanda.status = corpo.status;
        if (corpo.status === contrato.STATUS.RESOLVIDA) demanda.resolvedAt = agora();
      }
      demanda.updatedAt = agora();
      return enviar(res, 200, demanda);
    }

    if (metodo === 'DELETE') {
      const concluida = contrato.ESTADOS_FINAIS.includes(demanda.status);
      const pendente = demanda.status === contrato.STATUS_INICIAL;

      if (usuario.role === contrato.PERFIS.CIDADAO && !pendente) {
        return falhar(res, 403, contrato.ERROS.PROIBIDO, 'Cidadao so exclui demanda pendente.');
      }
      if (usuario.role !== contrato.PERFIS.CIDADAO && concluida) {
        return falhar(res, 403, contrato.ERROS.PROIBIDO, 'Demanda concluida nao pode ser excluida.');
      }
      demandas.splice(demandas.indexOf(demanda), 1);
      return semConteudo(res);
    }

    res.setHeader('allow', 'GET, PATCH, DELETE');
    return falhar(res, 405, contrato.ERROS.METODO_NAO_PERMITIDO, 'Use GET, PATCH ou DELETE.');
  }

  // Rota inexistente responde JSON, nunca HTML: um cliente que espera JSON
  // quebra ao receber uma pagina de erro do framework.
  return falhar(res, 404, contrato.ERROS.NAO_ENCONTRADO, 'Recurso inexistente.');
}

servidor.listen(PORTA, () => {
  console.log(`SUT de referencia (duplo de contrato) em http://localhost:${PORTA}`);
  console.log('ATENCAO: este NAO e o back-end do Projeto Integrador.');
});
