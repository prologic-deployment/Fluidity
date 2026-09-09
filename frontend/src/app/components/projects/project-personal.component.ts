import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { PersonalDashboard, Task } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { HEALTH_BADGE, PRIORITY_BADGE } from './project.constants';

/**
 * Tableau de bord PERSONNEL (route /projets/mes-taches) :
 * mes projets, mes tâches, à faire aujourd'hui, en retard, et — pour les
 * managers — la santé des projets dont on est responsable.
 */
@Component({
  selector: 'app-project-personal',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './project-personal.component.html',
})
export class ProjectPersonalComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  data: PersonalDashboard | null = null;

  readonly healthBadge = HEALTH_BADGE;
  readonly priorityBadge = PRIORITY_BADGE;

  private readonly destroy$ = new Subject<void>();

  constructor(private api: ProjectService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.api
      .personalDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (d) => {
          this.data = d;
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

  trackTask(_i: number, t: { _id: string }): string {
    return t._id;
  }

  /** Section « en retard » si non vide. */
  get hasOverdue(): boolean {
    return !!this.data?.overdue.length;
  }
}
