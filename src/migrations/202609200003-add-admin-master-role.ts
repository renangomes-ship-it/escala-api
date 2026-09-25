import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminMasterRole1789869600000 implements MigrationInterface {
  name = 'AddAdminMasterRole1789869600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `oficiais` MODIFY `role` enum ('ADMIN_MASTER','ADMINISTRADOR','ESCALANTE','OFICIAL') NOT NULL DEFAULT 'OFICIAL'",
    );
    // Os administradores existentes já possuíam alcance global e preservam esse nível.
    await queryRunner.query(
      "UPDATE `oficiais` SET `role` = 'ADMIN_MASTER' WHERE `role` = 'ADMINISTRADOR'",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `oficiais` SET `role` = 'ADMINISTRADOR' WHERE `role` = 'ADMIN_MASTER'",
    );
    await queryRunner.query(
      "ALTER TABLE `oficiais` MODIFY `role` enum ('ADMINISTRADOR','ESCALANTE','OFICIAL') NOT NULL DEFAULT 'OFICIAL'",
    );
  }
}
