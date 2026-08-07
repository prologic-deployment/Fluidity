const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth.route');
const tenantRoutes = require('./routes/tenant.route');
const userRoutes = require('./routes/user.route');
const demandeRoutes = require('./routes/demande.route');
const changementRoutes = require('./routes/changement.route');
const contratRoutes = require('./routes/contrat.route');
const clientRoutes = require('./routes/client.route');
const uploadRoutes = require('./routes/upload.route');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Fichiers téléversés (pièces jointes, photos de profil), servis statiquement.
// Noms uuid => cache « immutable » sans risque d'obsolescence ; nosniff +
// téléchargement forcé des types exécutables (html/svg) contre le XSS stocké.
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (/\.(html?|svg|xml)$/i.test(filePath)) {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    },
  })
);

// Route de santé : expose aussi l'état de la connexion MongoDB
// (diagnostic immédiat, sans requête bloquée).
app.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res
    .status(dbUp ? 200 : 503)
    .json({ status: dbUp ? 'OK' : 'DEGRADED', db: dbUp ? 'up' : 'down' });
});

// Court-circuit quand la base est indisponible : au lieu de laisser chaque
// requête patienter sur les buffers Mongoose (latence de plusieurs secondes
// puis erreur obscure), l'API répond immédiatement 503 avec un message clair.
app.use('/api', (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      message:
        'Base de données temporairement indisponible. Vérifiez que MongoDB est démarré, puis réessayez.',
    });
    return;
  }
  next();
});

// Routes principales
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes); // Super Admin — administration de la plateforme
app.use('/api/users', userRoutes); // Tenant Admin — gestion des utilisateurs & licences
app.use('/api/demandes', demandeRoutes);
app.use('/api/changements', changementRoutes);
app.use('/api/contrats', contratRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/uploads', uploadRoutes);

module.exports = app;
