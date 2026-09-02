import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Servico } from '../../servico/entities/servico.entity';

@Entity('escalas')
export class Escala {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  mes: number; 

  @Column()
  ano: number; 

  @Column()
  obm: string;

  @Column({ default: 'Rascunho' })
  status: string;

  @Column({ nullable: true })
  boletim_interno: string; 

  // 1 Escala tem N Serviços
  @OneToMany(() => Servico, (servico) => servico.escala)
  servicos: Servico[];
}