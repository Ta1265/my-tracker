import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MySqlDriver } from '@mikro-orm/mysql';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfigService } from '../config/app-config.service';

// No schema-sync option is set, so this module can never run DDL. `driver` is required
// for Nest to resolve the driver-specific EntityManager token.
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      driver: MySqlDriver,
      useFactory: (appConfigService: AppConfigService) => ({
        clientUrl: appConfigService.databaseUrl,
        entities: ['./dist/db/entities'],
        entitiesTs: ['./src/db/entities'],
      }),
    }),
  ],
})
export class DbModule {}
