const path = require('path');
const express = require('express');
// API-001 (audit) : doit être chargé AVANT toute déclaration de route —
// rejets async des gestionnaires transmis au gestionnaire d'erreurs global.
require('./utils/async-errors.util');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { randomUUID } = require('crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const logger = require('./utils/logger.util');
const authRoutes = require('./routes/auth.route');
const tenantRoutes = require('./routes/tenant.route');
const userRoutes = require('./routes/user.route');
const demandeRoutes = require('./routes/demande.route');
const changementRoutes = require('./routes/changement.route');
const contratRoutes = require('./routes/contrat.route');
const clientRoutes = require('./routes/client.route');
const uploadRoutes = require('./routes/upload.route');
const ticketRoutes = require('./routes/ticket.route');
const platformRoutes = require('./routes/platform.route');
const projectRoutes = require('./routes/project.route');

dotenv.config();

const app = express();

// INJ-001 (audit) : parseur de query string « simple » — Express ne génère
// jamais d'objets imbriqués depuis l'URL (?filter[$gt]=…), ce qui neutralise
// l'injection d'opérateurs Mongo par query string.
app.set('query parser', 'simple');

// LOG-002 / ARCH-003 (audit) : nombre de proxies de confiance devant l'API.
// Indispensable pour que req.ip reflète le VRAI client (X-Forwarded-For n'est
// lu que sur `trust proxy` posé). Par défaut : 1 proxy en production.
const TRUST_PROXY = process.env.TRUST_PROXY_HOPS !== undefined && process.env.TRUST_PROXY_HOPS !== ''
  ? Number(process.env.TRUST_PROXY_HOPS)
  : process.env.NODE_ENV === 'production'
    ? 1
    : false;
if (TRUST_PROXY !== false) app.set('trust proxy', TRUST_PROXY);

// API-002 (audit) : en-têtes de sécurité systématiques. CSP restrictive :
// l'API ne sert que du JSON + des fichiers /uploads jamais exécutés (voir
// Content-Disposition ci-dessous) — default-src 'none' bloque toute tentative
// de rendre du contenu actif depuis une réponse de l'API.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        imgSrc: ["'self'"],
        mediaSrc: ["'self'"],
        styleSrc: ["'self'"],
        // UX-004 (audit) : polices auto-hébergées — aucune origine externe.
        fontSrc: ["'self'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);

// API-002 (audit) : CORS sur LISTE BLANCHE (jamais « ouvert ») + credentials
// pour le cookie de rafraîchissement httpOnly. Sources : CORS_ORIGINS
// (séparées par des virgules) + FRONTEND_URL ; localhost n'est accepté qu'en
// développement.
const ORIGINE_FRONTEND = process.env.FRONTEND_URL || 'http://localhost:4200';
const ORIGINES_AUTORISEES = new Set(
  [
    ...(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    ORIGINE_FRONTEND,
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:4200', 'http://127.0.0.1:4200']),
  ]
);
app.use(
  cors({
    origin: (origine, rappel) => {
      // Même origine / outils sans Origin (curl, SSR) : autorisé.
      if (!origine || ORIGINES_AUTORISEES.has(origine)) return rappel(null, true);
      return rappel(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Override', 'X-Request-Id'],
  })
);

// LOG-002 (audit) : identifiant de corrélation par requête — repris du client
// si fourni et bien formé, sinon généré. Exposé en réponse (X-Request-Id) et
// attaché aux journaux structurés.
app.use((req, res, next) => {
  const recu = req.get('X-Request-Id');
  req.requestId = recu && /^[\w.-]{1,64}$/.test(recu) ? recu : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  req.timeStart = process.hrtime.bigint();
  next();
});

app.use(express.json());

// INJ-001 (audit) : assainissement des CORPS JSON — supprime toute clé
// commençant par $ ou contenant des points avant d'atteindre les modèles
// (bloque { email: { $ne: null } } et consorts).
app.use(mongoSanitize());

// DB-005 (audit) : purge récursive des clés réservées du prototype
// (__proto__ / constructor / prototype) avant les champs Mixed / strict:false.
const { middlewareNettoyageClesReservees } = require('./utils/sanitize.util');
app.use(middlewareNettoyageClesReservees);

// LOG-002 (audit) : journal d'accès structuré (une ligne JSON par requête).
app.use((req, res, next) => {
  res.on('finish', () => {
    const dureeMs = Number((process.hrtime.bigint() - req.timeStart) / 1000000n);
    logger.info('http', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: dureeMs,
      ip: req.ip,
      userId: req.userId || null,
      tenantId: req.tenantId || null,
      ...(req.impersonated ? { impersonated: true } : {}),
    });
  });
  next();
});

// Fichiers téléversés (pièces jointes, photos de profil), servis statiquement.
// Noms uuid => cache « immutable » sans risque d'obsolescence.
//
// UPL-002 (audit) : durcissement maximal de la restitution —
//   * SEULES les images (png/jpeg/gif/webp) sont servies « inline » : leur
//     signature binaire est vérifiée à l'upload (UPL-001) et la CSP de
//     l'API (default-src 'none') empêche toute exécution ;
//   * tout le reste (pdf, documents, html, svg, js, …) est forcé en
//     téléchargement (Content-Disposition: attachment + octet-stream) : un
//     fichier stocké ne peut JAMAIS s'exécuter ni rendre de HTML actif depuis
//     l'origine de l'API, même servi directement par son URL.
const INLINE_UPLOADS = /\.(png|jpe?g|gif|webp)$/i;
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (!INLINE_UPLOADS.test(filePath)) {
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
app.use('/api/tickets', ticketRoutes);
app.use('/api/uploads', uploadRoutes);
// Plateforme SaaS : catalogue produits, souscriptions, licences, rôles,
// audit et notifications (multi-produits).
app.use('/api/platform', platformRoutes);
// Produit SaaS « Gestion de Projet » (project_management) — autorité serveur.
app.use('/api/projects', projectRoutes);

/** Gestionnaire d'erreurs global — dernière ligne de défense :
 *  CastError ObjectId → 400, erreur de validation → 422, sinon 500.
 *  Ne doit JAMAIS laisser une erreur asynchrone tuer le processus, ni fuiter
 *  un détail interne (pile, message Mongo) au client : le détail part au
 *  journal structuré, le client reçoit un contrat d'erreur stable. */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const requestId = req.requestId;
  if (err?.name === 'CastError') {
    res.status(400).json({ message: 'Identifiant invalide.', requestId });
    return;
  }
  if (err?.name === 'ValidationError') {
    res.status(422).json({ message: 'Données invalides.', details: err.message, requestId });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Corps JSON invalide.', requestId });
    return;
  }
  logger.error('erreur non gérée', { requestId, path: req.originalUrl, err });
  res.status(500).json({ message: 'Erreur serveur', requestId });
});

module.exports = app;
