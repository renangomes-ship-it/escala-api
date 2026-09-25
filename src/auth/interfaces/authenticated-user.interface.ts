import type { Role } from '../../oficial/entities/oficial.entity';

export interface AuthenticatedUser {
  id: number;
  rg: string;
  posto: string;
  nome?: string;
  obm: string | null;
  role: Role;
  deveAlterarSenha?: boolean;
  versaoAutenticacao?: number;
}
