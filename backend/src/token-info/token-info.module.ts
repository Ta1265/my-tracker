import { Module } from '@nestjs/common';
import { TokenInfoController } from './token-info.controller';

@Module({
  controllers: [TokenInfoController],
})
export class TokenInfoModule {}
