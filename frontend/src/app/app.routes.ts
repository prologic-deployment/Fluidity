import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { platformGuard } from './guards/platform.guard';
import { tenantAdminGuard } from './guards/tenant-admin.guard';
import { LoginComponent } from './components/login/login.component';
import { TwoFactorVerifyComponent } from './components/two-factor-verify/two-factor-verify.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { ShellComponent } from './components/shell/shell.component';
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

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'login/verification', component: TwoFactorVerifyComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    // Arborescence imbriquée : chaque segment porte son libellé de fil
    // d'Ariane (data.breadcrumb) consommé par <app-breadcrumb>.
    children: [
      {
        path: 'tickets',
        data: { breadcrumb: 'Tickets' },
        children: [
          { path: '', component: DashboardTicketsComponent },
          { path: 'nouveau', component: CreateTicketComponent, data: { breadcrumb: 'Nouveau ticket' } },
          { path: ':id', component: TicketDetailsComponent, data: { breadcrumb: 'Détail' } },
        ],
      },
      {
        path: 'demandes',
        data: { breadcrumb: 'Demandes' },
        children: [
          { path: '', component: DashboardDemandesComponent },
          { path: 'nouvelle', component: CreateDemandeComponent, data: { breadcrumb: 'Nouvelle demande' } },
        ],
      },
      {
        path: 'changements',
        data: { breadcrumb: 'Changements' },
        children: [
          { path: '', component: DashboardChangementsComponent },
          { path: 'nouveau', component: CreateChangementComponent, data: { breadcrumb: 'Nouveau changement' } },
        ],
      },
      {
        path: 'contrats',
        data: { breadcrumb: 'Contrats' },
        children: [
          { path: '', component: DashboardContratsComponent },
          { path: 'nouveau', component: CreateContratComponent, canActivate: [adminGuard], data: { breadcrumb: 'Nouveau contrat' } },
        ],
      },
      {
        path: 'clients',
        data: { breadcrumb: 'Clients' },
        children: [
          { path: '', component: DashboardClientsComponent },
          { path: 'nouveau', component: CreateClientComponent, canActivate: [adminGuard], data: { breadcrumb: 'Nouveau client' } },
        ],
      },
      {
        path: 'plateforme',
        data: { breadcrumb: 'Plateforme' },
        children: [
          { path: 'tenants', component: PlatformTenantsComponent, canActivate: [platformGuard], data: { breadcrumb: 'Tenants' } },
        ],
      },
      { path: 'utilisateurs', component: UsersDashboardComponent, canActivate: [tenantAdminGuard], data: { breadcrumb: 'Utilisateurs' } },
      // Profil : /profile est la route canonique ; /profil (historique) redirige dessus
      {
        path: 'profile',
        data: { breadcrumb: 'Mon profil' },
        children: [
          { path: '', component: ProfilComponent },
          { path: 'security', component: SecurityPageComponent, data: { breadcrumb: 'Sécurité' } },
        ],
      },
      { path: 'profil', redirectTo: 'profile' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
