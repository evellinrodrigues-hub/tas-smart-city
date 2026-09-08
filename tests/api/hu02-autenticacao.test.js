/**
 * HU-02 Autenticacao e sessao.
 *
 * Risco: Alto / Probabilidade: Media.
 * Sem login, nenhuma outra funcao existe. Token com validade e logout
 * invalidando o token sao os pontos mais sensiveis a regressao.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const { USUARIOS, ROTAS } = require('../../lib/config');
const http = require('../../lib/http');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');

test('HU-02 C01 login com credenciais validas devolve access e refresh token', async () => {
  const { status, body } = await api.login(USUARIOS.cidadao.email, USUARIOS.cidadao.senha);

  assert.equal(status, 200, `esperado 200 no login valido; recebido ${status}`);

  const tokens = api.extrairTokens(body);
  assert.ok(tokens.accessToken, `resposta sem access token: ${JSON.stringify(body)}`);
  assert.ok(tokens.refreshToken, `resposta sem refresh token: ${JSON.stringify(body)}`);
  assert.notEqual(
    tokens.accessToken,
    tokens.refreshToken,
    'access e refresh token identicos: um deles nao esta cumprindo sua funcao',
  );
});

test('HU-02 C02 login com senha incorreta responde 401', async () => {
  const { status, body } = await api.login(USUARIOS.cidadao.email, 'senha-obviamente-errada');

  assert.equal(status, 401, `esperado 401 com senha errada; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.CREDENCIAL_INVALIDA);
});

test('HU-02 C03 login de e-mail inexistente nao revela que a conta nao existe', async () => {
  const inexistente = await api.login('ninguem.aqui.existe@exemplo.com', 'qualquer-senha');
  const senhaErrada = await api.login(USUARIOS.cidadao.email, 'senha-obviamente-errada');

  assert.equal(inexistente.status, 401);
  // Resposta distinta entre "nao existe" e "senha errada" permite enumerar
  // contas validas. E defeito de seguranca, nao de usabilidade.
  assert.equal(
    inexistente.status,
    senhaErrada.status,
    'status diferente entre conta inexistente e senha errada permite enumeracao de usuarios',
  );
  assert.equal(
    insp.codigoDeErro(inexistente.body),
    insp.codigoDeErro(senhaErrada.body),
    'codigo de erro diferente entre conta inexistente e senha errada permite enumeracao',
  );
});

test('HU-02 C04 login sem campos obrigatorios responde 400 apontando o campo', async () => {
  const { status, body } = await http.post(ROTAS.login, {});

  assert.equal(status, 400, `esperado 400 sem credenciais; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.VALIDACAO);
  assert.ok(
    insp.camposComErro(body).includes('email'),
    `o erro deveria apontar o campo email; apontou ${JSON.stringify(insp.camposComErro(body))}`,
  );
});

test('HU-02 C05 rota protegida sem token responde 401', async () => {
  const { status, body } = await http.get(ROTAS.eu);

  assert.equal(status, 401, `esperado 401 sem token; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.NAO_AUTENTICADO);
});

test('HU-02 C06 token inexistente responde 401', async () => {
  const { status } = await api.meuPerfil('token-que-nunca-foi-emitido');

  assert.equal(status, 401, `esperado 401 com token invalido; recebido ${status}`);
});

test('HU-02 C07 header Authorization sem o esquema Bearer responde 401', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  // Token valido, esquema ausente. Aceitar isso e aceitar um formato de
  // credencial que o contrato nao preve.
  const { status } = await http.get(ROTAS.eu, { autorizacaoBruta: token });

  assert.equal(status, 401, `esperado 401 com Authorization sem "Bearer"; recebido ${status}`);
});

test('HU-02 C08 perfil autenticado devolve os dados do proprio usuario', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);
  const { status, body } = await api.meuPerfil(token);

  assert.equal(status, 200);
  const eu = insp.carga(body);
  assert.equal(eu.email, USUARIOS.cidadao.email, 'a API devolveu o perfil de outro usuario');
  assert.equal(eu.role, contrato.PERFIS.CIDADAO);
});

test('HU-02 C09 nenhuma resposta de autenticacao vaza senha ou hash', async () => {
  const login = await api.login(USUARIOS.cidadao.email, USUARIOS.cidadao.senha);
  const perfil = await api.meuPerfil(api.extrairTokens(login.body).accessToken);

  for (const [nome, resposta] of [['login', login], ['perfil', perfil]]) {
    const vazamentos = insp.camposProibidos(resposta.body, contrato.CAMPOS_PROIBIDOS_EM_RESPOSTA);
    assert.deepEqual(
      vazamentos,
      [],
      `a resposta de ${nome} expos credencial em: ${vazamentos.join(', ')}`,
    );
  }
});

test('HU-02 C10 refresh token valido renova o access token', async () => {
  const { refreshToken } = await api.autenticar(USUARIOS.cidadao);
  const { status, body } = await api.renovarToken(refreshToken);

  assert.equal(status, 200, `esperado 200 ao renovar; recebido ${status}`);

  const novo = api.extrairTokens(body).accessToken;
  assert.ok(novo, `renovacao nao devolveu access token: ${JSON.stringify(body)}`);

  // O token novo precisa de fato funcionar: renovar e devolver algo inutil
  // seria um 200 mentiroso.
  const { status: statusPerfil } = await api.meuPerfil(novo);
  assert.equal(statusPerfil, 200, 'o access token renovado nao autentica');
});

test('HU-02 C11 access token nao serve como refresh token', async () => {
  const { accessToken } = await api.autenticar(USUARIOS.cidadao);
  const { status } = await api.renovarToken(accessToken, { refresh_token: accessToken });

  // Aceitar um access token aqui alonga a sessao indefinidamente e anula a
  // razao de existir de dois tokens.
  assert.equal(
    status,
    401,
    `access token foi aceito como refresh token (status ${status}): a distincao entre os dois tokens nao esta sendo verificada`,
  );
});

test('HU-02 C12 logout invalida o token usado na sessao', async () => {
  const token = await api.tokenDe(USUARIOS.cidadao);

  const antes = await api.meuPerfil(token);
  assert.equal(antes.status, 200, 'preparacao: o token deveria estar valido antes do logout');

  const saida = await api.logout(token);
  assert.ok(
    [200, 204].includes(saida.status),
    `esperado 200 ou 204 no logout; recebido ${saida.status}`,
  );

  const depois = await api.meuPerfil(token);
  assert.equal(
    depois.status,
    401,
    'o token continuou valido apos o logout: a sessao nao foi encerrada de fato',
  );
});
