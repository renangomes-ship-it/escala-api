import { Test, TestingModule } from '@nestjs/testing';
import { FilaEscolhaController } from './fila-escolha.controller';
import { FilaEscolhaService } from './fila-escolha.service';

describe('FilaEscolhaController', () => {
  let controller: FilaEscolhaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilaEscolhaController],
      providers: [FilaEscolhaService],
    }).compile();

    controller = module.get<FilaEscolhaController>(FilaEscolhaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
