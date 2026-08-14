import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { platformGuard } from './guards/platform.guard';
import { tenantAdminGuard } from './guards/tenant-admin.guard';
import { productAccessGuard, productPermissionGuard } from './guards/product-access.guard';
import { LoginComponent } from './components/login/login.component';
import { TwoFactorVerifyComponent } from './components/two-factor-verify/two-factor-verify.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { ShellComponent } from './components/shell/shell.component';
import { LandingComponent } from './components/marketplace/landing.component';
import { ServicesComponent } from './components/marketplace/services.component';
import { ServiceDetailComponent } from './components/marketplace/service-detail.component';
import { PricingComponent } from './components/marketplace/pricing.component';
import { WorkspaceComponent } from './components/marketplace/workspace.component';
import { ForbiddenComponent } from './components/marketplace/forbidden.component';
import { DashboardDemandesComponent } from './components/dashboard-demandes/dashboard-demandes.component';
import { CreateDemandeComponent } from './components/create-demande/create-demande.component';
import { DashboardChangementsComponent } from './components/dashboard-changements/dashboard-changements.component';
import { CreateChangementComponent } from './components/create-changement/create-changement.component';
import { DashboardTicketsComponent } from './components/dashboard-tickets/dashboard-tickets.component';
import { CreateTicketComponent } from './components/create-ticket/create-ticket.component';
import { TicketDetailsComponent } from './components/ticket-details/ticket-details.component';
import { DashboardContratsComponent } from './components/dashboard-contrats/dashboard-contrats.component';
import { CreateContratComponent } from './components/create-contrat/create-contrat.component';
import { DashboardClientsComponent } from './components/dashboard-clients/dashboard-clients.component';
import { CreateClientComponent } from './components/create-client/create-client.component';
import { PlatformTenantsComponent } from './components/platform-tenants/platform-tenants.component';
import { UsersDashboardComponent } from './components/users-dashboard/users-dashboard.component';
import { ProfilComponent } from './components/profil/profil.component';
import { SecurityPageComponent } from './components/security/security-page.component';
import { SaasAdminComponent } from './components/saas-admin/saas-admin.component';

/**
 * Routes de la plateforme SaaS :
 *  - publiques : landing (/), services (/services, /services/:key), tarifs
 *    (/pricing), login, 2FA, reset ;
 *  - authentifiées (shell) : workspace (mes produits), module ServiceDesk
 *    existant (demandes, changements, tickets, contrats, clients…), admin
 *    plateforme (tenants + SaaS) ;
 *  - /apps/:productKey : placeholder module des futurs produits — protégé
 *    par productAccessGuard (droit calculé côté serveur).
 */
export const routes: Routes = [
  // ---- Marketplace public ----
  { path: '', component: LandingComponent },
  { path: 'services', component: ServicesComponent },
  { path: 'services/:key', component: ServiceDetailComponent },
  { path: 'pricing', component: PricingComponent },
  { path: 'forbidden', component: ForbiddenComponent },
  { path: 'login', component: LoginComponent },
  { path: 'login/verification', component: TwoFactorVerifyComponent },
  { path: 'reset-password', component: ResetPasswordComponent },

  // ---- Application authentifiée ----
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      // Hub « Mes produits » (redirige vers l'unique produit si nécessaire)
      { path: 'workspace', component: WorkspaceComponent, data: { breadcrumb: 'marketplace.myProducts' } },

      // Placeholder module des produits (COMING SOON) — garde d'accès produit
      {
        path: 'apps/:productKey',
        canActivate: [productAccessGuard],
        loadComponent: () =>
          import('./components/marketplace/product-placeholder.component').then((m) => m.ProductPlaceholderComponent),
        data: { breadcrumb: 'marketplace.comingSoonTag' },
      },

      // ---- Module ServiceDesk (produit existant) ----
      {
        path: 'tickets',
        data: { breadcrumb: 'nav.tickets', productKey: 'servicedesk' },
        canActivate: [productAccessGuard],
        children: [
          { path: '', component: DashboardTicketsComponent },
          { path: 'nouveau', component: CreateTicketComponent, data: { breadcrumb: 'tickets.new' } },
          { path: ':id/modifier', component: CreateTicketComponent, data: { breadcrumb: 'tickets.edit' } },
          { path: ':id', component: TicketDetailsComponent, data: { breadcrumb: 'common.details' } },
        ],
      },
      {
        path: 'demandes',
        data: { breadcrumb: 'nav.demandes', productKey: 'servicedesk' },
        canActivate: [productAccessGuard],
        children: [
          { path: '', component: DashboardDemandesComponent },
          { path: 'nouvelle', component: CreateDemandeComponent, data: { breadcrumb: 'demandes.new' } },
        ],
      },
      {
        path: 'changements',
        data: { breadcrumb: 'nav.changements', productKey: 'servicedesk' },
        canActivate: [productAccessGuard],
        children: [
          { path: '', component: DashboardChangementsComponent },
          { path: 'nouveau', component: CreateChangementComponent, data: { breadcrumb: 'changements.new' } },
        ],
      },
      {
        path: 'contrats',
        data: { breadcrumb: 'nav.contrats', productKey: 'servicedesk' },
        canActivate: [productAccessGuard],
        children: [
          { path: '', component: DashboardContratsComponent },
          { path: 'nouveau', component: CreateContratComponent, canActivate: [adminGuard], data: { breadcrumb: 'contracts.new' } },
        ],
      },
      {
        path: 'clients',
        data: { breadcrumb: 'nav.clients', productKey: 'servicedesk' },
        canActivate: [productAccessGuard],
        children: [
          { path: '', component: DashboardClientsComponent },
          { path: 'nouveau', component: CreateClientComponent, canActivate: [adminGuard], data: { breadcrumb: 'clients.new' } },
        ],
      },
      {
        path: 'plateforme',
        data: { breadcrumb: 'nav.platform' },
        children: [
          { path: 'tenants', component: PlatformTenantsComponent, canActivate: [platformGuard], data: { breadcrumb: 'nav.tenants' } },
          // Administration SaaS (produits, souscriptions, licences, rôles, audit)
          { path: 'saas', component: SaasAdminComponent, canActivate: [platformGuard], data: { breadcrumb: 'nav.saas' } },
        ],
      },
      { path: 'utilisateurs', component: UsersDashboardComponent, canActivate: [tenantAdminGuard], data: { breadcrumb: 'nav.users' } },
      {
        path: 'profile',
        data: { breadcrumb: 'nav.profile' },
        children: [
          { path: '', component: ProfilComponent },
          { path: 'security', component: SecurityPageComponent, data: { breadcrumb: 'nav.security' } },
        ],
      },
      { path: 'profil', redirectTo: 'profile' },
    ],
  },
  { path: '**', redirectTo: '' },
];
