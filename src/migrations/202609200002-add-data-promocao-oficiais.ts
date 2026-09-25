import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDataPromocaoOficiais1789866000000 implements MigrationInterface {
  name = 'AddDataPromocaoOficiais1789866000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('oficiais', 'data_ultima_promocao'))) {
      await queryRunner.addColumn(
        'oficiais',
        new TableColumn({
          name: 'data_ultima_promocao',
          type: 'date',
          isNullable: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('oficiais', 'data_ultima_promocao')) {
      await queryRunner.dropColumn('oficiais', 'data_ultima_promocao');
    }
  }
}
