import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('auditoria_eventos')
@Index('IDX_auditoria_eventos_data', ['criado_em'])
@Index('IDX_auditoria_eventos_unidade', ['unidade'])
@Index('IDX_auditoria_eventos_acao', ['acao'])
export class AuditoriaEvento {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: 'datetime' })
  criado_em!: Date;

  @Column({ type: 'int', nullable: true })
  ator_id!: number | null;

  @Column({ length: 180 })
  ator_nome!: string;

  @Column({ length: 40 })
  ator_role!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  ator_obm!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unidade!: string | null;

  @Column({ length: 80 })
  acao!: string;

  @Column({ length: 60 })
  recurso!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  recurso_id!: string | null;

  @Column({ length: 500 })
  descricao!: string;

  @Column({ type: 'simple-json', nullable: true })
  detalhes!: Record<string, unknown> | null;
}
