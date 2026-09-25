import { CreateUnidades1790035200000 } from './202609220001-create-unidades';

describe('CreateUnidades1790035200000', () => {
  it('cria o catálogo completo e normaliza o QCG', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: jest.fn(),
      query: jest.fn(),
    };

    await new CreateUnidades1790035200000().up(queryRunner as never);

    expect(queryRunner.createTable).toHaveBeenCalledTimes(1);
    const insercoes = queryRunner.query.mock.calls.filter(
      ([sql]) => sql.startsWith('INSERT IGNORE'),
    );
    expect(insercoes).toHaveLength(37);
    expect(insercoes.map(([, parametros]) => parametros[0])).toEqual(
      expect.arrayContaining(['1º GBM', '30º GBM', 'QCG', 'GOPP', 'GBS', 'GTSAI', 'GSFMA', 'GBRESC', 'GOA']),
    );
  });
});
