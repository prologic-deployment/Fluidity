import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { LoginComponent } from './components/login/login.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { ShellComponent } from './components/shell/shell.component';
import { DashboardDemandesComponent } from './components/dashboard-demandes/dashboard-demandes.component';
import { CreateDemandeComponent } from './components/create-demande/create-demande.component';
import { DashboardChangementsComponent } from './components/dashboard-changements/dashboard-changements.component';
import { CreateChangementComponent } from './components/create-changement/create-changement.component';
import { DashboardContratsComponent } from './components/dashboard-contrats/dashboard-contrats.component';
import { CreateContratComponent } from './components/create-contrat/create-contrat.component';
import { DashboardClientsComponent } from './components/dashboard-clients/dashboard-clients.component';
import { CreateClientComponent } from './components/create-client/create-client.component';

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
      { path: 'changements', component: DashboardChangementsComponent },
      { path: 'changements/nouveau', component: CreateChangementComponent },
      { path: 'contrats', component: DashboardContratsComponent },
      { path: 'contrats/nouveau', component: CreateContratComponent, canActivate: [adminGuard] },
      { path: 'clients', component: DashboardClientsComponent },
      { path: 'clients/nouveau', component: CreateClientComponent, canActivate: [adminGuard] },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
