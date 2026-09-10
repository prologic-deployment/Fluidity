import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Task, TimeEntry } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';

/**
 * SUIVI DU TEMPS (route /projets/:id/temps) — saisies par utilisateur et
 * par tâche, totaux par membre et total projet. Chacun modifie ses propres
 * saisies (le serveur tranche — règles d'équipe pour les autres).
 */
@Component({
  selector: 'app-project-time',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-time.component.html',
})
export class ProjectTimeComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  entries: TimeEntry[] = [];
  perUser: { userId: string; hours: number }[] = [];
  totalHours = 0;
  tasks: Task[] = [];

  creating = false;
  editing: TimeEntry | null = null;
  form = { taskId: '', date: '', minutes: 60, note: '' };
  submitting = false;

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
          this.api.tasks(p['id'], { limit: 300 }).subscribe({
            next: (r) => (this.tasks = r.tasks),
            error: () => (this.tasks = []),
          });
          return this.api.time(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.entries = r.entries;
          this.perUser = r.perUser;
          this.totalHours = r.totalHours;
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
    this.editing = null;
    const today = new Date().toISOString().slice(0, 10);
    this.form = { taskId: '', date: today, minutes: 60, note: '' };
  }

  openEdit(e: TimeEntry): void {
    this.editing = e;
    this.creating = false;
    this.form = {
      taskId: e.taskId || '',
      date: e.date ? e.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      minutes: e.minutes,
      note: e.note,
    };
  }

  submit(): void {
    if (!this.form.date || !this.form.minutes) return;
    this.submitting = true;
    const payload = {
      taskId: this.form.taskId || null,
      date: new Date(this.form.date).toISOString(),
      minutes: Math.min(1440, Math.max(1, Number(this.form.minutes) || 0)),
      note: this.form.note,
    };
    const call = this.editing
      ? this.api.updateTime(this.projectId, this.editing._id, { minutes: payload.minutes, date: payload.date, note: payload.note })
      : this.api.createTime(this.projectId, payload);
    call.subscribe({
      next: () => {
        this.creating = false;
        this.editing = null;
        this.submitting = false;
        this.refresh();
        this.toast.success(this.i18n.t('projects.time.saved'));
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
      },
    });
  }

  remove(e: TimeEntry): void {
    this.api.deleteTime(this.projectId, e._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.time.deleted'));
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.time(this.projectId).subscribe((r) => {
      this.entries = r.entries;
      this.perUser = r.perUser;
      this.totalHours = r.totalHours;
      this.cdr.markForCheck();
    });
  }

  userName(e: TimeEntry): string {
    const u = e.user as { firstName?: string; lastName?: string } | undefined;
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '—';
  }

  taskLabel(e: TimeEntry): string {
    const t = e.task as { ref?: string; title?: string } | undefined;
    return t ? `${t.ref || ''} ${t.title || ''}`.trim() : '—';
  }

  userNameFor(userId: string): string {
    const e = this.entries.find((x) => x.userId === userId);
    return e ? this.userName(e) : '—';
  }

  trackE(_i: number, e: TimeEntry): string {
    return e._id;
  }
}
