import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { SessionService } from './auth/session.service.js';
import { BILLING_PROVIDER } from './billing/billing.provider.js';
import { ManualBillingProvider } from './billing/manual.provider.js';
import { AllExceptionsFilter } from './common/errors.js';
import { MailService } from './common/mail.service.js';
import { TxInterceptor } from './common/tx.interceptor.js';
import { CONFIG, loadConfig } from './config.js';
import { DbService } from './db/db.service.js';
import { BillingController } from './modules/billing.controller.js';
import { ChatGateway } from './modules/chat.gateway.js';
import { FilesController } from './modules/files.controller.js';
import { MiscController } from './modules/misc.controller.js';
import { OnboardingController } from './modules/onboarding.controller.js';
import { OrgController, OnboardingCompleteController } from './modules/org.controller.js';
import { PlatformController } from './modules/platform.controller.js';
import { DashboardController, RecordsController } from './modules/records.controller.js';

@Module({
  controllers: [AuthController, OnboardingController, OnboardingCompleteController, OrgController, RecordsController, DashboardController, MiscController, BillingController, FilesController, PlatformController],
  providers: [
    { provide: CONFIG, useFactory: loadConfig },
    { provide: BILLING_PROVIDER, useClass: ManualBillingProvider },
    DbService, SessionService, AuthService, MailService, ChatGateway,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TxInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
