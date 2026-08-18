import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

// Reads process.env only, never a file. ignoreEnvFile stops @nestjs/config's own
// default `.env` lookup (relative to process.cwd()) - without it, ConfigModule would
// silently read a `.env` file if one exists, on top of Compose's env_file (Docker) and
// Node's --env-file flags in backend/package.json's scripts (host dev), which are the
// only intended sources of process.env before Nest boots.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: false,
      ignoreEnvFile: true,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
