const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth.route');
const demandeRoutes = require('./routes/demande.route');
const changementRoutes = require('./routes/changement.route');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Route de santé
app.get('/health', (_req, res) => res.status(200).json({ status: 'OK' }));

// Routes principales
app.use('/api/auth', authRoutes);
app.use('/api/demandes', demandeRoutes);
app.use('/api/changements', changementRoutes);

module.exports = app;
