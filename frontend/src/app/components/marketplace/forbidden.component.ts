import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PlatformService } from '../../services/platform.service';
import { AuthService } from '../../services/auth.service';
import { ProductEntitlement } from '../../models/product.model';

/**
 * A5 — page d'accès refusé CONTEXTUELLE : au lieu d'un refus opaque, elle
 * explique pourquoi l'utilisateur ne peut pas accéder à la ressource :
 *   - produit souscrit mais SANS licence → contacter l'admin tenant ;
 *   - permission manquante → rôle insuffisant ;
 *   - produit non souscrit → marketplace (achat par l'admin tenant).
 * Le backend reste l'autorité — cette page est purement informative.
 */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p class="text-5xl">{{ icon }}</p>
      <h1 class="mt-4 text-2xl font-bold">{{ titleKey | t }}</h1>
      <p class="mt-2 max-w-md text-sm text-muted-foreground">{{ hintKey | t: hintParams }}</p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
        <a routerLink="/workspace" class="btn-primary">{{ 'marketplace.backWorkspace' | t }}</a>
        <a *ngIf="productKey" [routerLink]="['/services', productKey]" class="btn-outline">{{
          'access.viewProduct' | t
        }}</a>
        <a *ngIf="isTenantAdmin && productKey" routerLink="/abonnements/produits" class="btn-outline">{{
          'access.manageSubscriptions' | t
        }}</a>
      </div>
    </div>
  `,
})
export class ForbiddenComponent implements OnInit {
  productKey = '';
  permission = '';
  reason = '';
  titleKey = 'marketplace.forbiddenTitle';
  hintKey = 'marketplace.forbiddenHint';
  hintParams: Record<string, string> = {};
  icon = '🔒';
  isTenantAdmin = false;
  unlicensedEntry: (ProductEntitlement & { reason: string }) | null = null;

  constructor(private route: ActivatedRoute, private platform: PlatformService, private auth: AuthService) {}

  ngOnInit(): void {
    this.productKey = this.route.snapshot.queryParams['product'] || '';
    this.permission = this.route.snapshot.queryParams['permission'] || '';
    this.reason = this.route.snapshot.queryParams['reason'] || '';
    const user = this.auth.getUser();
    this.isTenantAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'PLATFORM_ADMIN';
    this.hintParams = { product: this.productKey, permission: this.permission };

    if (this.reason === 'PERMISSION_DENIED' && this.permission) {
      this.titleKey = 'access.missingPermissionTitle';
      this.hintKey = 'access.missingPermissionHint';
      return;
    }
    if (this.productKey) {
      // Précise le motif réel : souscrit-sans-licence vs non souscrit.
      this.platform.meProducts().subscribe({
        next: (e) => {
          const entry = (e.unlicensed || []).find((p) => p.productKey === this.productKey) || null;
          this.unlicensedEntry = entry;
          if (entry) {
            this.icon = '🎫';
            this.titleKey = 'access.noLicenseTitle';
            this.hintKey = 'access.noLicenseHint';
            this.hintParams = { product: this.productKey };
          } else if (!e.accessibleKeys.includes(this.productKey)) {
            this.icon = '🛒';
            this.titleKey = 'access.notSubscribedTitle';
            this.hintKey = this.isTenantAdmin ? 'access.notSubscribedHintAdmin' : 'access.notSubscribedHint';
            this.hintParams = { product: this.productKey };
          }
        },
        error: () => undefined,
      });
    }
  }
}
