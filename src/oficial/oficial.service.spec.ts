import { Test, TestingModule } from '@nestjs/testing';
import { OficialService } from './oficial.service';

describe('OficialService', () => {
  let service: OficialService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OficialService],
    }).compile();

    service = module.get<OficialService>(OficialService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
