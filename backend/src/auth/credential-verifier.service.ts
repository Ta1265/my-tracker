import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import bcrypt from 'bcrypt';
import { User } from '../db/entities/user.entity';

@Injectable()
export class CredentialVerifierService {
  private readonly logger = new Logger(CredentialVerifierService.name);

  constructor(private readonly em: EntityManager) {}

  async verify(username: string, password: string): Promise<User | null> {
    const user = await this.em
      .getRepository(User)
      .findOne({ username: username.toLowerCase() })
      .catch((error: unknown) => {
        this.logger.error({ message: 'Auth Error', error });
        return null;
      });

    if (!user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      this.logger.warn({ message: 'Invalid password attempt', username: user.username });
      return null;
    }

    return user;
  }
}
