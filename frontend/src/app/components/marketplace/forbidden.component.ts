import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p class="text-5xl">🔒</p>
      <h1 class="mt-4 text-2xl font-bold">{{ 'marketplace.forbiddenTitle' | t }}</h1>
      <p class="mt-2 max-w-md text-sm text-muted-foreground">{{ 'marketplace.forbiddenHint' | t }}</p>
      <a routerLink="/workspace" class="btn-primary mt-6">{{ 'marketplace.backWorkspace' | t }}</a>
    </div>
  `,
})
export class ForbiddenComponent {}
