import { Utilisateur, Role } from '../models/user.model';

export interface SeedUser {
  tenantId: string;
  email: string;
  password: string;
  role: Role;
}

/**
 * Utilisateurs de démonstration (multi-tenant).
 * Mots de passe par défaut (à changer en production) : Password123!
 */
export const demoUsers: SeedUser[] = [
  { tenantId: 'tenant-001', email: 'admin@fluidity.dev', password: 'Password123!', role: 'ADMIN' },
  { tenantId: 'tenant-001', email: 'client@fluidity.dev', password: 'Password123!', role: 'CLIENT' },
  { tenantId: 'tenant-001', email: 'support@fluidity.dev', password: 'Password123!', role: 'SUPPORT_N1' },
  {
    tenantId: 'tenant-001',
    email: 'responsable@fluidity.dev',
    password: 'Password123!',
    role: 'RESPONSABLE_TECHNIQUE',
  },
  // Second tenant pour tester l'isolation des données
  { tenantId: 'tenant-002', email: 'client2@fluidity.dev', password: 'Password123!', role: 'CLIENT' },
];

/**
 * Insère les utilisateurs de démonstration UNIQUEMENT si la collection
 * est vide (idempotent). Les mots de passe sont hashés via le hook pre-save.
 */
export const seedUsers = async (): Promise<void> => {
  const count = await Utilisateur.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} utilisateur(s) existant(s) — seed ignoré.`);
    return;
  }

  for (const u of demoUsers) {
    await new Utilisateur(u).save();
  }

  console.log(`[Seed] ${demoUsers.length} utilisateurs de démonstration créés dans db.users.`);
};
