import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectEvent } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { EVENT_ICONS, PROJECT_EVENT_TYPES } from './project.constants';

/**
 * ÉVÉNEMENTS PROJET (route /projets/:id/reunions) — réunions, décisions,
 * échéances et événements divers (calendrier du projet). Les mêmes
 * événements alimentent l'onglet Calendrier.
 */
@Component({
  selector: 'app-project-events',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-events.component.html',
})
export class ProjectEventsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  events: ProjectEvent[] = [];

  creating = false;
  editing: ProjectEvent | null = null;
  form = { title: '', type: 'meeting', description: '', date: '' };
  submitting = false;

  readonly types = PROJECT_EVENT_TYPES;
  readonly icons = EVENT_ICONS;

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
          return this.api.events(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.events = r.events;
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
    this.form = { title: '', type: 'meeting', description: '', date: new Date().toISOString().slice(0, 10) };
  }

  openEdit(e: ProjectEvent): void {
    this.editing = e;
    this.creating = false;
    this.form = {
      title: e.title,
      type: e.type,
      description: e.description,
      date: e.date ? e.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    };
  }

  submit(): void {
    if (!this.form.title.trim() || !this.form.date) return;
    this.submitting = true;
    const payload = {
      title: this.form.title,
      type: this.form.type as ProjectEvent['type'],
      description: this.form.description,
      date: new Date(this.form.date).toISOString(),
    };
    const call = this.editing
      ? this.api.updateEvent(this.projectId, this.editing._id, payload)
      : this.api.createEvent(this.projectId, payload);
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

  remove(e: ProjectEvent): void {
    this.api.deleteEvent(this.projectId, e._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.events.deleted'));
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.events(this.projectId).subscribe((r) => {
      this.events = r.events;
      this.cdr.markForCheck();
    });
  }

  isPast(e: ProjectEvent): boolean {
    return new Date(e.date).getTime() < Date.now();
  }

  trackE(_i: number, e: ProjectEvent): string {
    return e._id;
  }
}
