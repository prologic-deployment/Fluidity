import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UploadedFile {
  /** URL canonique RELATIVE (« /uploads/tenants/<tenantId>/<categorie>/<fichier> »)
   *  — à passer par le pipe urlUpload pour l'affichage. */
  url: string;
  nom: string;
  taille: number;
  type: string;
  categorie?: string;
}

/** Catégories de stockage par tenant (miroir du registre backend
 *  CATEGORIES_UPLOAD — voir backend/src/utils/upload-file.util.js). */
export type CategorieUpload =
  | 'profile-pictures'
  | 'demandes'
  | 'changements'
  | 'tickets'
  | 'attachments'
  | 'logos'
  | 'documents';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly baseUrl = `${environment.apiUrl}/uploads`;

  constructor(private http: HttpClient) {}

  /**
   * Envoie un ou plusieurs fichiers dans la catégorie du tenant courant
   * (stockage organisé : uploads/tenants/<tenantId>/<categorie>/ côté
   * serveur — registre partagé CATEGORIES_UPLOAD). Sans catégorie, le
   * serveur applique « attachments » (comportement historique).
   * Retourne les URLs canoniques relatives + métadonnées.
   */
  upload(files: File[], categorie?: CategorieUpload): Observable<UploadedFile[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f, f.name));
    const cible = categorie ? `${this.baseUrl}/${categorie}` : this.baseUrl;
    return this.http
      .post<{ files: UploadedFile[] }>(cible, formData)
      .pipe(map((res) => res.files));
  }
}
