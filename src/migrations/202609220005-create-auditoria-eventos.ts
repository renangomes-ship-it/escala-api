import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAuditoriaEventos1790049600000 implements MigrationInterface {
  name = 'CreateAuditoriaEventos1790049600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('auditoria_eventos')) return;

    await queryRunner.createTable(
      new Table({
        name: 'auditoria_eventos',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'criado_em', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'ator_id', type: 'int', isNullable: true },
          { name: 'ator_nome', type: 'varchar', length: '180' },
          { name: 'ator_role', type: 'varchar', length: '40' },
          { name: 'ator_obm', type: 'varchar', length: '30', isNullable: true },
          { name: 'unidade', type: 'varchar', length: '30', isNullable: true },
          { name: 'acao', type: 'varchar', length: '80' },
          { name: 'recurso', type: 'varchar', length: '60' },
          {
            name: 'recurso_id',
            type: 'varchar',
            length: '80',
            isNullable: true,
          },
          { name: 'descricao', type: 'varchar', length: '500' },
          { name: 'detalhes', type: 'text', isNullable: true },
        ],
        indices: [
          { name: 'IDX_auditoria_eventos_data', columnNames: ['criado_em'] },
          { name: 'IDX_auditoria_eventos_unidade', columnNames: ['unidade'] },
          { name: 'IDX_auditoria_eventos_acao', columnNames: ['acao'] },
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('auditoria_eventos')) {
      await queryRunner.dropTable('auditoria_eventos');
    }
  }
}
