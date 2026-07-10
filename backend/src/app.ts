import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.route';
import demandeRoutes from './routes/demande.route';
import changementRoutes from './routes/changement.route';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());

// Route de santé
app.get('/health', (_req, res) => res.status(200).json({ status: 'OK' }));

// Routes principales
app.use('/api/auth', authRoutes);
app.use('/api/demandes', demandeRoutes);
app.use('/api/changements', changementRoutes);

export default app;
