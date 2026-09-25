import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrityConstraints1789862400000 implements MigrationInterface {
  name = 'AddIntegrityConstraints1789862400000';

  private async tornarObrigatoriaSeNecessario(
    queryRunner: QueryRunner,
    tabela: string,
    coluna: string,
    definicao: string,
  ) {
    const metadata = await queryRunner.getTable(tabela);
    if (metadata?.findColumnByName(coluna)?.isNullable) {
      await queryRunner.query(
        `ALTER TABLE \`${tabela}\` MODIFY \`${coluna}\` ${definicao} NOT NULL`,
      );
    }
  }

  private async tornarOpcionalSeNecessario(
    queryRunner: QueryRunner,
    tabela: string,
    coluna: string,
    definicao: string,
  ) {
    const metadata = await queryRunner.getTable(tabela);
    if (metadata && !metadata.findColumnByName(coluna)?.isNullable) {
      await queryRunner.query(
        `ALTER TABLE \`${tabela}\` MODIFY \`${coluna}\` ${definicao} NULL`,
      );
    }
  }

  private async criarIndiceSeAusente(
    queryRunner: QueryRunner,
    tabela: string,
    indice: string,
    colunas: string,
  ) {
    const metadata = await queryRunner.getTable(tabela);
    if (!metadata?.indices.some((item) => item.name === indice)) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX \`${indice}\` ON \`${tabela}\` (${colunas})`,
      );
    }
  }

  private async removerIndiceSeExistir(
    queryRunner: QueryRunner,
    tabela: string,
    indice: string,
  ) {
    const metadata = await queryRunner.getTable(tabela);
    if (metadata?.indices.some((item) => item.name === indice)) {
      await queryRunner.query(`DROP INDEX \`${indice}\` ON \`${tabela}\``);
    }
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.tornarObrigatoriaSeNecessario(
      queryRunner,
      'servicos',
      'escala_id',
      'int',
    );
    await this.tornarObrigatoriaSeNecessario(
      queryRunner,
      'servicos',
      'tipo_escala',
      'varchar(255)',
    );
    await this.tornarObrigatoriaSeNecessario(
      queryRunner,
      'fila_escolha',
      'escala_id',
      'int',
    );
    await this.tornarObrigatoriaSeNecessario(
      queryRunner,
      'fila_escolha',
      'oficial_id',
      'int',
    );
    await this.tornarObrigatoriaSeNecessario(
      queryRunner,
      'permutas',
      'servico_id',
      'int',
    );

    await this.criarIndiceSeAusente(
      queryRunner,
      'escalas',
      'UQ_escalas_obm_mes_ano',
      '`obm`, `mes`, `ano`',
    );
    await this.criarIndiceSeAusente(
      queryRunner,
      'servicos',
      'UQ_servicos_escala_data',
      '`escala_id`, `data_servico`',
    );
    await this.criarIndiceSeAusente(
      queryRunner,
      'fila_escolha',
      'UQ_fila_escala_oficial',
      '`escala_id`, `oficial_id`',
    );
    await this.criarIndiceSeAusente(
      queryRunner,
      'fila_escolha',
      'UQ_fila_escala_posicao',
      '`escala_id`, `posicao`',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.removerIndiceSeExistir(
      queryRunner,
      'fila_escolha',
      'UQ_fila_escala_posicao',
    );
    await this.removerIndiceSeExistir(
      queryRunner,
      'fila_escolha',
      'UQ_fila_escala_oficial',
    );
    await this.removerIndiceSeExistir(
      queryRunner,
      'servicos',
      'UQ_servicos_escala_data',
    );
    await this.removerIndiceSeExistir(
      queryRunner,
      'escalas',
      'UQ_escalas_obm_mes_ano',
    );

    await this.tornarOpcionalSeNecessario(
      queryRunner,
      'permutas',
      'servico_id',
      'int',
    );
    await this.tornarOpcionalSeNecessario(
      queryRunner,
      'fila_escolha',
      'oficial_id',
      'int',
    );
    await this.tornarOpcionalSeNecessario(
      queryRunner,
      'fila_escolha',
      'escala_id',
      'int',
    );
    await this.tornarOpcionalSeNecessario(
      queryRunner,
      'servicos',
      'tipo_escala',
      'varchar(255)',
    );
    await this.tornarOpcionalSeNecessario(
      queryRunner,
      'servicos',
      'escala_id',
      'int',
    );
  }
}
