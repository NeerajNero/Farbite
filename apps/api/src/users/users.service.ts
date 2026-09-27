import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UpsertUserResponse } from '@farbite/shared';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly config: ConfigService,
    private readonly usersRepo: UsersRepository,
  ) {}

  /**
   * Sign-in upsert (PLAN.md §7.3): is_admin is recomputed from ADMIN_EMAILS
   * on every sign-in, so removing an email from the env demotes on next login.
   */
  async upsertOnSignIn(input: {
    email: string;
    name?: string | null | undefined;
    image?: string | null | undefined;
  }): Promise<UpsertUserResponse> {
    const adminEmails = this.config.get<string[]>('ADMIN_EMAILS') ?? [];
    const email = input.email.toLowerCase();
    const row = await this.usersRepo.upsertOnSignIn({
      email,
      name: input.name,
      image: input.image,
      isAdmin: adminEmails.includes(email),
    });
    return { id: row.id, is_admin: row.isAdmin };
  }

  isAdmin(userId: string, email: string): Promise<boolean> {
    return this.usersRepo.isAdmin(userId, email);
  }
}
