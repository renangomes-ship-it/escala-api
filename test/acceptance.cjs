/* Integration acceptance against a disposable MySQL schema. Never uses the application database. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const mysql = require('mysql2/promise');
const request = require('supertest');
const bcrypt = require('bcrypt');
require('reflect-metadata');

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const originalDatabase = process.env.DB_DATABASE;
  const database = `escala_acceptance_${Date.now()}_${randomBytes(4).toString('hex')}`;
  assert.match(database, /^escala_acceptance_\d+_[a-f0-9]{8}$/);
  assert.notEqual(database, originalDatabase);
  const connectionOptions = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  };
  process.env.DB_DATABASE = database;
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  const connection = await mysql.createConnection(connectionOptions);
  let created = false;
  let app;
  let schema;
  let checks = 0;
  const failures = [];
  async function check(label, fn) {
    try {
      await fn();
      checks++;
      console.log(`PASS ${label}`);
    } catch (error) {
      failures.push(label);
      console.log(`FAIL ${label}: ${error.message}`);
    }
  }
  try {
    await connection.query(`CREATE DATABASE \`${database}\``);
    created = true;
    const { DataSource } = require('typeorm');
    const { NestFactory } = require('@nestjs/core');
    const { ValidationPipe } = require('@nestjs/common');
    const { Oficial } = require('../dist/oficial/entities/oficial.entity');
    const { Unidade } = require('../dist/unidade/entities/unidade.entity');
    const config = require('../dist/database/data-source').default;
    assert.equal(config.options.database, database);
    schema = new DataSource({
      ...config.options,
      synchronize: false,
      migrationsRun: false,
    });
    await schema.initialize();
    // Explicitly restricted to the schema created by this process; no migrations touch existing data.
    assert.equal(schema.options.database, database);
    await schema.synchronize();
    await schema
      .getRepository(Unidade)
      .save([{ sigla: 'QCG' }, { sigla: '1º GBM' }]);
    const password = randomBytes(24).toString('hex');
    const hash = await bcrypt.hash(password, 10);
    const actors = {};
    for (const [index, [name, role, obm]] of [
      ['master', 'ADMIN_MASTER', null],
      ['comandante', 'ADMINISTRADOR', 'QCG'],
      ['escalante', 'ESCALANTE', 'QCG'],
      ['a', 'OFICIAL', 'QCG'],
      ['b', 'OFICIAL', 'QCG'],
      ['c', 'OFICIAL', 'QCG'],
      ['inapto', 'OFICIAL', 'QCG'],
      ['externo', 'OFICIAL', '1º GBM'],
    ].entries()) {
      actors[name] = await schema.getRepository(Oficial).save({
        nome: `Aceitação ${name}`,
        posto_graduacao: 'Capitão',
        data_ultima_promocao: '2020-01-01',
        rg: String(900000 + index),
        email: `${name}@example.invalid`,
        senha: hash,
        role,
        obm,
        ativo: true,
        deve_alterar_senha: false,
        versao_autenticacao: 0,
      });
    }
    const { AppModule } = require('../dist/app.module');
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    const api = request(app.getHttpServer());
    async function call(
      who,
      method,
      path,
      body,
      status = method === 'post' ? 201 : 200,
    ) {
      let req = api[method](path);
      if (who) req = req.set('Authorization', `Bearer ${actors[who].token}`);
      if (body !== undefined) req = req.send(body);
      const response = await req;
      assert.equal(
        response.status,
        status,
        `${method.toUpperCase()} ${path}: ${response.status}; ${JSON.stringify(response.body.message)}`,
      );
      return response.body;
    }
    for (const name of Object.keys(actors)) {
      const login = await call(null, 'post', '/auth/login', {
        rg: actors[name].rg,
        senha: password,
      });
      actors[name].token = login.access_token;
      assert.ok(actors[name].token);
    }
    console.log(
      'ISOLATION schema temporário criado; autenticação JWT real dos quatro perfis confirmada.',
    );
    await check('Sem autenticação não consulta efetivo', () =>
      call(null, 'get', '/oficial', undefined, 401),
    );
    await check('Login rejeita perfil forjado', () =>
      call(
        null,
        'post',
        '/auth/login',
        { rg: actors.a.rg, senha: password, role: 'ADMIN_MASTER' },
        400,
      ),
    );
    await check('Escalante não gerencia efetivo', () =>
      call('escalante', 'get', '/oficial', undefined, 403),
    );
    await check('Comandante recebe somente sua unidade', async () => {
      const people = await call('comandante', 'get', '/oficial');
      assert.ok(people.every((p) => p.obm === 'QCG'));
      assert.ok(people.every((p) => !('senha' in p)));
    });
    await check('Comandante não promove para Master', () =>
      call(
        'comandante',
        'patch',
        `/oficial/${actors.a.id}`,
        { role: 'ADMIN_MASTER' },
        403,
      ),
    );
    await check('Comandante alterna Oficial e Escalante', async () => {
      await call('comandante', 'patch', `/oficial/${actors.a.id}`, {
        role: 'ESCALANTE',
      });
      await call('comandante', 'patch', `/oficial/${actors.a.id}`, {
        role: 'OFICIAL',
      });
    });
    await check('Master transfere usuário entre unidades', async () => {
      await call('master', 'patch', `/oficial/${actors.externo.id}`, {
        obm: 'QCG',
      });
      await call('master', 'patch', `/oficial/${actors.externo.id}`, {
        obm: '1º GBM',
      });
    });
    await check('Inativação revoga token emitido', async () => {
      await call('comandante', 'patch', `/oficial/${actors.inapto.id}`, {
        ativo: false,
      });
      await call('inapto', 'get', '/escala', undefined, 401);
      await call('comandante', 'patch', `/oficial/${actors.inapto.id}`, {
        ativo: true,
      });
    });
    const units = await call('master', 'get', '/unidade');
    const externalUnit = units.find((u) => u.sigla === '1º GBM');
    await check('Master inativa e reativa unidade', async () => {
      await call('master', 'patch', `/unidade/${externalUnit.id}`, {
        ativo: false,
      });
      await call('master', 'patch', `/unidade/${externalUnit.id}`, {
        ativo: true,
      });
    });
    await check('Cadastro e troca obrigatória de senha', async () => {
      const temporary = randomBytes(20).toString('hex');
      const definitive = randomBytes(20).toString('hex');
      const person = await call('master', 'post', '/oficial', {
        nome: 'Aceitação novo',
        posto_graduacao: 'Major',
        data_ultima_promocao: '2021-01-01',
        rg: '999999',
        email: 'novo@example.invalid',
        senha: temporary,
        obm: 'QCG',
      });
      assert.equal(person.deve_alterar_senha, true);
      assert.equal(person.senha, undefined);
      const login = await call(null, 'post', '/auth/login', {
        rg: '999999',
        senha: temporary,
      });
      actors.novo = { id: person.id, token: login.access_token };
      await call('novo', 'get', '/escala', undefined, 403);
      const changed = await call('novo', 'post', '/auth/alterar-senha', {
        senhaAtual: temporary,
        novaSenha: definitive,
        confirmacaoNovaSenha: definitive,
      });
      await call('novo', 'get', '/escala', undefined, 401);
      actors.novo.token = changed.access_token;
      await call('novo', 'get', '/escala');
    });
    const colors = ['PRETA', 'ROXA', 'VERMELHA'];
    const services = Array.from({ length: 30 }, (_, i) => ({
      data_servico: `2027-04-${String(i + 1).padStart(2, '0')}`,
      tipo_escala: colors[Math.floor(i / 10)],
    }));
    const payload = {
      escala: { mes: 4, ano: 2027, obm: 'QCG', servicos: services },
      dadosFila: ['a', 'b', 'c', 'inapto'].map((name) => ({
        oficialId: actors[name].id,
        apto: name !== 'inapto',
        ...(name === 'inapto'
          ? { justificativaInaptidao: 'Motivo sintético confidencial' }
          : {}),
        cotas: {
          pretas: name === 'a' ? 4 : name === 'inapto' ? 0 : 3,
          roxas: name === 'a' ? 4 : name === 'inapto' ? 0 : 3,
          vermelhas: name === 'a' ? 4 : name === 'inapto' ? 0 : 3,
        },
      })),
    };
    await check('Falha na preparação reverte escala e serviços', async () => {
      const invalid = structuredClone(payload);
      invalid.dadosFila[0].cotas.pretas--;
      await call('escalante', 'post', '/escala/preparar', invalid, 400);
      assert.equal((await call('master', 'get', '/escala')).length, 0);
    });
    const prepared = await call(
      'escalante',
      'post',
      '/escala/preparar',
      payload,
    );
    const id = prepared.id;
    const read = () => call('master', 'get', `/escala/${id}`);
    const queue = () => call('master', 'get', `/fila-escolha/status/${id}`);
    let scale = await read();
    const ordered = [...scale.servicos].sort((a, b) =>
      a.data_servico.localeCompare(b.data_servico),
    );
    const owner = (j) => (j < 4 ? 'a' : j < 7 ? 'b' : 'c');
    const plan = ordered.flatMap((s, i) => [
      { servicoId: s.id, tipoVaga: 'DIA', who: owner(i % 10) },
      {
        servicoId: s.id,
        tipoVaga: 'SOBREAVISO',
        who: owner(((i % 10) + 4) % 10),
      },
    ]);
    const select = (item) =>
      call(item.who, 'post', '/fila-escolha/registrar-vaga', {
        escalaId: id,
        servicoId: item.servicoId,
        tipoVaga: item.tipoVaga,
      });
    await check(
      'Preparação cria 30 dias, fila e turno de 24 horas',
      async () => {
        assert.equal(scale.servicos.length, 30);
        const q = await queue();
        const current = q.progresso.find((r) => r.status === 'ESCOLHENDO');
        assert.equal(current.oficial.id, actors.a.id);
        assert.ok(new Date(current.limite_turno) - Date.now() > 23 * 3600000);
      },
    );
    await check('Não duplica unidade e período', () =>
      call('escalante', 'post', '/escala/preparar', payload, 400),
    );
    await check('Unidade externa não lê escala de QCG', async () => {
      const result = await call('externo', 'get', `/escala/${id}`);
      assert.ok(!result || !result.id);
    });
    await check('Oficial não recebe justificativa de inaptidão', async () => {
      const result = await call('a', 'get', `/escala/${id}`);
      assert.ok(
        result.fila_escolhas.every((r) => !('justificativa_inaptidao' in r)),
      );
    });
    await check('Cor bloqueada durante escolha', () =>
      call(
        'escalante',
        'patch',
        `/servico/${ordered[0].id}`,
        { tipo_escala: 'ROXA' },
        400,
      ),
    );
    await check('Inapto bloqueado para escalante', () =>
      call(
        'escalante',
        'post',
        '/permuta/administrativa',
        {
          servicoId: ordered[0].id,
          tipoVaga: 'DIA',
          sainteId: null,
          entranteId: actors.inapto.id,
        },
        400,
      ),
    );
    await check('Não escolhe fora do turno', () => {
      const p = plan.find((p) => p.who === 'b');
      return call(
        'b',
        'post',
        '/fila-escolha/registrar-vaga',
        {
          escalaId: id,
          servicoId: p.servicoId,
          tipoVaga: p.tipoVaga,
        },
        400,
      );
    });
    await check('Não finaliza cotas incompletas', () =>
      call('a', 'post', '/fila-escolha/finalizar', { escalaId: id }, 400),
    );
    await check(
      'Não encerra escolhas enquanto houver oficial pendente',
      async () => {
        try {
          await call(
            'escalante',
            'patch',
            `/escala/${id}`,
            { status: 'FECHADA' },
            400,
          );
        } finally {
          if ((await read()).status === 'FECHADA')
            await call('escalante', 'patch', `/escala/${id}`, {
              status: 'ABERTA',
            });
        }
      },
    );
    await check('Passar turno e reivindicar interrompe o próximo', async () => {
      await call('escalante', 'post', `/fila-escolha/passar-turno/${id}`);
      await call('a', 'post', `/fila-escolha/reivindicar/${id}`);
      const q = await queue();
      assert.equal(
        q.progresso.find((r) => r.oficial.id === actors.b.id).status,
        'INTERROMPIDO',
      );
      const current = q.progresso.find((r) => r.status === 'ESCOLHENDO');
      assert.equal(current.observacao, 'REIVINDICACAO');
      const remaining = new Date(current.limite_turno).getTime() - Date.now();
      // MySQL datetime rounds milliseconds; allow up to one second of storage precision.
      assert.ok(
        remaining > 3500000 && remaining <= 3601500,
        `Prazo retornado: ${Math.round(remaining / 60000)} minutos`,
      );
    });
    for (const p of plan.filter((p) => p.who === 'a')) await select(p);
    await call('a', 'post', '/fila-escolha/finalizar', { escalaId: id });
    await check('Finalização retoma oficial interrompido', async () => {
      const q = await queue();
      assert.equal(
        q.progresso.find((r) => r.status === 'ESCOLHENDO').oficial.id,
        actors.b.id,
      );
    });
    const freeDay = ordered.find(
      (s) => !plan.some((p) => p.servicoId === s.id && p.who === 'a'),
    );
    await check('Oficial finalizado não recebe serviço extra', () =>
      call(
        'escalante',
        'post',
        '/permuta/administrativa',
        {
          servicoId: freeDay.id,
          tipoVaga: 'DIA',
          sainteId: null,
          entranteId: actors.a.id,
        },
        400,
      ),
    );
    const origin = ordered[0];
    await check(
      'Ajuste imediato de vaga livre preserva cotas e histórico',
      async () => {
        for (const [from, to] of [
          [origin, freeDay],
          [freeDay, origin],
        ]) {
          await call('a', 'post', '/permuta/ajustar-escolha', {
            servicoOrigemId: from.id,
            tipoVagaOrigem: 'DIA',
            servicoDestinoId: to.id,
            tipoVagaDestino: 'DIA',
          });
        }
        const history = await call('a', 'get', '/permuta');
        assert.equal(
          history.filter(
            (p) => p.criado_por === 'OFICIAL' && p.status === 'ADMINISTRATIVA',
          ).length,
          4,
        );
      },
    );
    for (const p of plan.filter((p) => p.who === 'b')) await select(p);
    await call('b', 'post', '/fila-escolha/finalizar', { escalaId: id });
    await check(
      'Último oficial recebe sobras compatíveis automaticamente',
      async () => {
        const q = await queue();
        assert.ok(q.progresso.every((r) => r.status === 'FINALIZADO'));
        scale = await read();
        assert.ok(
          scale.servicos.every(
            (s) =>
              s.oficial_dia &&
              s.oficial_sobreaviso &&
              s.oficial_dia.id !== s.oficial_sobreaviso.id,
          ),
        );
      },
    );
    await check(
      'Fila concluída ainda protege cotas antes do encerramento',
      () =>
        call(
          'escalante',
          'post',
          '/permuta/administrativa',
          {
            servicoId: origin.id,
            tipoVaga: 'DIA',
            sainteId: actors.a.id,
            entranteId: actors.b.id,
          },
          400,
        ),
    );
    await call('escalante', 'patch', `/escala/${id}`, { status: 'FECHADA' });
    await check(
      'Depois do encerramento altera sem compensar cotas',
      async () => {
        await call('escalante', 'post', '/permuta/administrativa', {
          servicoId: origin.id,
          tipoVaga: 'DIA',
          sainteId: actors.a.id,
          entranteId: actors.c.id,
          justificativa: 'Teste sintético de necessidade operacional',
        });
        await call('escalante', 'post', '/permuta/administrativa', {
          servicoId: origin.id,
          tipoVaga: 'DIA',
          sainteId: actors.c.id,
          entranteId: actors.a.id,
          justificativa: 'Restabelecer cenário sintético',
        });
      },
    );
    await check('Depois do encerramento continua bloqueando inapto', () =>
      call(
        'escalante',
        'post',
        '/permuta/administrativa',
        {
          servicoId: origin.id,
          tipoVaga: 'DIA',
          sainteId: actors.a.id,
          entranteId: actors.inapto.id,
          justificativa: 'Teste sintético',
        },
        400,
      ),
    );
    await check('Depois do encerramento exige justificativa', () =>
      call(
        'escalante',
        'post',
        '/permuta/administrativa',
        {
          servicoId: origin.id,
          tipoVaga: 'DIA',
          sainteId: actors.a.id,
          entranteId: actors.c.id,
        },
        400,
      ),
    );
    await check('Cor liberada depois do encerramento', async () => {
      await call('escalante', 'patch', `/servico/${origin.id}`, {
        tipo_escala: 'ROXA',
      });
      await call('escalante', 'patch', `/servico/${origin.id}`, {
        tipo_escala: 'PRETA',
      });
    });
    async function candidatePair() {
      const data = await read();
      for (const target of data.servicos)
        for (const offer of data.servicos) {
          if (
            target.id !== offer.id &&
            target.tipo_escala === offer.tipo_escala &&
            target.oficial_dia.id !== offer.oficial_dia.id &&
            target.oficial_sobreaviso.id !== offer.oficial_dia.id &&
            offer.oficial_sobreaviso.id !== target.oficial_dia.id
          )
            return { target, offer };
        }
      throw new Error('Cenário sem par válido');
    }
    const nameOf = (person) =>
      Object.keys(actors).find((n) => actors[n].id === person.id);
    await check(
      'Troca vinculada: pedido, aceite e aprovação conjunta',
      async () => {
        const { target, offer } = await candidatePair();
        const who = nameOf(offer.oficial_dia),
          recipient = nameOf(target.oficial_dia);
        const result = await call(who, 'post', '/permuta/solicitar', {
          servicoId: target.id,
          tipoVaga: 'DIA',
          servicoOferecidoId: offer.id,
          tipoVagaOferecida: 'DIA',
        });
        const history = await call(who, 'get', '/permuta');
        const primary = history.find(
          (p) => p.grupo_troca && !p.eh_contrapartida,
        );
        assert.ok(result && primary);
        await call(
          recipient,
          'patch',
          `/permuta/${primary.id}/responder-oficial`,
          { acao: 'SIM' },
        );
        await call('escalante', 'patch', `/permuta/${primary.id}/responder`, {
          acao: 'SIM',
        });
        const changed = await read();
        assert.equal(
          changed.servicos.find((s) => s.id === target.id).oficial_dia.id,
          offer.oficial_dia.id,
        );
        assert.equal(
          changed.servicos.find((s) => s.id === offer.id).oficial_dia.id,
          target.oficial_dia.id,
        );
        const pair = (await call(who, 'get', '/permuta')).filter(
          (p) => p.grupo_troca === primary.grupo_troca,
        );
        assert.equal(pair.length, 2);
        assert.ok(pair.every((p) => p.status === 'APROVADA'));
      },
    );
    await check('Substituição simples: aceite e homologação', async () => {
      const { target, offer } = await candidatePair();
      const who = nameOf(offer.oficial_dia),
        recipient = nameOf(target.oficial_dia);
      const proposal = await call(who, 'post', '/permuta/solicitar', {
        servicoId: target.id,
        tipoVaga: 'DIA',
      });
      await call(
        recipient,
        'patch',
        `/permuta/${proposal.id}/responder-oficial`,
        { acao: 'SIM' },
      );
      await call('escalante', 'patch', `/permuta/${proposal.id}/responder`, {
        acao: 'SIM',
      });
      assert.equal(
        (await read()).servicos.find((s) => s.id === target.id).oficial_dia.id,
        offer.oficial_dia.id,
      );
    });
    await check('Indeferimento exige e preserva motivo', async () => {
      const { target, offer } = await candidatePair();
      const who = nameOf(offer.oficial_dia),
        recipient = nameOf(target.oficial_dia);
      const p = await call(who, 'post', '/permuta/solicitar', {
        servicoId: target.id,
        tipoVaga: 'DIA',
      });
      await call(recipient, 'patch', `/permuta/${p.id}/responder-oficial`, {
        acao: 'SIM',
      });
      await call(
        'escalante',
        'patch',
        `/permuta/${p.id}/responder`,
        { acao: 'NAO' },
        400,
      );
      await call('escalante', 'patch', `/permuta/${p.id}/responder`, {
        acao: 'NAO',
        justificativa: 'Motivo sintético de indeferimento',
      });
      const history = await call(who, 'get', '/permuta');
      assert.equal(
        history.find((h) => h.id === p.id).justificativa,
        'Motivo sintético de indeferimento',
      );
    });
    await check('Relatório consolida 30 dias, 60 vagas e inapto', async () => {
      const report = await call(
        'comandante',
        'get',
        `/relatorios/escalas/${id}`,
      );
      assert.equal(report.resumo.totalDias, 30);
      assert.equal(report.resumo.vagasPreenchidas, 60);
      assert.equal(report.resumo.oficiaisInaptos, 1);
      assert.ok(!JSON.stringify(report).includes('example.invalid'));
    });
    for (const linked of [false, true])
      await check(
        `Homologação ${linked ? 'vinculada' : 'simples'} revalida dupla função depois do aceite`,
        async () => {
          const { target, offer } = await candidatePair();
          const who = nameOf(offer.oficial_dia),
            recipient = nameOf(target.oficial_dia);
          const proposal = await call(who, 'post', '/permuta/solicitar', {
            servicoId: target.id,
            tipoVaga: 'DIA',
            ...(linked
              ? { servicoOferecidoId: offer.id, tipoVagaOferecida: 'DIA' }
              : {}),
          });
          const primary = linked
            ? (await call(who, 'get', '/permuta')).find(
                (p) =>
                  p.grupo_troca &&
                  !p.eh_contrapartida &&
                  p.status === 'PENDENTE_ACORDO',
              )
            : proposal;
          await call(
            recipient,
            'patch',
            `/permuta/${primary.id}/responder-oficial`,
            { acao: 'SIM' },
          );
          await call('escalante', 'post', '/permuta/administrativa', {
            servicoId: target.id,
            tipoVaga: 'SOBREAVISO',
            sainteId: target.oficial_sobreaviso.id,
            entranteId: offer.oficial_dia.id,
            justificativa: 'Mudança sintética entre pedido e aprovação',
          });
          try {
            await call(
              'escalante',
              'patch',
              `/permuta/${primary.id}/responder`,
              { acao: 'SIM' },
              400,
            );
            const after = await read();
            assert.equal(
              after.servicos.find((s) => s.id === target.id).oficial_dia.id,
              target.oficial_dia.id,
            );
            assert.equal(
              (await call(who, 'get', '/permuta')).find(
                (p) => p.id === primary.id,
              ).status,
              'PENDENTE_APROVACAO',
            );
          } finally {
            // Only the disposable fixture is restored here, so following checks remain independent.
            await schema.query(
              'UPDATE servicos SET oficial_dia_id = ?, oficial_sobreaviso_id = ? WHERE id = ?',
              [target.oficial_dia.id, target.oficial_sobreaviso.id, target.id],
            );
          }
        },
      );
    await check('Oficial não acessa relatório administrativo', () =>
      call('a', 'get', `/relatorios/escalas/${id}`, undefined, 403),
    );
    await check('Auditoria atribui ações ao usuário autenticado', async () => {
      const events = await call('master', 'get', '/auditoria');
      assert.ok(Array.isArray(events) && events.length > 0);
      const setupEvent = events.find(
        (e) => e.recurso === 'ESCALA' && e.ator_id === actors.escalante.id,
      );
      assert.ok(setupEvent);
      assert.equal(setupEvent.ator_role, 'ESCALANTE');
      assert.equal(setupEvent.unidade, 'QCG');
      assert.ok(!JSON.stringify(events).includes(password));
    });
    await call('escalante', 'patch', `/escala/${id}`, { status: 'ARQUIVADA' });
    await check(
      'Arquivada bloqueia edição e exclusão inclusive Master',
      async () => {
        await call(
          'master',
          'patch',
          `/escala/${id}`,
          { status: 'ABERTA' },
          400,
        );
        await call('master', 'delete', `/escala/${id}`, undefined, 400);
        await call(
          'master',
          'patch',
          `/servico/${origin.id}`,
          { tipo_escala: 'ROXA' },
          400,
        );
      },
    );
    await check('Arquivada fica visível para administração', async () => {
      const visible = await call('comandante', 'get', '/escala');
      assert.ok(visible.some((s) => s.id === id));
      assert.ok(!(await call('a', 'get', '/escala')).some((s) => s.id === id));
    });
    const {
      FilaEscolha,
    } = require('../dist/fila-escolha/entities/fila-escolha.entity');
    const {
      FilaEscolhaService,
    } = require('../dist/fila-escolha/fila-escolha.service');
    const queueService = app.get(FilaEscolhaService);
    // Drive the scheduler explicitly; only synthetic deadlines in this disposable schema are edited.
    queueService.onModuleDestroy();
    async function prepareYear(year) {
      const data = structuredClone(payload);
      data.escala.ano = year;
      data.escala.servicos.forEach((s) => {
        s.data_servico = s.data_servico.replace('2027', String(year));
      });
      return (await call('escalante', 'post', '/escala/preparar', data)).id;
    }
    const expiryId = await prepareYear(2028);
    const expiryQueue = () =>
      call('master', 'get', `/fila-escolha/status/${expiryId}`);
    const queueRepo = schema.getRepository(FilaEscolha);
    await check('Vencimento comum passa automaticamente a vez', async () => {
      const current = (await expiryQueue()).progresso.find(
        (r) => r.status === 'ESCOLHENDO',
      );
      await queueRepo.update(current.id, {
        limite_turno: new Date(Date.now() - 10000),
      });
      await queueService.processarTurnosVencidos();
      const q = await expiryQueue();
      assert.equal(
        q.progresso.find((r) => r.oficial.id === actors.a.id).status,
        'PULADO',
      );
      assert.equal(
        q.progresso.find((r) => r.status === 'ESCOLHENDO').oficial.id,
        actors.b.id,
      );
    });
    await check(
      'Reivindicação vencida devolve interrompido e manda reivindicante ao fim',
      async () => {
        await call('a', 'post', `/fila-escolha/reivindicar/${expiryId}`);
        const current = (await expiryQueue()).progresso.find(
          (r) => r.status === 'ESCOLHENDO',
        );
        await queueRepo.update(current.id, {
          limite_turno: new Date(Date.now() - 10000),
        });
        await queueService.processarTurnosVencidos();
        const q = await expiryQueue();
        const returned = q.progresso.find((r) => r.oficial.id === actors.a.id);
        assert.equal(returned.observacao, 'RETORNO_FIM_FILA');
        assert.equal(returned.status, 'AGUARDANDO');
        assert.equal(
          returned.posicao,
          Math.max(...q.progresso.map((r) => r.posicao)),
        );
        assert.equal(
          q.progresso.find((r) => r.status === 'ESCOLHENDO').oficial.id,
          actors.b.id,
        );
      },
    );
    await check(
      'Segundo prazo vencido aguarda intervenção manual',
      async () => {
        const q = await expiryQueue();
        for (const r of q.progresso.filter((r) => r.status !== 'FINALIZADO')) {
          await queueRepo.update(r.id, {
            status: r.oficial.id === actors.a.id ? 'ESCOLHENDO' : 'AGUARDANDO',
            limite_turno: new Date(Date.now() - 10000),
          });
        }
        await queueService.processarTurnosVencidos();
        const current = (await expiryQueue()).progresso.find(
          (r) => r.status === 'ESCOLHENDO',
        );
        assert.equal(current.oficial.id, actors.a.id);
        assert.equal(current.observacao, 'RETORNO_FIM_FILA');
        await call(
          'escalante',
          'post',
          '/fila-escolha/finalizar-manualmente',
          { escalaId: expiryId, oficialId: actors.a.id },
          400,
        );
      },
    );
    const manualId = await prepareYear(2029);
    const manualRead = () => call('master', 'get', `/escala/${manualId}`);
    const manualDays = (await manualRead()).servicos.sort((a, b) =>
      a.data_servico.localeCompare(b.data_servico),
    );
    async function manualPlan(who) {
      for (const [i, day] of manualDays.entries())
        for (const [type, occupant] of [
          ['DIA', owner(i % 10)],
          ['SOBREAVISO', owner(((i % 10) + 4) % 10)],
        ]) {
          if (occupant !== who) continue;
          const target =
            who === 'b' && i === 4 && type === 'DIA' ? manualDays[7] : day;
          await call(who, 'post', '/fila-escolha/registrar-vaga', {
            escalaId: manualId,
            servicoId: target.id,
            tipoVaga: type,
          });
        }
      await call(who, 'post', '/fila-escolha/finalizar', {
        escalaId: manualId,
      });
    }
    await manualPlan('a');
    await manualPlan('b');
    await check(
      'Sobras incompatíveis solicitam ajuste do escalante',
      async () => {
        assert.equal((await manualRead()).status, 'PENDENTE_AJUSTE_MANUAL');
        await call(
          'escalante',
          'post',
          '/fila-escolha/finalizar-manualmente',
          { escalaId: manualId, oficialId: actors.c.id },
          400,
        );
      },
    );
    await check(
      'Realocação e conclusão manual resolvem as sobras sem quebrar cotas',
      async () => {
        await call('escalante', 'post', '/permuta/realocar-administrativa', {
          servicoOrigemId: manualDays[7].id,
          servicoDestinoId: manualDays[4].id,
          tipoVaga: 'DIA',
          oficialId: actors.b.id,
        });
        const pending = await manualRead();
        for (const day of pending.servicos)
          for (const [type, field] of [
            ['DIA', 'oficial_dia'],
            ['SOBREAVISO', 'oficial_sobreaviso'],
          ]) {
            if (day[field]) continue;
            await call('escalante', 'post', '/permuta/administrativa', {
              servicoId: day.id,
              tipoVaga: type,
              sainteId: null,
              entranteId: actors.c.id,
            });
          }
        await call('escalante', 'post', '/fila-escolha/finalizar-manualmente', {
          escalaId: manualId,
          oficialId: actors.c.id,
        });
        const complete = await manualRead();
        assert.equal(complete.status, 'ABERTA');
        assert.ok(
          complete.fila_escolhas.every((r) => r.status === 'FINALIZADO'),
        );
        const report = await call(
          'escalante',
          'get',
          `/relatorios/escalas/${manualId}`,
        );
        assert.equal(report.resumo.cotasCumpridas, 3);
      },
    );
    console.log(`RESULT ${checks} aprovados; ${failures.length} falhas.`);
    if (failures.length) process.exitCode = 1;
  } finally {
    if (app) await app.close();
    if (schema?.isInitialized) await schema.destroy();
    if (created) {
      assert.match(database, /^escala_acceptance_\d+_[a-f0-9]{8}$/);
      assert.notEqual(database, originalDatabase);
      await connection.query(`DROP DATABASE \`${database}\``);
      console.log(
        'CLEANUP banco temporário removido; banco original preservado.',
      );
    }
    await connection.end();
  }
}
main().catch((error) => {
  console.error(`FATAL ${error.code || error.name}: ${error.message}`);
  process.exitCode = 1;
});
