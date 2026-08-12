import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from './i18n.service';

@Pipe({ name: 't', standalone: true, pure: false })
export class I18nPipe implements PipeTransform, OnDestroy {
  private sub: Subscription;
  constructor(private i18n: I18nService, cdr: ChangeDetectorRef) {
    this.sub = this.i18n.lang$.subscribe(() => cdr.markForCheck());
  }
  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

/** Traduit une valeur persistée (statut, catégorie) via catalog.* */
@Pipe({ name: 'tl', standalone: true, pure: false })
export class I18nLabelPipe implements PipeTransform, OnDestroy {
  private sub: Subscription;
  constructor(private i18n: I18nService, cdr: ChangeDetectorRef) {
    this.sub = this.i18n.lang$.subscribe(() => cdr.markForCheck());
  }
  transform(value: string | null | undefined, prefix = 'catalog'): string {
    if (!value) return '';
    const translated = this.i18n.t(`${prefix}.${value}`);
    return translated === `${prefix}.${value}` ? value : translated;
  }
  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

export const I18N_IMPORTS = [I18nPipe, I18nLabelPipe];
