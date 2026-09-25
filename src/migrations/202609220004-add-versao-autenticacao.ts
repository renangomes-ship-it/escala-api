import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddVersaoAutenticacao1790046000000 implements MigrationInterface {
  name = 'AddVersaoAutenticacao1790046000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('oficiais', 'versao_autenticacao'))) {
      await queryRunner.addColumn(
        'oficiais',
        new TableColumn({
          name: 'versao_autenticacao',
          type: 'int',
          default: 0,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('oficiais', 'versao_autenticacao')) {
      await queryRunner.dropColumn('oficiais', 'versao_autenticacao');
    }
  }
}
