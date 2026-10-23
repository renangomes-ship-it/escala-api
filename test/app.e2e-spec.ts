import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

// The child creates its disposable schema before importing AppModule.
// Importing AppModule here would load the normal database configuration.
describe('Aceitação HTTP com MySQL isolado', () => {
  it('executa o ciclo completo e remove somente o banco temporário', async () => {
    const { stdout } = await execute(
      process.execPath,
      ['test/acceptance.cjs'],
      {
        cwd: resolve(__dirname, '..'),
        timeout: 90_000,
        maxBuffer: 1024 * 1024,
      },
    );
    expect(stdout).toMatch(/RESULT \d+ aprovados; 0 falhas\./);
    expect(stdout).toContain('CLEANUP banco temporário removido');
    console.info(stdout.trim());
  }, 100_000);
});
