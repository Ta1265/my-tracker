import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

// Reads process.env only, never a file. ignoreEnvFile stops @nestjs/config's own default
// `.env` lookup (relative to process.cwd()), which would otherwise layer a stray `.env`
// on top of Compose's env_file - the only intended source of process.env before Nest boots.
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
