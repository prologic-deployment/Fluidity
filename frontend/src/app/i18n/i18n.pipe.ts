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

/**
 * Date localisée — réagit au changement de langue. `fmt` accepte un motif
 * Angular (ex. 'dd/MM/yyyy') OU 'short'/'medium' (rendu Intl localisé).
 * Les valeurs stockées restent inchangées.
 */
@Pipe({ name: 'dateLocale', standalone: true, pure: false })
export class LocaleDatePipe implements PipeTransform, OnDestroy {
  private sub: Subscription;
  constructor(private i18n: I18nService, cdr: ChangeDetectorRef) {
    this.sub = this.i18n.lang$.subscribe(() => cdr.markForCheck());
  }
  transform(value: string | number | Date | null | undefined, fmt?: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const locale = this.i18n.locale;
    if (fmt === 'short') return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    if (fmt === 'medium') return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    if (fmt === 'monthYear') return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
    if (fmt === 'dateTime') return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    if (fmt) return new Intl.DateTimeFormat(locale, tokensFromAngular(fmt)).format(d);
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }
  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

function tokensFromAngular(fmt: string): Intl.DateTimeFormatOptions {
  const opts: Intl.DateTimeFormatOptions = {};
  if (fmt.includes('yyyy') || fmt.includes('yy')) opts.year = 'numeric';
  if (fmt.includes('MMMM')) opts.month = 'long';
  else if (fmt.includes('MMM')) opts.month = 'short';
  else if (fmt.includes('MM')) opts.month = '2-digit';
  else if (fmt.includes('M')) opts.month = 'numeric';
  if (fmt.includes('dd')) opts.day = '2-digit';
  else if (fmt.includes('d')) opts.day = 'numeric';
  if (fmt.includes('HH') || fmt.includes('hh') || fmt.includes('H') || fmt.includes('h')) opts.hour = '2-digit';
  if (fmt.includes('mm')) opts.minute = '2-digit';
  return opts;
}

/** Nombre localisé (milliers, décimales) — réagit au changement de langue. */
@Pipe({ name: 'numLocale', standalone: true, pure: false })
export class LocaleNumberPipe implements PipeTransform, OnDestroy {
  private sub: Subscription;
  constructor(private i18n: I18nService, cdr: ChangeDetectorRef) {
    this.sub = this.i18n.lang$.subscribe(() => cdr.markForCheck());
  }
  transform(value: number | null | undefined): string {
    return this.i18n.formatNumber(value);
  }
  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

export const I18N_IMPORTS = [I18nPipe, I18nLabelPipe, LocaleDatePipe, LocaleNumberPipe];
