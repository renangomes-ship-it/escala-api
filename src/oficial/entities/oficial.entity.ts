import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

// 1. Definimos o Enum com os perfis do sistema
export enum Role {
  ADMINISTRADOR = 'ADMINISTRADOR',
  ESCALANTE = 'ESCALANTE',
  OFICIAL = 'OFICIAL',
}

@Entity('oficiais')
export class Oficial {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  nome!: string;

  @Column() 
  posto_graduacao!: string;

  @Column({ unique: true })
  rg!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  senha!: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.OFICIAL, // Todo novo cadastro nasce como oficial por padrão
  })
  role!: Role;

  @Column({ default: true })
  ativo!: boolean;

  @Column({ nullable: true }) // ou false, dependendo se é obrigatório
  obm: string;
}