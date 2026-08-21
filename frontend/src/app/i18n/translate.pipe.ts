import { Pipe, PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Pipe de traduction réactif (non pur) :
 *   - {{ 'key' | t }}           → résout une clé de dictionnaire
 *   - {{ value | t:'status' }}  → traduit une valeur d'énumération métier
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private i18n: I18nService) {}

  transform(value: string | null | undefined, group?: string): string {
    if (group) {
      return this.i18n.enum(group, value);
    }
    return this.i18n.t(value ?? '');
  }
}
