import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddJustificativaInaptidao1790038800000 implements MigrationInterface {
  name = 'AddJustificativaInaptidao1790038800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasColumn('fila_escolha', 'justificativa_inaptidao'))
    ) {
      await queryRunner.addColumn(
        'fila_escolha',
        new TableColumn({
          name: 'justificativa_inaptidao',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasColumn('fila_escolha', 'justificativa_inaptidao')
    ) {
      await queryRunner.dropColumn('fila_escolha', 'justificativa_inaptidao');
    }
  }
}
