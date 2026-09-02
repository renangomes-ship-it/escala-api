import { Test, TestingModule } from '@nestjs/testing';
import { EscalaService } from './escala.service';

describe('EscalaService', () => {
  let service: EscalaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EscalaService],
    }).compile();

    service = module.get<EscalaService>(EscalaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
