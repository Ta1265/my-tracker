import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TokenInfoController } from './token-info.controller';

@Module({
  imports: [AuthModule],
  controllers: [TokenInfoController],
})
export class TokenInfoModule {}
