import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { ActivityEntry, GlobalDashboard, Project } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ProjectActivityPipe } from './project.pipes';
import { HEALTH_BADGE, METHODOLOGIES, PRIORITIES, PRIORITY_BADGE, PROJECT_STATUSES } from './project.constants';

/**
 * Tableau de bord GLOBAL Gestion de Projet (route /projets) :
 * KPIs du tenant, répartition méthodologies, tendance de complétion,
 * échéances à venir, activité récente et liste paginée des projets avec
 * filtres/tri/recherche CÔTÉ SERVEUR (jamais de chargement « tout »).
 */
@Component({
  selector: 'app-projects-dashboard',
  standalone: true,
  imports: [ProjectActivityPipe, CommonModule, FormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './projects-dashboard.component.html',
})
export class ProjectsDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  data: GlobalDashboard | null = null;
  projects: Project[] = [];
  total = 0;
  page = 1;
  pages = 1;

  // Filtres & tri (envoyés au serveur)
  q = '';
  fStatus = '';
  fPriority = '';
  fMethodology = '';
  sortKey = 'createdAt';
  sortDir: 'asc' | 'desc' = 'desc';

  readonly methodologies = METHODOLOGIES;
  readonly priorities = PRIORITIES;
  readonly statuses = PROJECT_STATUSES;
  readonly healthBadge = HEALTH_BADGE;
  readonly priorityBadge = PRIORITY_BADGE;
  readonly Math = Math;

  isPast(date: string | null): boolean {
    if (!date) return false;
    return new Date(date).getTime() < Date.now() - 86400000;
  }

  /** Largeur du donut méthodologies (SVG inline, pas de lib). */
  get methodologySegments(): { key: string; ratio: number; color: string; offset: number }[] {
    const dist = this.data?.methodologyDist || {};
    const colors: Record<string, string> = { kanban: '#6366f1', scrum: '#10b981', waterfall: '#f59e0b', hybrid: '#ec4899' };
    const entries = Object.entries(dist).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    let acc = 0;
    return entries.map(([k, v]) => {
      const seg = { key: k, ratio: v / total, color: colors[k] || '#94a3b8', offset: acc };
      acc += v / total;
      return seg;
    });
  }

  get trendBars(): { month: string; count: number; ratio: number }[] {
    const trend = this.data?.completionTrend || [];
    const max = Math.max(1, ...trend.map((t) => t.count));
    return trend.map((t) => ({ month: t.month, count: t.count, ratio: t.count / max }));
  }

  private readonly destroy$ = new Subject<void>();

  constructor(
    private projectsApi: ProjectService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    this.projectsApi
      .globalDashboard()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (d) => {
          this.data = d;
        },
        error: () => {
          this.error = 'projects.errors.load';
        },
      });
    this.loadList();
  }

  /** Liste paginée des projets (filtres serveur). */
  loadList(page = 1): void {
    this.page = page;
    this.projectsApi
      .list({
        page,
        limit: 10,
        q: this.q,
        status: this.fStatus,
        priority: this.fPriority,
        methodology: this.fMethodology,
        sort: this.sortKey,
        dir: this.sortDir,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.projects = r.projects;
          this.total = r.total;
          this.pages = r.pages;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
        },
      });
  }

  applyFilters(): void {
    this.loadList(1);
  }

  resetFilters(): void {
    this.q = '';
    this.fStatus = '';
    this.fPriority = '';
    this.fMethodology = '';
    this.applyFilters();
  }

  toggleSort(key: string): void {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else {
      this.sortKey = key;
      this.sortDir = 'desc';
    }
    this.applyFilters();
  }

  /** Code du projet d'une entrée d'activité (projectId peuplé ou brut). */
  codeOf(a: ActivityEntry): string {
    const p = a.projectId;
    return typeof p === 'object' ? p?.code || '' : '';
  }

  trackProject(_i: number, p: Project): string {
    return p._id;
  }
}
