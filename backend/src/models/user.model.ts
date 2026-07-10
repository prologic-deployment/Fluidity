import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

/** Rôles possibles au sein d'un tenant. */
export type Role =
  | 'CLIENT'
  | 'ADMIN'
  | 'SUPPORT_N1'
  | 'RESPONSABLE_TECHNIQUE';

/**
 * Interface du document Utilisateur.
 */
export interface IUtilisateur extends Document {
  tenantId: string;
  email: string;
  password: string;
  role: Role;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UtilisateurSchema = new Schema<IUtilisateur>(
  {
    tenantId: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: { type: String, default: 'CLIENT' },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true }
);

/**
 * Hook pre-save : hash du mot de passe via bcrypt uniquement si modifié.
 */
UtilisateurSchema.pre<IUtilisateur>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Compare un mot de passe en clair avec le hash stocké.
 */
UtilisateurSchema.methods.comparePassword = function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const Utilisateur = mongoose.model<IUtilisateur>(
  'Utilisateur',
  UtilisateurSchema,
  'utilisateurs' // Collection explicite : db.utilisateurs (cohérent avec le modèle d'origine)
);
