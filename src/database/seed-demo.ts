import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import AppDataSource from './data-source';
import { Oficial, Role } from '../oficial/entities/oficial.entity';
import { Unidade } from '../unidade/entities/unidade.entity';

const pesoPosto: Record<string, number> = {
  Coronel: 7,
  'Tenente-Coronel': 6,
  Major: 5,
  Capitão: 4,
  '1º Tenente': 3,
  '2º Tenente': 2,
  Aspirante: 1,
};

const anoBasePromocao: Record<string, number> = {
  Coronel: 2010,
  'Tenente-Coronel': 2014,
  Major: 2016,
  Capitão: 2018,
  '1º Tenente': 2020,
  '2º Tenente': 2022,
  Aspirante: 2025,
};

const perfisDemonstrativos = [
  {
    sufixo: 'comandante',
    nome: 'Comandante Demonstrativo',
    posto: 'Coronel',
    role: Role.ADMINISTRADOR,
    data: '2014-01-01',
  },
  {
    sufixo: 'escalante',
    nome: 'Escalante Demonstrativo',
    posto: 'Major',
    role: Role.ESCALANTE,
    data: '2018-01-01',
  },
  {
    sufixo: 'oficial-01',
    nome: 'Oficial Demonstrativo 01',
    posto: 'Capitão',
    role: Role.OFICIAL,
    data: '2019-01-01',
  },
  {
    sufixo: 'oficial-02',
    nome: 'Oficial Demonstrativo 02',
    posto: '1º Tenente',
    role: Role.OFICIAL,
    data: '2021-01-01',
  },
  {
    sufixo: 'oficial-03',
    nome: 'Oficial Demonstrativo 03',
    posto: '2º Tenente',
    role: Role.OFICIAL,
    data: '2023-01-01',
  },
  {
    sufixo: 'oficial-04',
    nome: 'Oficial Demonstrativo 04',
    posto: 'Aspirante',
    role: Role.OFICIAL,
    data: '2025-01-01',
  },
];

async function executar(): Promise<void> {
  await AppDataSource.initialize();
  let oficiaisCriados = 0;
  let promocoesPreenchidas = 0;

  try {
    await AppDataSource.transaction(async (manager) => {
      const oficialRepository = manager.getRepository(Oficial);
      const unidadeRepository = manager.getRepository(Unidade);
      const unidades = await unidadeRepository.find({
        where: { ativo: true },
        order: { id: 'ASC' },
      });

      const qcg = await oficialRepository.find({ where: { obm: 'QCG' } });
      qcg.sort((a, b) => {
        const posto =
          (pesoPosto[b.posto_graduacao] ?? 0) -
          (pesoPosto[a.posto_graduacao] ?? 0);
        if (posto !== 0) return posto;
        return a.rg.localeCompare(b.rg, 'pt-BR', { numeric: true });
      });
      const indicePorPosto = new Map<string, number>();
      for (const oficial of qcg) {
        const indice = indicePorPosto.get(oficial.posto_graduacao) ?? 0;
        indicePorPosto.set(oficial.posto_graduacao, indice + 1);
        if (!oficial.data_ultima_promocao) {
          const ano =
            (anoBasePromocao[oficial.posto_graduacao] ?? 2020) + indice;
          oficial.data_ultima_promocao = `${ano}-01-01`;
          promocoesPreenchidas += 1;
        }
        if (oficial.role === Role.ADMIN_MASTER) {
          oficial.obm = null;
        }
      }
      await oficialRepository.save(qcg);

      const senhaInacessivel = await bcrypt.hash(
        randomBytes(48).toString('base64url'),
        10,
      );
      for (const unidade of unidades.filter((item) => item.sigla !== 'QCG')) {
        const codigoUnidade = String(unidade.id).padStart(2, '0');
        for (const [indice, perfil] of perfisDemonstrativos.entries()) {
          const email = `demo.u${codigoUnidade}.${perfil.sufixo}@example.invalid`;
          if (await oficialRepository.findOne({ where: { email } })) continue;
          const oficial = oficialRepository.create({
            nome: `${perfil.nome} — ${unidade.sigla}`,
            posto_graduacao: perfil.posto,
            data_ultima_promocao: perfil.data,
            rg: `DEMO-${codigoUnidade}-${String(indice + 1).padStart(2, '0')}`,
            email,
            senha: senhaInacessivel,
            deve_alterar_senha: true,
            versao_autenticacao: 0,
            role: perfil.role,
            ativo: true,
            obm: unidade.sigla,
          });
          await oficialRepository.save(oficial);
          oficiaisCriados += 1;
        }
      }
    });

    console.log(
      `Dados demonstrativos concluídos: ${oficiaisCriados} usuários criados e ${promocoesPreenchidas} datas preenchidas no QCG.`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

executar().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Falha ao criar dados demonstrativos.',
  );
  process.exitCode = 1;
});
