import { Test, TestingModule } from '@nestjs/testing';
import { EscalaController } from './escala.controller';
import { EscalaService } from './escala.service';

describe('EscalaController', () => {
  let controller: EscalaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscalaController],
      providers: [EscalaService],
    }).compile();

    controller = module.get<EscalaController>(EscalaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
