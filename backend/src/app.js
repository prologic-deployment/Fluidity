const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.route');
const demandeRoutes = require('./routes/demande.route');
const changementRoutes = require('./routes/changement.route');
const contratRoutes = require('./routes/contrat.route');
const clientRoutes = require('./routes/client.route');
const uploadRoutes = require('./routes/upload.route');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Fichiers téléversés (pièces jointes), servis statiquement
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Route de santé
app.get('/health', (_req, res) => res.status(200).json({ status: 'OK' }));

// Routes principales
app.use('/api/auth', authRoutes);
app.use('/api/demandes', demandeRoutes);
app.use('/api/changements', changementRoutes);
app.use('/api/contrats', contratRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/uploads', uploadRoutes);

module.exports = app;
