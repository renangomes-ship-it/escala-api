import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Escala } from '../../escala/entities/escala.entity';
import { Oficial } from '../../oficial/entities/oficial.entity'; // Ajuste o caminho se necessário

export enum StatusFila {
  AGUARDANDO = 'AGUARDANDO',
  ESCOLHENDO = 'ESCOLHENDO',
  FINALIZADO = 'FINALIZADO',
  PULADO = 'PULADO',
}

@Entity('fila_escolha')
export class FilaEscolha {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Escala, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escala_id' })
  escala: Escala;

  @ManyToOne(() => Oficial)
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
}