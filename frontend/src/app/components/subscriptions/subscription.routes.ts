import { Routes } from '@angular/router';
import { SubscriptionsOverviewComponent } from './subscriptions-overview.component';
import { SubscriptionsCatalogComponent } from './subscriptions-catalog.component';
import { SubscriptionCheckoutComponent } from './subscription-checkout.component';
import { SubscriptionsLicensesComponent } from './subscriptions-licenses.component';
import { SubscriptionsOrdersComponent } from './subscriptions-orders.component';

/**
 * Portail tenant « Abonnements & Licences » (routes sous /abonnements,
 * gardées par tenantAdminGuard) : vue d'ensemble, catalogue de produits,
 * parcours d'achat (plan → sièges → cycle → récap → commande), gestion
 * des licences et historique de facturation/commandes.
 */
export const SUBSCRIPTION_ROUTES: Routes = [
  { path: '', component: SubscriptionsOverviewComponent },
  { path: 'produits', component: SubscriptionsCatalogComponent, data: { breadcrumb: 'subscriptions.catalog.label' } },
  { path: 'produits/:key', component: SubscriptionCheckoutComponent, data: { breadcrumb: 'subscriptions.checkout' } },
  { path: 'licences', component: SubscriptionsLicensesComponent, data: { breadcrumb: 'subscriptions.licenses.label' } },
  { path: 'commandes', component: SubscriptionsOrdersComponent, data: { breadcrumb: 'subscriptions.orders.label' } },
];
