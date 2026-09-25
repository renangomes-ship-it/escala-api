import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateEscalaDto } from '../escala/dto/create-escala.dto';
import { GerarFilaDto } from '../fila-escolha/dto/gerar-fila.dto';
import { VagaFilaDto } from '../fila-escolha/dto/vaga-fila.dto';

describe('Validação estrita dos contratos HTTP', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validar = (value: unknown, metatype: new () => object) =>
    pipe.transform(value, { type: 'body', metatype, data: '' });

  it('recusa identidade de oficial enviada pelo cliente na escolha', async () => {
    await expect(
      validar(
        {
          escalaId: 1,
          servicoId: 2,
          tipoVaga: 'DIA',
          oficialId: 99,
        },
        VagaFilaDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valida cada item e cada cota na geração da fila', async () => {
    await expect(
      validar(
        {
          dadosFila: [
            {
              oficialId: 3,
              apto: true,
              cotas: { pretas: -1, roxas: 0, vermelhas: 0 },
            },
          ],
        },
        GerarFilaDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa estado da escala definido durante a criação pelo cliente', async () => {
    await expect(
      validar(
        {
          mes: 9,
          ano: 2026,
          obm: 'OBM de Teste',
          status: 'ARQUIVADA',
        },
        CreateEscalaDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
