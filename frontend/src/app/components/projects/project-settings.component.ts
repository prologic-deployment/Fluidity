import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { HealthStatus, Project, WorkflowState } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { METHODOLOGIES, PRIORITIES, PROJECT_LIFECYCLE, PROJECT_STATUSES } from './project.constants';

/**
 * Paramètres du projet (route /projets/:id/parametres) : champs généraux,
 * règles de santé, workflow personnalisé (états réordonnables + états
 * terminaux, migration des tâches orphelines côté serveur) et archivage
 * (réversible — les données ne sont jamais supprimées).
 */
@Component({
  selector: 'app-project-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './project-settings.component.html',
})
export class ProjectSettingsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  project: Project | null = null;
  canManage = false;
  saving = false;

  // Champs généraux (cadrage)
  form = {
    name: '',
    description: '',
    stakeholder: '',
    status: 'planning',
    priority: 'medium',
    visibility: 'team',
    startDate: '',
    endDate: '',
    objectives: '',
    successCriteria: '',
    businessValue: 0,
    estimatedEffortHours: 0,
  };
  // Santé forcée (override manuel avec justification)
  override = { status: '', reason: '' };
  // Workflow personnalisé
  wfStates: { key: string; label: string; color: string; terminal: boolean; wipLimit: number }[] = [];
  wfDirty = false;
  // Règles de santé
  health = { overdueWeight: 3, milestoneDelayDays: 3, deadlineProximityDays: 14, progressGapTolerance: 15 };

  readonly methodologies = METHODOLOGIES;
  readonly priorities = PRIORITIES;
  readonly statuses = PROJECT_STATUSES;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ProjectService,
    private confirm: ConfirmDialogService,
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
          return this.api.get(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.project = r.project;
          this.canManage = ['project_admin', 'project_manager'].includes(r.myRole.roleKey) || ['TENANT_ADMIN'].includes(r.myRole.roleKey);
          this.form = {
            name: r.project.name,
            description: r.project.description,
            stakeholder: r.project.stakeholder,
            status: r.project.status,
            priority: r.project.priority,
            visibility: r.project.visibility,
            startDate: r.project.startDate ? r.project.startDate.slice(0, 10) : '',
            endDate: r.project.endDate ? r.project.endDate.slice(0, 10) : '',
            objectives: r.project.objectives || '',
            successCriteria: r.project.successCriteria || '',
            businessValue: r.project.businessValue || 0,
            estimatedEffortHours: r.project.estimatedEffortHours || 0,
          };
          this.override = { status: r.project.healthOverride?.status || '', reason: r.project.healthOverride?.reason || '' };
          this.wfStates = (r.workflow.states || []).map((s) => ({ key: s.key, label: s.label || '', color: s.color || '', terminal: !!s.terminal, wipLimit: s.wipLimit || 0 }));
          if (r.project.healthRules) this.health = { ...this.health, ...r.project.healthRules };
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

  saveFields(): void {
    if (!this.project) return;
    this.saving = true;
    this.api
      .update(this.projectId, {
        name: this.form.name,
        description: this.form.description,
        stakeholder: this.form.stakeholder,
        status: this.form.status as Project['status'],
        priority: this.form.priority as Project['priority'],
        visibility: this.form.visibility as Project['visibility'],
        startDate: this.form.startDate || null,
        endDate: this.form.endDate || null,
        objectives: this.form.objectives,
        successCriteria: this.form.successCriteria,
        businessValue: Number(this.form.businessValue) || 0,
        estimatedEffortHours: Number(this.form.estimatedEffortHours) || 0,
      })
      .subscribe({
        next: (r) => {
          this.project = { ...this.project!, ...r.project };
          this.saving = false;
          this.toast.success(this.i18n.t('projects.settings.saved'));
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
        },
      });
  }

  // --- Cycle de vie ----------------------------------------------------------

  nextStatuses(): Project['status'][] {
    if (!this.project) return [];
    return PROJECT_LIFECYCLE[this.project.status] || [];
  }

  changeStatus(status: Project['status']): void {
    if (!this.project) return;
    this.api.update(this.projectId, { status }).subscribe({
      next: (r) => {
        this.project = { ...this.project!, ...r.project };
        this.form.status = r.project.status;
        this.toast.success(this.i18n.t('projects.settings.lifecycleChanged'));
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save')),
    });
  }

  // --- Santé forcée ----------------------------------------------------------

  applyOverride(): void {
    if (!this.project) return;
    if (this.override.status && !this.override.reason.trim()) {
      this.toast.error(this.i18n.t('projects.settings.healthOverrideReason'));
      return;
    }
    this.api
      .update(this.projectId, {
        healthOverride: this.override.status
          ? { status: this.override.status as HealthStatus, reason: this.override.reason, by: null, at: null }
          : null,
      })
      .subscribe({
        next: (r) => {
          this.project = { ...this.project!, ...r.project };
          this.override = { status: r.project.healthOverride?.status || '', reason: r.project.healthOverride?.reason || '' };
          this.toast.success(this.i18n.t('projects.settings.healthOverrideSaved'));
        },
        error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save')),
      });
  }

  clearOverride(): void {
    this.override = { status: '', reason: '' };
    this.applyOverride();
  }

  saveHealth(): void {
    if (!this.project) return;
    this.api
      .update(this.projectId, { healthRules: this.health })
      .subscribe({
        next: () => this.toast.success(this.i18n.t('projects.settings.healthSaved')),
        error: () => this.toast.error(this.i18n.t('projects.errors.save')),
      });
  }

  // --- Éditeur de workflow ---------------------------------------------------

  addWfState(): void {
    this.wfStates.push({ key: `state_${Date.now().toString(36)}`, label: '', color: '', terminal: false, wipLimit: 0 });
    this.wfDirty = true;
  }

  removeWfState(index: number): void {
    this.wfStates.splice(index, 1);
    this.wfDirty = true;
  }

  moveWf(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= this.wfStates.length) return;
    const [item] = this.wfStates.splice(index, 1);
    this.wfStates.splice(target, 0, item);
    this.wfDirty = true;
  }

  /** Applique le workflow par défaut du produit (reset). */
  resetWf(): void {
    this.wfStates = [
      { key: 'backlog', label: '', color: '', terminal: false, wipLimit: 0 },
      { key: 'todo', label: '', color: '', terminal: false, wipLimit: 0 },
      { key: 'in_progress', label: '', color: '', terminal: false, wipLimit: 0 },
      { key: 'blocked', label: '', color: '', terminal: false, wipLimit: 0 },
      { key: 'review', label: '', color: '', terminal: false, wipLimit: 0 },
      { key: 'completed', label: '', color: '', terminal: false, wipLimit: 0 },
      { key: 'cancelled', label: '', color: '', terminal: true, wipLimit: 0 },
    ];
    this.wfDirty = true;
  }

  saveWorkflow(): void {
    if (!this.project || this.wfStates.length < 2 || this.wfStates.length > 12) {
      this.toast.error(this.i18n.t('projects.settings.wfInvalid'));
      return;
    }
    const payload: WorkflowState[] = this.wfStates.map((s, order) => ({
      key: s.key || `s${order}`,
      label: s.label.trim(),
      color: s.color.trim(),
      order,
      terminal: s.terminal,
      wipLimit: Math.max(0, Number(s.wipLimit) || 0),
    }));
    this.saving = true;
    this.api.updateWorkflow(this.projectId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.wfDirty = false;
        this.toast.success(this.i18n.t('projects.settings.wfSaved'));
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
      },
    });
  }

  // --- Archivage -------------------------------------------------------------

  async toggleArchive(): Promise<void> {
    if (!this.project) return;
    const archiving = !this.project.archived;
    const ok = await this.confirm.confirm({
      title: this.i18n.t(archiving ? 'projects.settings.archiveTitle' : 'projects.settings.unarchiveTitle'),
      message: this.i18n.t('projects.settings.archiveBody'),
      confirmLabel: this.i18n.t(archiving ? 'projects.settings.archive' : 'projects.settings.unarchive'),
    });
    if (!ok) return;
    this.api.archive(this.projectId).subscribe({
      next: () => {
        this.toast.success(this.i18n.t(archiving ? 'projects.settings.archived' : 'projects.settings.unarchived'));
        this.router.navigate(['/projets']);
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  trackWf(_i: number, s: { key: string }): string {
    return s.key;
  }
}
