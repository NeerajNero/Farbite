import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminSettings, PaymentProvider } from '@farbite/shared';
import { AdminGuard } from '../../common/guards/admin.guard.js';

// PLAN.md §9.10 — read-only env display so the founder can confirm prod config.
// Secrets (keys, DATABASE_URL) are deliberately not exposed.
@Controller('admin/settings')
@UseGuards(AdminGuard)
export class SettingsController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  settings(): AdminSettings {
    return {
      payment_provider:
        this.config.get<PaymentProvider>('PAYMENT_PROVIDER') ?? 'manual_upi',
      upi_vpa: this.config.get<string>('UPI_VPA') ?? null,
      upi_payee_name: this.config.get<string>('UPI_PAYEE_NAME') ?? null,
      admin_emails: this.config.get<string[]>('ADMIN_EMAILS') ?? [],
      order_expiry_minutes:
        this.config.get<number>('ORDER_EXPIRY_MINUTES') ?? 45,
      app_base_url: this.config.get<string>('APP_BASE_URL') ?? null,
      support_whatsapp: this.config.get<string>('SUPPORT_WHATSAPP') ?? null,
    };
  }
}
