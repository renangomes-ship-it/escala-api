import { AddDataPromocaoOficiais1789866000000 } from './202609200002-add-data-promocao-oficiais';

describe('AddDataPromocaoOficiais1789866000000', () => {
  it('adiciona a coluna apenas quando ela ainda não existe', async () => {
    const queryRunner = {
      hasColumn: jest.fn().mockResolvedValue(false),
      addColumn: jest.fn(),
    };

    await new AddDataPromocaoOficiais1789866000000().up(queryRunner as never);

    expect(queryRunner.addColumn).toHaveBeenCalledTimes(1);
    expect(queryRunner.addColumn.mock.calls[0][1]).toMatchObject({
      name: 'data_ultima_promocao',
      type: 'date',
      isNullable: true,
    });
  });
});
