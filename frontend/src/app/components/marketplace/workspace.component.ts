import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PlatformService } from '../../services/platform.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProductInfo } from '../../models/product.model';
import { Entitlements } from '../../models/product.model';

/**
 * « Mes produits » — hub de l'utilisateur connecté : la liste des produits
 * auxquels il a accès (entitlements serveur) + découverte des autres.
 * S'il n'a qu'un produit accessible, redirige vers son application.
 */
@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './workspace.component.html',
})
export class WorkspaceComponent implements OnInit {
  entitlements: Entitlements | null = null;
  catalog: ProductInfo[] = [];
  loading = true;

  constructor(
    private platform: PlatformService,
    private auth: AuthService,
    private router: Router,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.platform.entitlements().subscribe({
      next: (e) => {
        this.entitlements = e;
        this.loading = false;
        if (e && e.accessibleKeys.length === 1) {
          // Un seul produit accessible → redirection directe.
          const key = e.accessibleKeys[0];
          const entry = e.products.find((p) => p.productKey === key);
          if (entry?.route) this.router.navigate([entry.route]);
        }
      },
      error: () => (this.loading = false),
    });
    this.platform.catalog().subscribe((c) => (this.catalog = c));
  }

  myProducts() {
    return this.entitlements?.products.filter((p) => p.licensed) || [];
  }

  discover(): ProductInfo[] {
    const mine = new Set((this.entitlements?.accessibleKeys || []));
    return this.catalog.filter((p) => !mine.has(p.key));
  }
}
