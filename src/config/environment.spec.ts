import {
  getEnvironmentPort,
  getJwtSecret,
  getRequiredEnvironment,
} from './environment';

describe('Configuração de ambiente', () => {
  it('recusa variável obrigatória ausente', () => {
    const anterior = process.env.TEST_REQUIRED_VALUE;
    delete process.env.TEST_REQUIRED_VALUE;
    try {
      expect(() => getRequiredEnvironment('TEST_REQUIRED_VALUE')).toThrow(
        'A variável de ambiente TEST_REQUIRED_VALUE é obrigatória.',
      );
    } finally {
      if (anterior === undefined) delete process.env.TEST_REQUIRED_VALUE;
      else process.env.TEST_REQUIRED_VALUE = anterior;
    }
  });

  it('recusa porta inválida', () => {
    const anterior = process.env.TEST_PORT;
    process.env.TEST_PORT = '70000';
    try {
      expect(() => getEnvironmentPort('TEST_PORT')).toThrow(
        'A variável de ambiente TEST_PORT deve ser uma porta válida.',
      );
    } finally {
      if (anterior === undefined) delete process.env.TEST_PORT;
      else process.env.TEST_PORT = anterior;
    }
  });

  it('recusa segredo JWT curto', () => {
    const anterior = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'curto';
    try {
      expect(() => getJwtSecret()).toThrow(
        'A variável de ambiente JWT_SECRET deve ter pelo menos 32 caracteres.',
      );
    } finally {
      if (anterior === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = anterior;
    }
  });
});
