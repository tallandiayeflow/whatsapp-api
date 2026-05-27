import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionWebhookConfig1800000000000 implements MigrationInterface {
  name = 'AddSessionWebhookConfig1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    const hasTable = await queryRunner.hasTable('sessions');
    if (!hasTable) return;

    const hasWebhookUrl = await queryRunner.hasColumn('sessions', 'webhookUrl');
    if (!hasWebhookUrl) {
      await queryRunner.query(
        `ALTER TABLE "sessions" ADD COLUMN "webhookUrl" ${isPostgres ? 'varchar(2048)' : 'varchar(2048)'} NULL`,
      );
    }

    const hasWebhookEvents = await queryRunner.hasColumn('sessions', 'webhookEvents');
    if (!hasWebhookEvents) {
      await queryRunner.query(
        `ALTER TABLE "sessions" ADD COLUMN "webhookEvents" ${isPostgres ? 'jsonb' : 'text'} NULL`,
      );
    }

    const hasWebhookSecret = await queryRunner.hasColumn('sessions', 'webhookSecret');
    if (!hasWebhookSecret) {
      await queryRunner.query(`ALTER TABLE "sessions" ADD COLUMN "webhookSecret" varchar(255) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('sessions');
    if (!hasTable) return;

    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "webhookSecret"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "webhookEvents"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN IF EXISTS "webhookUrl"`);
  }
}
