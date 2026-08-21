import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { LoginComponent } from './components/login/login.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { ShellComponent } from './components/shell/shell.component';
import { DashboardDemandesComponent } from './components/dashboard-demandes/dashboard-demandes.component';
import { CreateDemandeComponent } from './components/create-demande/create-demande.component';
import { DemandeDetailsComponent } from './components/demande-details/demande-details.component';
import { DashboardChangementsComponent } from './components/dashboard-changements/dashboard-changements.component';
import { CreateChangementComponent } from './components/create-changement/create-changement.component';
import { ChangementDetailsComponent } from './components/changement-details/changement-details.component';
import { DashboardContratsComponent } from './components/dashboard-contrats/dashboard-contrats.component';
import { CreateContratComponent } from './components/create-contrat/create-contrat.component';
import { DashboardClientsComponent } from './components/dashboard-clients/dashboard-clients.component';
import { CreateClientComponent } from './components/create-client/create-client.component';
import { DashboardTicketsComponent } from './components/dashboard-tickets/dashboard-tickets.component';
import { CreateTicketComponent } from './components/create-ticket/create-ticket.component';
import { TicketDetailsComponent } from './components/ticket-details/ticket-details.component';
import { ProfilComponent } from './components/profil/profil.component';
import { SecurityPageComponent } from './components/security/security-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'demandes', component: DashboardDemandesComponent },
      { path: 'demandes/nouvelle', component: CreateDemandeComponent },
      { path: 'demandes/:id', component: DemandeDetailsComponent },
      { path: 'changements', component: DashboardChangementsComponent },
      { path: 'changements/nouveau', component: CreateChangementComponent },
      { path: 'changements/:id', component: ChangementDetailsComponent },
      { path: 'tickets', component: DashboardTicketsComponent },
      { path: 'tickets/nouveau', component: CreateTicketComponent },
      { path: 'tickets/:id/modifier', component: CreateTicketComponent },
      { path: 'tickets/:id', component: TicketDetailsComponent },
      { path: 'contrats', component: DashboardContratsComponent },
      { path: 'contrats/nouveau', component: CreateContratComponent, canActivate: [adminGuard] },
      { path: 'clients', component: DashboardClientsComponent },
      { path: 'clients/nouveau', component: CreateClientComponent, canActivate: [adminGuard] },
      { path: 'profil', component: ProfilComponent },
      { path: 'securite', component: SecurityPageComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
