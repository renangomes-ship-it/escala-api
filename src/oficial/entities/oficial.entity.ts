import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('oficiais')
export class Oficial {
  
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nome!: string;

  @Column() 
  posto_graduacao!: string;

  @Column({ default: true })
  ativo!: boolean;
}