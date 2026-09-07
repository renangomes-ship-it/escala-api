import { Test, TestingModule } from '@nestjs/testing';
import { FilaEscolhaService } from './fila-escolha.service';

describe('FilaEscolhaService', () => {
  let service: FilaEscolhaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilaEscolhaService],
    }).compile();

    service = module.get<FilaEscolhaService>(FilaEscolhaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
