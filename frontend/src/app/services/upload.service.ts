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
  | 'documents'
  | 'projects';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly baseUrl = `${environment.apiUrl}/uploads`;

  constructor(private http: HttpClient) {}

  /**
   * Envoie un ou plusieurs fichiers dans la catégorie du tenant courant
   * (stockage organisé : uploads/tenants/<tenantId>/<categorie>/ côté
   * serveur — registre partagé CATEGORIES_UPLOAD). Sans catégorie, le
   * serveur applique « attachments » (comportement historique).
   * `subpath` : sous-dossier strict (catégorie « projects »), ex.
   * « PRJ-2026-0001/Tasks ». Retourne les URLs canoniques relatives.
   */
  upload(files: File[], categorie?: CategorieUpload, subpath = ''): Observable<UploadedFile[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f, f.name));
    let cible = categorie ? `${this.baseUrl}/${categorie}` : this.baseUrl;
    if (subpath) cible += `?subpath=${encodeURIComponent(subpath)}`;
    return this.http
      .post<{ files: UploadedFile[] }>(cible, formData)
      .pipe(map((res) => res.files));
  }
}
