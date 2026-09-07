import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, BeforeInsert } from 'typeorm';
import { Escala } from '../../escala/entities/escala.entity';
import { Oficial } from '../../oficial/entities/oficial.entity';

@Entity('servicos')
export class Servico {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  data_servico: string; 

  @Column({ type: 'varchar', nullable: true })
  tipo_escala: string;
  
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

  @BeforeInsert()
  calcularTipoEscala() {
    // Se o escalante não enviou um tipo manual, calcula automaticamente
    if (!this.tipo_escala && this.data_servico) {
      const data = new Date(this.data_servico + 'T12:00:00Z');
      const diaDaSemana = data.getUTCDay(); // 0 = Domingo, 5 = Sexta, 6 = Sábado

      if (diaDaSemana === 0 || diaDaSemana === 6) {
        this.tipo_escala = 'VERMELHA';
      } else if (diaDaSemana === 5) {
        this.tipo_escala = 'ROXA';
      } else {
        this.tipo_escala = 'PRETA';
      }
    }
  }
}