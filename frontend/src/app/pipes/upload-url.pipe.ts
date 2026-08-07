import { Pipe, PipeTransform } from '@angular/core';
import { urlUploadAffichable } from '../utils/upload-url.util';

/**
 * Pipe de présentation : rend une URL d'upload stockée affichable
 * (voir utils/upload-url.util — cause racine du 404 des images de profil).
 * Pure : aucune réévaluation superflue pendant la détection de changements.
 *
 * Usage : <img [src]="user.avatarUrl | urlUpload" />
 *         <a  [href]="piece | urlUpload" target="_blank">…</a>
 */
@Pipe({ name: 'urlUpload', standalone: true, pure: true })
export class UrlUploadPipe implements PipeTransform {
  transform(url: string | null | undefined): string | null {
    return urlUploadAffichable(url);
  }
}
