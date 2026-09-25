import { AddAdminMasterRole1789869600000 } from './202609200003-add-admin-master-role';

describe('AddAdminMasterRole1789869600000', () => {
  it('amplia o enum antes de preservar administradores existentes como masters', async () => {
    const queryRunner = { query: jest.fn() };

    await new AddAdminMasterRole1789869600000().up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
    expect(queryRunner.query.mock.calls[0][0]).toContain('ADMIN_MASTER');
    expect(queryRunner.query.mock.calls[1][0]).toContain("SET `role` = 'ADMIN_MASTER'");
  });
});
