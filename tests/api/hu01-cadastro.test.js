/**
 * HU-01 Autocadastro de usuario.
 *
 * Risco: Alto / Probabilidade: Media.
 * O cadastro e a porta de entrada do sistema. O caso de maior consequencia
 * nao e o caminho feliz: e a tentativa de escalonamento de privilegio no
 * proprio corpo do cadastro.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../api/smart-city');
const insp = require('../../lib/inspecao');
const contrato = require('../../data/contrato');
const usuarios = require('../../data/usuarios');

test('HU-01 C13 cadastro com dados validos cria a conta', async () => {
  const novo = usuarios.novo();
  const { status, body } = await api.registrar(novo);

  assert.equal(status, 201, `esperado 201 no cadastro valido; recebido ${status}`);

  const criado = insp.carga(body);
  assert.equal(criado.email, novo.email);
  assert.ok(criado.id, `a conta criada nao devolveu identificador: ${JSON.stringify(body)}`);
});

test('HU-01 C14 conta recem-criada consegue autenticar', async () => {
  const novo = usuarios.novo();
  const cadastro = await api.registrar(novo);
  assert.equal(cadastro.status, 201, 'preparacao: o cadastro precisava ter sido aceito');

  // Um 201 que nao produz conta utilizavel e um falso negativo esperando
  // para acontecer: so esta assercao pega o caso.
  const { status } = await api.login(novo.email, novo.password);
  assert.equal(status, 200, 'a conta foi criada mas nao autentica');
});

test('HU-01 C15 e-mail ja cadastrado responde 409', async () => {
  const novo = usuarios.novo();
  const primeiro = await api.registrar(novo);
  assert.equal(primeiro.status, 201, 'preparacao: o primeiro cadastro precisava ter sido aceito');

  const { status, body } = await api.registrar(novo);

  assert.equal(status, 409, `esperado 409 no e-mail duplicado; recebido ${status}`);
  assert.equal(insp.codigoDeErro(body), contrato.ERROS.EMAIL_DUPLICADO);
});

test('HU-01 C16 cadastro nao permite ao proprio usuario escolher o perfil', async () => {
  // Escalonamento de privilegio: se o `role` do corpo for aceito, qualquer
  // pessoa vira GESTOR pela tela publica de cadastro. Risco maximo, e
  // completamente invisivel pela interface. Usa GESTOR, e nao ADMIN: o
  // schema real do back-end so aceita 'cidadao'/'gestor'/'servidor' como
  // valor de entrada em `role` - 'admin' e rejeitado antes mesmo de chegar
  // na regra de negocio que este caso quer testar. [C] em data/contrato.js.
  const novo = usuarios.novo({ role: contrato.PERFIS.GESTOR });
  const cadastro = await api.registrar(novo);

  assert.equal(cadastro.status, 201, 'preparacao: o cadastro precisava ter sido aceito');

  const token = await api.tokenDe({ email: novo.email, senha: novo.password });
  const { body } = await api.meuPerfil(token);
  const perfil = insp.carga(body).role;

  assert.equal(
    perfil,
    contrato.PERFIS.CIDADAO,
    `ESCALONAMENTO DE PRIVILEGIO: o corpo do cadastro pediu ${contrato.PERFIS.GESTOR} e a conta ` +
    `foi criada como ${perfil}. O perfil deve ser atribuido pelo servidor.`,
  );
});

test('HU-01 C17 cadastro nao devolve a senha enviada', async () => {
  const { body } = await api.registrar(usuarios.novo());
  const vazamentos = insp.camposProibidos(body, contrato.CAMPOS_PROIBIDOS_EM_RESPOSTA);

  assert.deepEqual(vazamentos, [], `a resposta do cadastro expos credencial em: ${vazamentos.join(', ')}`);
});

// Um caso por regra de validacao, gerado da massa. Escrever a mao levaria
// dezenas de linhas e alguem esqueceria um campo.
for (const caso of usuarios.cadastrosInvalidos()) {
  test(`HU-01 C18 cadastro recusado: ${caso.nome}`, async () => {
    const { status, body } = await api.registrar(caso.corpo);

    assert.equal(status, 400, `esperado 400 para "${caso.nome}"; recebido ${status}`);
    assert.equal(insp.codigoDeErro(body), contrato.ERROS.VALIDACAO);

    const apontados = insp.camposComErro(body);
    assert.ok(
      apontados.some(c => c.includes(caso.campoEsperado)),
      `o erro deveria apontar "${caso.campoEsperado}"; apontou ${JSON.stringify(apontados)}. ` +
      'Sem isso, o teste passaria se a API recusasse o cadastro pelo motivo errado.',
    );
  });
}
