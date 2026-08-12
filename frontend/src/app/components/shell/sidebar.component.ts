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
  imports: [CommonModule, RouterLink, RouterLinkActive, UrlUploadPipe],
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

  private readonly destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // BehaviorSubject → émission immédiate : construction initiale du modèle,
    // puis reconstruction uniquement à chaque mutation de session.
    this.auth.sessionChanged$.pipe(takeUntil(this.destroy$)).subscribe(() => {
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
      const plateforme: SidebarGroup = {
        label: 'Plateforme',
        icon: 'grid',
        open: true,
        children: [{ label: 'Tenants', path: '/plateforme/tenants' }],
      };
      groups.push(plateforme);
    }

    // Workspace tenant : visible pour tout rôle tenant, ou Super Admin en impersonation
    // NB : « Mon profil » n'est plus ici — accessible via le menu du profil (topbar).
    if (!this.isPlatformAdmin || this.impersonation) {
      groups.push({
        label: 'Espace Services',
        icon: 'grid',
        open: true,
        children: [
          { label: 'Tickets', path: '/tickets' },
          { label: 'Demandes', path: '/demandes' },
          { label: 'Changements', path: '/changements' },
        ],
      });

      if (this.isTenantAdmin || this.isPlatformAdmin) {
        groups.push({
          label: 'Utilisateurs',
          icon: 'users',
          open: true,
          children: [{ label: 'Comptes & licences', path: '/utilisateurs' }],
        });
        groups.push({
          label: 'Contrats',
          icon: 'file',
          open: true,
          children: [
            { label: 'Tous les contrats', path: '/contrats' },
            { label: 'Ouvrir un contrat', path: '/contrats/nouveau' },
          ],
        });
        groups.push({
          label: 'Clients',
          icon: 'users',
          open: true,
          children: [
            { label: 'Tous les clients', path: '/clients' },
            { label: 'Nouveau client', path: '/clients/nouveau' },
          ],
        });
      } else if (!this.isClient) {
        // Rôles internes (Manager / Agent / Observateur) : lecture transverse
        groups.push({
          label: 'Contrats',
          icon: 'file',
          open: true,
          children: [{ label: 'Tous les contrats', path: '/contrats' }],
        });
        groups.push({
          label: 'Clients',
          icon: 'users',
          open: true,
          children: [{ label: 'Tous les clients', path: '/clients' }],
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
    return this.auth.roleLabel(this.user?.role);
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
