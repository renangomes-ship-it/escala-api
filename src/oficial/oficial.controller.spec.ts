import { Test, TestingModule } from '@nestjs/testing';
import { OficialController } from './oficial.controller';
import { OficialService } from './oficial.service';

describe('OficialController', () => {
  let controller: OficialController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OficialController],
      providers: [OficialService],
    }).compile();

    controller = module.get<OficialController>(OficialController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
