import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Oficial } from '../../oficial/entities/oficial.entity';
import { Servico } from '../../servico/entities/servico.entity';

export enum StatusPermuta {
  PENDENTE_ACORDO = 'PENDENTE_ACORDO',
  PENDENTE_APROVACAO = 'PENDENTE_APROVACAO', 
  APROVADA = 'APROVADA',
  RECUSADA = 'RECUSADA',
  INDEFERIDA = 'INDEFERIDA',
  ADMINISTRATIVA = 'ADMINISTRATIVA',
}

@Entity('permutas')
export class Permuta {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Servico, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'servico_id' })
  servico: Servico;

  @Column({ type: 'varchar' })
  tipo_vaga: 'DIA' | 'SOBREAVISO';

  @ManyToOne(() => Oficial)
  @JoinColumn({ name: 'oficial_sainte_id' })
  oficial_sainte: Oficial; 

  @ManyToOne(() => Oficial)
  @JoinColumn({ name: 'oficial_entrante_id' })
  oficial_entrante: Oficial; 

  @Column({
    type: 'enum',
    enum: StatusPermuta,
    default: StatusPermuta.PENDENTE_ACORDO,
  })
  status: StatusPermuta;

  @Column({ type: 'text', nullable: true })
  justificativa: string;

  @Column({ type: 'varchar', nullable: true })
  boletim_interno: string;

  @Column({ type: 'varchar', default: 'OFICIAL' })
  criado_por: 'OFICIAL' | 'ESCALANTE';

  @CreateDateColumn()
  data_solicitacao: Date;
}