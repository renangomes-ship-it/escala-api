import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export function getRequiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  }
  return value;
}

export function getOptionalEnvironment(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function getEnvironmentPort(name: string, fallback?: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue && fallback !== undefined) return fallback;
  if (!rawValue) throw new Error(`A variável de ambiente ${name} é obrigatória.`);

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`A variável de ambiente ${name} deve ser uma porta válida.`);
  }
  return value;
}

export function getJwtSecret(): string {
  const secret = getRequiredEnvironment('JWT_SECRET');
  if (secret.length < 32) {
    throw new Error('A variável de ambiente JWT_SECRET deve ter pelo menos 32 caracteres.');
  }
  return secret;
}
