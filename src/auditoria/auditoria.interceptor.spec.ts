import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { Role } from '../oficial/entities/oficial.entity';
import { AuditoriaInterceptor } from './auditoria.interceptor';
import type { AuditoriaService } from './auditoria.service';

describe('AuditoriaInterceptor', () => {
  it('registra a redefinição sem copiar o valor da senha', async () => {
    const registrar = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditoriaInterceptor({
      registrar,
    } as unknown as AuditoriaService);
    const request = {
      method: 'PATCH',
      originalUrl: '/oficial/42',
      params: { id: '42' },
      body: { senha: 'SegredoQueNaoPodeSerCopiado123' },
      user: {
        id: 1,
        nome: 'Administrador Master',
        role: Role.ADMIN_MASTER,
        obm: null,
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => of({ id: 42, obm: 'QCG' }),
    } as CallHandler;

    await lastValueFrom(interceptor.intercept(context, next));

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'REDEFINIU_SENHA',
        recursoId: '42',
        unidade: 'QCG',
        detalhes: { campos: ['senha_temporaria'] },
      }),
    );
    expect(JSON.stringify(registrar.mock.calls)).not.toContain(
      'SegredoQueNaoPodeSerCopiado123',
    );
  });

  it('não registra operações que falham antes de produzir resposta', () => {
    const registrar = jest.fn();
    const interceptor = new AuditoriaInterceptor({
      registrar,
    } as unknown as AuditoriaService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/escala/preparar',
          body: {},
          params: {},
          user: { id: 2, role: Role.ESCALANTE, obm: 'QCG' },
        }),
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () => {
        throw new Error('operação recusada');
      },
    } as CallHandler;

    expect(() => interceptor.intercept(context, next)).toThrow(
      'operação recusada',
    );
    expect(registrar).not.toHaveBeenCalled();
  });
});
