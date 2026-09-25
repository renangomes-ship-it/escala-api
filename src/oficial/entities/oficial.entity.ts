import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

// 1. Definimos o Enum com os perfis do sistema
export enum Role {
  ADMIN_MASTER = 'ADMIN_MASTER',
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

  @Column({ type: 'date', nullable: true })
  data_ultima_promocao!: string | null;

  @Column({ unique: true })
  rg!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  senha!: string;

  @Column({ default: false })
  deve_alterar_senha!: boolean;

  @Column({ type: 'int', default: 0 })
  versao_autenticacao!: number;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.OFICIAL, // Todo novo cadastro nasce como oficial por padrão
  })
  role!: Role;

  @Column({ default: true })
  ativo!: boolean;

  @Column({ type: 'varchar', nullable: true })
  obm!: string | null;
}
