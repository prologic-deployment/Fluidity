import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, Impersonation, SessionUser } from '../../services/auth.service';
import { TenantBranding } from '../../models/tenant.model';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '../../branding';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { PlatformService } from '../../services/platform.service';
import { ProductEntitlement } from '../../models/product.model';

interface SidebarChild {
  label: string;
  path: string;
}

interface SidebarGroup {
  label: string;
  icon: string; // simple inline-svg key, resolved in template
  children?: SidebarChild[];
  open: boolean;
}

/**
 * Barre latérale du shell.
 *
 * Le modèle de navigation (groupes, utilisateur, tenant, impersonation) est
 * construit UNE FOIS puis reconstruit uniquement quand la session change
 * (connexion, déconnexion, impersonation) via `AuthService.sessionChanged$`.
 *
 * Ne jamais recréer ces structures dans un getter appelé par le template :
 * avec `*ngFor`, une nouvelle identité de tableau à chaque détection de
 * changements force Angular à détruire puis recréer toutes les vues, chaque
 * réattache de listener replanifie un cycle zone.js → boucle infinie de
 * change detection (gel du navigateur, « Script terminated by timeout »).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent implements OnInit, OnDestroy {
  platformName = PLATFORM_NAME;
  platformTagline = PLATFORM_TAGLINE;

  // --- Modèle de vue stable (identités d'objets préservées entre deux CD) ---
  user: SessionUser | null = null;
  tenant: TenantBranding | null = null;
  impersonation: Impersonation | null = null;
  groups: SidebarGroup[] = [];
  /** Produits accessibles (entitlements serveur) — pour le sélecteur de produit. */
  productEntitlements: ProductEntitlement[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private i18n: I18nService,
    private platform: PlatformService
  ) {}

  ngOnInit(): void {
    // BehaviorSubject → émission immédiate : construction initiale du modèle,
    // puis reconstruction uniquement à chaque mutation de session.
    this.auth.sessionChanged$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.refreshModel();
      this.cdr.markForCheck();
    });
    this.i18n.lang$.pipe(takeUntil(this.destroy$)).subscribe(() => this.cdr.markForCheck());
    // Sélecteur de produit : entitlement serveur (jamais de localStorage).
    // L'arrivée des entitlements peut révéler de nouveaux produits → modèle reconstruit.
    this.platform
      .entitlements()
      .pipe(takeUntil(this.destroy$))
      .subscribe((e) => {
        this.productEntitlements = e?.products.filter((p) => p.licensed) || [];
        this.refreshModel();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Accesseurs dérivés du modèle stable (primitifs uniquement) -----------

  get isPlatformAdmin(): boolean {
    return this.user?.role === 'PLATFORM_ADMIN';
  }

  get isTenantAdmin(): boolean {
    return this.user?.role === 'TENANT_ADMIN';
  }

  get isClient(): boolean {
    return this.user?.principalType === 'CLIENT' || this.user?.role === 'CLIENT';
  }

  /** Nom affiché dans l'en-tête workspace (tenant impersonné en priorité). */
  get workspaceName(): string {
    return this.impersonation?.name || this.tenant?.name || PLATFORM_NAME;
  }

  get workspaceInitial(): string {
    return (this.workspaceName || 'P').trim().charAt(0).toUpperCase();
  }

  get isPlatformWorkspace(): boolean {
    return this.isPlatformAdmin && !this.impersonation;
  }

  /** Photo de profil de l'utilisateur (session locale), sinon placeholder initiales. */
  get avatarUrl(): string | null {
    return (this.user as { avatarUrl?: string } | null)?.avatarUrl || null;
  }

  // --- Construction du modèle ----------------------------------------------

  private refreshModel(): void {
    this.user = this.auth.getUser();
    this.tenant = this.auth.getTenant();
    this.impersonation = this.auth.getImpersonation();
    this.groups = this.buildGroups();
  }

  /** Groupes de navigation selon le rôle — le serveur reste l'autorité. */
  private buildGroups(): SidebarGroup[] {
    const groups: SidebarGroup[] = [];

    if (this.isPlatformAdmin) {
      // Sidebar DÉDIÉE à l'administration de la plateforme : jamais les
      // espaces produits des tenants (le Super Admin administre, il ne
      // consomme pas). En impersonation, il retrouve le workspace du tenant.
      groups.push({
        label: 'nav.platformGroup',
        icon: 'grid',
        open: true,
        children: [
          { label: 'platform.dashboard.nav', path: '/plateforme' },
          { label: 'nav.tenants', path: '/plateforme/tenants' },
          { label: 'platform.users.nav', path: '/plateforme/utilisateurs' },
        ],
      });
      groups.push({
        label: 'nav.saasGroup',
        icon: 'card',
        open: true,
        children: [
          { label: 'platform.products.nav', path: '/plateforme/produits' },
          { label: 'platform.orders.nav', path: '/plateforme/demandes' },
          { label: 'platform.subscriptions.nav', path: '/plateforme/abonnements' },
          { label: 'platform.licenses.nav', path: '/plateforme/licences' },
          { label: 'platform.rolesMatrix.nav', path: '/plateforme/licences-roles' },
        ],
      });
      groups.push({
        label: 'nav.monitoringGroup',
        icon: 'activity',
        open: true,
        children: [
          { label: 'platform.notifications.nav', path: '/plateforme/notifications' },
          { label: 'platform.audit.nav', path: '/plateforme/audit' },
          { label: 'platform.roles.nav', path: '/plateforme/roles-permissions' },
        ],
      });
    }

    // Workspace tenant : visible pour tout rôle tenant, ou Super Admin en impersonation
    // NB : « Mon profil » n'est plus ici — accessible via le menu du profil (topbar).
    if (!this.isPlatformAdmin || this.impersonation) {
      // Produit SaaS « Gestion de Projet » — visible si droit serveur (entitlements).
      if (this.platform.canAccess('project_management')) {
        groups.push({
          label: 'nav.projects',
          icon: 'kanban',
          open: true,
          children: [
            { label: 'nav.allProjects', path: '/projets' },
            { label: 'nav.myTasks', path: '/projets/mes-taches' },
          ],
        });
      }

      groups.push({
        label: 'nav.workspace',
        icon: 'grid',
        open: true,
        children: [
          { label: 'nav.tickets', path: '/tickets' },
          { label: 'nav.demandes', path: '/demandes' },
          { label: 'nav.changements', path: '/changements' },
        ],
      });

      if (this.isTenantAdmin || this.isPlatformAdmin) {
        groups.push({
          label: 'nav.subscriptions',
          icon: 'card',
          open: true,
          children: [
            { label: 'subscriptions.overview.nav', path: '/abonnements' },
            { label: 'subscriptions.catalog.label', path: '/abonnements/produits' },
            { label: 'subscriptions.licenses.label', path: '/abonnements/licences' },
            { label: 'subscriptions.orders.label', path: '/abonnements/commandes' },
          ],
        });
      }

      if (this.isTenantAdmin || this.isPlatformAdmin) {
        groups.push({
          label: 'nav.users',
          icon: 'users',
          open: true,
          children: [{ label: 'nav.accounts', path: '/utilisateurs' }],
        });
        groups.push({
          label: 'nav.contrats',
          icon: 'file',
          open: true,
          children: [
            { label: 'nav.allContracts', path: '/contrats' },
            { label: 'nav.newContract', path: '/contrats/nouveau' },
          ],
        });
        groups.push({
          label: 'nav.clients',
          icon: 'users',
          open: true,
          children: [
            { label: 'nav.allClients', path: '/clients' },
            { label: 'nav.newClient', path: '/clients/nouveau' },
          ],
        });
      } else if (!this.isClient) {
        groups.push({
          label: 'nav.contrats',
          icon: 'file',
          open: true,
          children: [{ label: 'nav.allContracts', path: '/contrats' }],
        });
        groups.push({
          label: 'nav.clients',
          icon: 'users',
          open: true,
          children: [{ label: 'nav.allClients', path: '/clients' }],
        });
      }
    }

    return groups;
  }

  // --- Interactions ---------------------------------------------------------

  /** Identités stables pour le diffing ngFor (évite tout re-render inutile). */
  trackGroup(_index: number, group: SidebarGroup): string {
    return group.label;
  }

  trackChild(_index: number, child: SidebarChild): string {
    return child.path;
  }

  toggle(group: SidebarGroup): void {
    group.open = !group.open;
  }

  /** Quitte le mode impersonation et revient au tableau de bord plateforme. */
  quitterImpersonation(): void {
    this.auth.clearImpersonation();
    this.router.navigate(['/plateforme/tenants']);
  }

  roleLabel(): string {
    return this.i18n.t('roles.' + (this.user?.role || 'Utilisateur'));
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  initials(): string {
    const email = this.user?.email || 'U';
    return email.slice(0, 2).toUpperCase();
  }
}
