import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTrocaSenhaObrigatoria1790042400000 implements MigrationInterface {
  name = 'AddTrocaSenhaObrigatoria1790042400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('oficiais', 'deve_alterar_senha'))) {
      await queryRunner.addColumn(
        'oficiais',
        new TableColumn({
          name: 'deve_alterar_senha',
          type: 'boolean',
          default: false,
        }),
      );
    }
    await queryRunner.query(
      "UPDATE `oficiais` SET `deve_alterar_senha` = true WHERE `email` LIKE 'demo.%@example.invalid'",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('oficiais', 'deve_alterar_senha')) {
      await queryRunner.dropColumn('oficiais', 'deve_alterar_senha');
    }
  }
}
