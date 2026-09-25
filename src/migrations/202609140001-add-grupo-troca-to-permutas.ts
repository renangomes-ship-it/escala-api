import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGrupoTrocaToPermutas1789344000000 implements MigrationInterface {
  name = 'AddGrupoTrocaToPermutas1789344000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('permutas', 'grupo_troca'))) {
      await queryRunner.query(
        'ALTER TABLE `permutas` ADD `grupo_troca` char(36) NULL',
      );
    }
    if (!(await queryRunner.hasColumn('permutas', 'eh_contrapartida'))) {
      await queryRunner.query(
        'ALTER TABLE `permutas` ADD `eh_contrapartida` tinyint NOT NULL DEFAULT 0',
      );
    }
    const tabela = await queryRunner.getTable('permutas');
    if (!tabela?.indices.some((indice) => indice.name === 'IDX_permutas_grupo_troca')) {
      await queryRunner.query(
        'CREATE INDEX `IDX_permutas_grupo_troca` ON `permutas` (`grupo_troca`)',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable('permutas');
    if (tabela?.indices.some((indice) => indice.name === 'IDX_permutas_grupo_troca')) {
      await queryRunner.query('DROP INDEX `IDX_permutas_grupo_troca` ON `permutas`');
    }
    if (await queryRunner.hasColumn('permutas', 'eh_contrapartida')) {
      await queryRunner.query('ALTER TABLE `permutas` DROP COLUMN `eh_contrapartida`');
    }
    if (await queryRunner.hasColumn('permutas', 'grupo_troca')) {
      await queryRunner.query('ALTER TABLE `permutas` DROP COLUMN `grupo_troca`');
    }
  }
}
