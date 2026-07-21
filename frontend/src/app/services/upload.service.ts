import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UploadedFile {
  url: string;
  nom: string;
  taille: number;
  type: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly baseUrl = `${environment.apiUrl}/uploads`;

  constructor(private http: HttpClient) {}

  /** Envoie un ou plusieurs fichiers ; retourne leurs URLs publiques + métadonnées. */
  upload(files: File[]): Observable<UploadedFile[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f, f.name));
    return this.http
      .post<{ files: UploadedFile[] }>(this.baseUrl, formData)
      .pipe(map((res) => res.files));
  }
}
