import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Escala } from '../../escala/entities/escala.entity';
import { Oficial } from '../../oficial/entities/oficial.entity';

@Entity('servicos')
export class Servico {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  data_servico: string; 

  // N Serviços pertencem a 1 Escala (Capa do processo)
  @ManyToOne(() => Escala, (escala) => escala.servicos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escala_id' })
  escala: Escala;

  // O Oficial da prontidão (Oficial de Dia / Cmt Op)
  @ManyToOne(() => Oficial)
  @JoinColumn({ name: 'oficial_dia_id' })
  oficial_dia: Oficial;

  // O Oficial escalado de Sobreaviso
  @ManyToOne(() => Oficial)
  @JoinColumn({ name: 'oficial_sobreaviso_id' })
  oficial_sobreaviso: Oficial;
}