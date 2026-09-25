import { AddIntegrityConstraints1789862400000 } from './202609200001-add-integrity-constraints';

describe('AddIntegrityConstraints1789862400000', () => {
  it('prepara vínculos obrigatórios e os quatro índices únicos', async () => {
    const queryRunner = {
      getTable: jest.fn().mockResolvedValue({
        indices: [],
        findColumnByName: jest.fn(() => ({ isNullable: true })),
      }),
      query: jest.fn(),
    };

    await new AddIntegrityConstraints1789862400000().up(queryRunner as never);

    const comandos = queryRunner.query.mock.calls.map(([sql]) => sql);
    expect(comandos.filter((sql) => sql.startsWith('ALTER TABLE'))).toHaveLength(5);
    expect(comandos.filter((sql) => sql.startsWith('CREATE UNIQUE INDEX'))).toEqual([
      expect.stringContaining('UQ_escalas_obm_mes_ano'),
      expect.stringContaining('UQ_servicos_escala_data'),
      expect.stringContaining('UQ_fila_escala_oficial'),
      expect.stringContaining('UQ_fila_escala_posicao'),
    ]);
  });

  it('não repete alterações já aplicadas', async () => {
    const queryRunner = {
      getTable: jest.fn().mockResolvedValue({
        indices: [
          { name: 'UQ_escalas_obm_mes_ano' },
          { name: 'UQ_servicos_escala_data' },
          { name: 'UQ_fila_escala_oficial' },
          { name: 'UQ_fila_escala_posicao' },
        ],
        findColumnByName: jest.fn(() => ({ isNullable: false })),
      }),
      query: jest.fn(),
    };

    await new AddIntegrityConstraints1789862400000().up(queryRunner as never);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
