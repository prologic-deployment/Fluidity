import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { DashboardDemandesComponent } from './components/dashboard-demandes/dashboard-demandes.component';
import { CreateDemandeComponent } from './components/create-demande/create-demande.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'demandes', component: DashboardDemandesComponent, canActivate: [authGuard] },
  { path: 'demandes/nouvelle', component: CreateDemandeComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];
