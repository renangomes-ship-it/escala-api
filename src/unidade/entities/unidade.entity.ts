import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('unidades')
export class Unidade {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 30 })
  sigla!: string;

  @Column({ default: true })
  ativo!: boolean;
}
