import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Escala } from '../../escala/entities/escala.entity';
import { Oficial } from '../../oficial/entities/oficial.entity';

export enum StatusFila {
  AGUARDANDO = 'AGUARDANDO',
  ESCOLHENDO = 'ESCOLHENDO',
  FINALIZADO = 'FINALIZADO',
  PULADO = 'PULADO',
  INTERROMPIDO = 'INTERROMPIDO',
}

@Entity('fila_escolha')
@Index('UQ_fila_escala_oficial', ['escala', 'oficial'], { unique: true })
@Index('UQ_fila_escala_posicao', ['escala', 'posicao'], { unique: true })
export class FilaEscolha {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Escala, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'escala_id' })
  escala: Escala;

  @ManyToOne(() => Oficial, { nullable: false })
  @JoinColumn({ name: 'oficial_id' })
  oficial: Oficial;

  @Column({ type: 'int' })
  posicao: number;

  @Column({
    type: 'enum',
    enum: StatusFila,
    default: StatusFila.AGUARDANDO,
  })
  status: StatusFila;

  @Column({ type: 'datetime', nullable: true })
  inicio_turno: Date;

  @Column({ type: 'datetime', nullable: true })
  limite_turno: Date;

  @Column({ type: 'int', default: 0 })
  cota_preta: number;

  @Column({ type: 'int', default: 0 })
  cota_roxa: number;

  @Column({ type: 'int', default: 0 })
  cota_vermelha: number;

  @Column({ nullable: true })
  observacao: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  justificativa_inaptidao: string | null;
}
