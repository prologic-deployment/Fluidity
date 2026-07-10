import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.route';

dotenv.config();

const app: Application = express();

app.use(cors());
app.use(express.json());

// Route de santé
app.get('/health', (_req, res) => res.status(200).json({ status: 'OK' }));

// Routes principales
app.use('/api/auth', authRoutes);

export default app;
