/**
 * Abstraction de paiement — aucune fausse confirmation de paiement.
 *
 * L'interface PaymentProvider définit le contrat d'un futur PSP (Stripe,
 * Paddle, …). Tant qu'aucun fournisseur n'est configuré, les opérations
 * de checkout renvoient 501 NOT_IMPLEMENTED : une souscription « payante »
 * ne peut être activée que par provisionnement (admin plateforme / seed),
 * jamais par un faux succès côté client.
 */
class PaymentProvider {
  /** Ouvre une session de checkout. Retourne une URL de redirection. */
  async createCheckout() {
    throw new Error('NOT_IMPLEMENTED');
  }
  /** Vérifie un webhook (signature) et renvoie l'événement normalisé. */
  async handleWebhook() {
    throw new Error('NOT_IMPLEMENTED');
  }
  /** Annule une souscription chez le fournisseur. */
  async cancelSubscription() {
    throw new Error('NOT_IMPLEMENTED');
  }
  /** Récupère l'état d'une souscription chez le fournisseur. */
  async getSubscription() {
    throw new Error('NOT_IMPLEMENTED');
  }
}

/** Fournisseur par défaut tant qu'aucun PSP n'est branché. */
const NOOP_PROVIDER = Object.freeze({
  id: 'none',
  createCheckout: async () => {
    const e = new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
    e.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw e;
  },
  handleWebhook: async () => {
    const e = new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
    e.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw e;
  },
  cancelSubscription: async () => {
    const e = new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
    e.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw e;
  },
  getSubscription: async () => {
    const e = new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
    e.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw e;
  },
});

/**
 * Sélection du fournisseur selon la config (ex. PAYMENT_PROVIDER=stripe,
 * PAYMENT_STRIPE_SECRET_KEY=...). À ce jour, seuls 'manual' (provisionnement
 * admin) et aucun PSP ne sont disponibles — jamais de faux succès.
 */
function getPaymentProvider() {
  const configured = (process.env.PAYMENT_PROVIDER || 'none').toLowerCase();
  if (configured === 'none' || configured === 'manual') return NOOP_PROVIDER;
  // Point d'extension : instancier le provider réel ici quand il est branché.
  return NOOP_PROVIDER;
}

module.exports = { PaymentProvider, getPaymentProvider, NOOP_PROVIDER };
