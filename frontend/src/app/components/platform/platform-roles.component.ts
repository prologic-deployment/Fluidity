import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { PlatformService } from '../../services/platform.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

interface RoleDef {
  key: string;
  nameKey: string;
  permissions: string[];
}

interface ProductRoles {
  productKey: string;
  nameKey: string;
  status: string;
  available: boolean;
  roles: RoleDef[];
}

/**
 * Rôles & permissions (Super Admin) : rôles PLATEFORME (portée globale) et
 * rôles PRODUIT avec leurs permissions, définis par le registre serveur —
 * jamais codés en dur côté Angular.
 */
@Component({
  selector: 'app-platform-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './platform-roles.component.html',
})
export class PlatformRolesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  catalog: ProductRoles[] = [];
  selectedProduct = '';

  private readonly destroy$ = new Subject<void>();

  constructor(private platform: PlatformService) {}

  ngOnInit(): void {
    this.platform
      .roleCatalog()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.catalog = r as ProductRoles[];
          this.selectedProduct = this.catalog[0]?.productKey || '';
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.roles.loadError';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selected(): ProductRoles | undefined {
    return this.catalog.find((c) => c.productKey === this.selectedProduct);
  }

  /** Rôles plateforme (RBAC interne) — portées décrites en i18n. */
  readonly platformRoles = ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'AGENT', 'VIEWER'];
}
