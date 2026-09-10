import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectDashboard, WorkloadRow } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ProjectActivityPipe } from './project.pipes';
import { HEALTH_BADGE, PRIORITY_BADGE, SEVERITY_BADGE } from './project.constants';

/**
 * Vue d'ensemble du projet : progression, compteurs, échéances, jalons,
 * charge d'équipe, santé (avec raisons), risques et activité récente.
 * Toutes les données viennent de l'agrégat serveur /dashboard (léger).
 */
@Component({
  selector: 'app-project-overview',
  standalone: true,
  imports: [ProjectActivityPipe, CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './project-overview.component.html',
})
export class ProjectOverviewComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  data: ProjectDashboard | null = null;
  healthBadge = HEALTH_BADGE;
  priorityBadge = PRIORITY_BADGE;
  severityBadge = SEVERITY_BADGE;
  readonly Math = Math;

  private readonly destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ProjectService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => this.api.projectDashboard(p['id']))
      )
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

  /** Charge d'un membre à partir de la liste de l'équipe. */
  memberName(userId: string): string {
    const m = this.data?.members.find((x) => x.userId?._id === userId);
    const u = m?.userId;
    if (!u) return '';
    return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  }

  /** Statut de charge : sous-utilisé / normal / élevé / surchargé. */
  workloadLevel(w: WorkloadRow): 'low' | 'normal' | 'high' | 'over' {
    if (w.overdue >= 3 || w.tasks >= 8) return 'over';
    if (w.overdue >= 1 || w.tasks >= 5) return 'high';
    if (w.tasks <= 1 && !w.overdue) return 'low';
    return 'normal';
  }

  workloadBadge(level: string): string {
    return { low: 'badge-outline', normal: 'badge-success', high: 'badge-warning', over: 'badge-destructive' }[level] || 'badge-outline';
  }

  statusCount(key: string): number {
    return this.data?.taskStats?.byStatus?.[key] || 0;
  }

  get milestonesUpcoming(): { name: string; dueDate: string | null; status: string; kind: string }[] {
    return (this.data?.upcoming?.milestones || []).slice(0, 5).map((m) => ({
      name: m.name,
      dueDate: m.dueDate,
      status: m.status,
      kind: m.kind,
    }));
  }
}
