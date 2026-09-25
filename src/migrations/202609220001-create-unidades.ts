import { MigrationInterface, QueryRunner, Table } from 'typeorm';

const UNIDADES = [
  ...Array.from({ length: 30 }, (_, indice) => `${indice + 1}º GBM`),
  'QCG',
  'GOPP',
  'GBS',
  'GTSAI',
  'GSFMA',
  'GBRESC',
  'GOA',
];

export class CreateUnidades1790035200000 implements MigrationInterface {
  name = 'CreateUnidades1790035200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('unidades'))) {
      await queryRunner.createTable(
        new Table({
          name: 'unidades',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'sigla', type: 'varchar', length: '30', isUnique: true },
            { name: 'ativo', type: 'boolean', default: true },
          ],
        }),
      );
    }

    for (const sigla of UNIDADES) {
      await queryRunner.query(
        'INSERT IGNORE INTO `unidades` (`sigla`, `ativo`) VALUES (?, true)',
        [sigla],
      );
    }

    await queryRunner.query(
      "UPDATE `oficiais` SET `obm` = 'QCG' WHERE `obm` = 'QG CBMERJ'",
    );
    await queryRunner.query(
      "UPDATE `escalas` SET `obm` = 'QCG' WHERE `obm` = 'QG CBMERJ'",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `oficiais` SET `obm` = 'QG CBMERJ' WHERE `obm` = 'QCG'",
    );
    await queryRunner.query(
      "UPDATE `escalas` SET `obm` = 'QG CBMERJ' WHERE `obm` = 'QCG'",
    );
    if (await queryRunner.hasTable('unidades')) {
      await queryRunner.dropTable('unidades');
    }
  }
}
