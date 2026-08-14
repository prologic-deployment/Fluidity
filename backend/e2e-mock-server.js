/**
 * Serveur statique + API mockée pour les tests E2E headless des pages
 * publiques SaaS. Sert le build Angular et renvoie le catalogue depuis le
 * registre réel (aucune base de données requise — pages publiques).
 */
const express = require('express');
const path = require('path');
const { publicCatalog } = require('./src/services/saas-entitlements.service');
const { getWorkflow } = require('./src/products/registry');

const app = express();
const DIST = path.join(__dirname, '..', 'frontend', 'dist', 'fluidity');

// API mockée — catalogue réel
app.get('/api/platform/products', (_req, res) => {
  res.json({ products: publicCatalog() });
});
app.get('/api/platform/products/:key/workflow', (req, res) => {
  const wf = getWorkflow(req.params.key);
  res.json({ workflow: wf });
});
app.get('/api/auth/me', (_req, res) => res.status(401).json({ message: 'non authentifié' }));
app.get('/api/platform/me/entitlements', (_req, res) =>
  res.status(401).json({ message: 'non authentifié' })
);

// Fichiers statiques du build
app.use(express.static(DIST));
// SPA fallback : toutes les routes → index.html
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`mock server on :${PORT}`));
