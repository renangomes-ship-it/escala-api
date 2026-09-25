import type { Repository } from 'typeorm';
import { AuditoriaEvento } from './entities/auditoria-evento.entity';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaService', () => {
  it('converte o contrato interno para as colunas persistidas', async () => {
    const entidade = { id: 1 } as AuditoriaEvento;
    const create = jest.fn().mockReturnValue(entidade);
    const save = jest.fn().mockResolvedValue(entidade);
    const service = new AuditoriaService({
      create,
      save,
    } as unknown as Repository<AuditoriaEvento>);

    await service.registrar({
      atorId: 10,
      atorNome: 'Responsável',
      atorRole: 'ADMIN_MASTER',
      atorObm: null,
      unidade: 'QCG',
      acao: 'PREPAROU_ESCALA',
      recurso: 'ESCALA',
      recursoId: '13',
      descricao: 'Preparou uma escala.',
      detalhes: { mes: 10, ano: 2026 },
    });

    expect(create).toHaveBeenCalledWith({
      ator_id: 10,
      ator_nome: 'Responsável',
      ator_role: 'ADMIN_MASTER',
      ator_obm: null,
      unidade: 'QCG',
      acao: 'PREPAROU_ESCALA',
      recurso: 'ESCALA',
      recurso_id: '13',
      descricao: 'Preparou uma escala.',
      detalhes: { mes: 10, ano: 2026 },
    });
    expect(save).toHaveBeenCalledWith(entidade);
  });
});
