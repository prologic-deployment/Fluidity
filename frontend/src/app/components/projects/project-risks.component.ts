import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Risk } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { RISK_LEVELS, RISK_STATUSES, SEVERITY_BADGE } from './project.constants';

const CELLS: [string, string][] = [
  ['high', 'high'], ['high', 'medium'], ['high', 'low'],
  ['medium', 'high'], ['medium', 'medium'], ['medium', 'low'],
  ['low', 'high'], ['low', 'medium'], ['low', 'low'],
];

/**
 * Risques du projet (route /projets/:id/risques) : registre + MATRICE
 * probabilité × impact (gravité calculée côté serveur) et plans
 * d'atténuation.
 */
@Component({
  selector: 'app-project-risks',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-risks.component.html',
})
export class ProjectRisksComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  risks: Risk[] = [];
  creating = false;
  editing: Risk | null = null;
  form = { title: '', description: '', probability: 'medium', impact: 'medium', ownerId: '', mitigation: '', dueDate: '' };
  submitting = false;

  readonly levels = RISK_LEVELS;
  readonly statuses = RISK_STATUSES;
  readonly severityBadge = SEVERITY_BADGE;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ProjectService,
    private toast: ToastService,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          return this.api.risks(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.risks = r.risks;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreate(): void {
    this.creating = true;
    this.form = { title: '', description: '', probability: 'medium', impact: 'medium', ownerId: '', mitigation: '', dueDate: '' };
  }

  openEdit(r: Risk): void {
    this.editing = r;
    this.form = {
      title: r.title,
      description: r.description,
      probability: r.probability,
      impact: r.impact,
      ownerId: r.ownerId || '',
      mitigation: r.mitigation,
      dueDate: r.dueDate ? r.dueDate.slice(0, 10) : '',
    };
  }

  submit(): void {
    if (!this.form.title.trim()) return;
    this.submitting = true;
    const payload = {
      title: this.form.title,
      description: this.form.description,
      probability: this.form.probability as Risk['probability'],
      impact: this.form.impact as Risk['impact'],
      ownerId: this.form.ownerId || null,
      mitigation: this.form.mitigation,
      dueDate: this.form.dueDate || null,
    };
    const call = this.editing
      ? this.api.updateRisk(this.projectId, this.editing._id, payload)
      : this.api.createRisk(this.projectId, payload);
    call.subscribe({
      next: () => {
        this.creating = false;
        this.editing = null;
        this.submitting = false;
        this.refresh();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
      },
    });
  }

  setStatus(r: Risk, status: Risk['status']): void {
    this.api.updateRisk(this.projectId, r._id, { status }).subscribe({
      next: () => this.refresh(),
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  remove(r: Risk): void {
    this.api.deleteRisk(this.projectId, r._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.risks.deleted'));
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.risks(this.projectId).subscribe((r) => {
      this.risks = r.risks;
      this.cdr.markForCheck();
    });
  }

  /** Risques de la matrice pour une cellule (probabilité, impact). */
  matrixCell(probability: string, impact: string): Risk[] {
    return this.risks.filter((r) => r.probability === probability && r.impact === impact && r.status !== 'closed');
  }

  readonly matrixCells = CELLS;

  /** Bordure de cellule de matrice selon la gravité calculée. */
  matrixBorder(r: Risk): string {
    return {
      low: 'border-slate-300 dark:border-slate-600',
      medium: 'border-amber-400',
      high: 'border-orange-500',
      critical: 'border-red-500',
    }[r.severity] || 'border-border';
  }

  ownerName(r: Risk): string {
    const o = r.owner as { firstName?: string; lastName?: string } | undefined;
    return o ? `${o.firstName || ''} ${o.lastName || ''}`.trim() : '';
  }

  trackR(_i: number, r: Risk): string {
    return r._id;
  }
}
