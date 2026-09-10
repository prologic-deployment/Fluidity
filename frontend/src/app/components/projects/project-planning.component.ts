import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Milestone, Sprint, Task } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

interface Row {
  kind: 'phase' | 'milestone' | 'sprint' | 'task';
  id: string;
  label: string;
  sub?: string;
  start: Date | null;
  end: Date | null;
  color: string;
  ref?: string;
  progress?: number;
  deps?: { fromId: string; toId: string }[];
}

/**
 * Chronologie du projet (route /projets/:id/planning) — diagramme de Gantt
 * léger et performant : phases, jalons, sprints et tâches planifiées sur
 * une échelle de jours, avec liaisons de dépendances (SVG).
 */
@Component({
  selector: 'app-project-planning',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './project-planning.component.html',
})
export class ProjectPlanningComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  rows: Row[] = [];
  minDate: Date = new Date();
  maxDate: Date = new Date();
  totalDays = 30;
  dayWidth = 34;
  todayOffset = 0;
  dependencyLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  @ViewChild('timelineScroll') scrollRef?: ElementRef<HTMLElement>;

  private readonly destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ProjectService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          return this.api.calendar(p['id']);
        })
      )
      .subscribe({
        next: (d) => this.build(d),
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

  private build(d: {
    project: { startDate: string | null; endDate: string | null };
    tasks: Task[];
    milestones: Milestone[];
    sprints: Sprint[];
  }): void {
    const rows: Row[] = [];

    // Bornes du projet
    const projectStart = d.project.startDate ? new Date(d.project.startDate) : null;
    const projectEnd = d.project.endDate ? new Date(d.project.endDate) : null;
    if (projectStart && projectEnd) {
      rows.push({
        kind: 'phase',
        id: 'project',
        label: 'projects.planning.projectRange',
        start: projectStart,
        end: projectEnd,
        color: 'bg-slate-400/70',
      });
    }

    // Phases
    for (const m of d.milestones.filter((x) => x.kind === 'phase').sort((a, b) => a.order - b.order)) {
      rows.push({
        kind: 'phase',
        id: m._id,
        label: m.name,
        start: m.startDate ? new Date(m.startDate) : null,
        end: m.dueDate ? new Date(m.dueDate) : null,
        color: 'bg-violet-500/80',
        progress: m.progress,
      });
    }
    // Jalons (points)
    for (const m of d.milestones.filter((x) => x.kind === 'milestone')) {
      rows.push({
        kind: 'milestone',
        id: m._id,
        label: m.name,
        start: m.dueDate ? new Date(m.dueDate) : null,
        end: m.dueDate ? new Date(m.dueDate) : null,
        color: 'bg-amber-500',
        progress: m.progress,
      });
    }
    // Sprints
    for (const s of d.sprints) {
      rows.push({
        kind: 'sprint',
        id: s._id,
        label: s.name,
        start: s.startDate ? new Date(s.startDate) : null,
        end: s.endDate ? new Date(s.endDate) : null,
        color: 'bg-emerald-500/80',
      });
    }
    // Tâches planifiées (celles qui ont au moins une date)
    const tasks = d.tasks.filter((t) => t.startDate || t.dueDate);
    for (const t of tasks.slice(0, 60)) {
      rows.push({
        kind: 'task',
        id: t._id,
        ref: t.ref,
        label: t.title,
        sub: t.status,
        start: t.startDate ? new Date(t.startDate) : t.dueDate ? new Date(t.dueDate) : null,
        end: t.dueDate ? new Date(t.dueDate) : t.startDate ? new Date(t.startDate) : null,
        color: 'bg-indigo-500/80',
        deps: (t.dependencies || []).map((dep) => ({ fromId: dep.dependsOnId, toId: t._id })),
      });
    }

    // Échelle : bornes min/max avec marges
    const dated = rows.filter((r) => r.start).map((r) => r.start as Date);
    const ends = rows.filter((r) => r.end).map((r) => r.end as Date);
    const all = [...dated, ...ends];
    if (!all.length) {
      this.rows = rows;
      this.loading = false;
      return;
    }
    const min = new Date(Math.min(...all.map((d) => d.getTime())));
    const max = new Date(Math.max(...all.map((d) => d.getTime())));
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 3);
    this.minDate = min;
    this.maxDate = max;
    this.totalDays = Math.max(7, Math.round((max.getTime() - min.getTime()) / 86400000));
    const now = new Date();
    this.todayOffset = Math.max(0, Math.min(this.totalDays, Math.round((now.getTime() - min.getTime()) / 86400000)));

    this.rows = rows;
    // Lignes de dépendance (calculées après rendu via barPositions)
    this.loading = false;
    this.cdr.markForCheck();
    setTimeout(() => this.computeDependencyLines(), 0);
  }

  /** Position horizontale (px) d'une date sur l'échelle. */
  xOf(d: Date | null): number {
    if (!d) return 0;
    const days = Math.round((d.getTime() - this.minDate.getTime()) / 86400000);
    return Math.max(0, Math.min(this.totalDays, days)) * this.dayWidth;
  }

  widthOf(start: Date | null, end: Date | null): number {
    if (!start || !end) return this.dayWidth * 0.6;
    return Math.max(this.dayWidth * 0.6, this.xOf(end) - this.xOf(start) + this.dayWidth);
  }

  /** Jours de l'échelle (libellés espacés). */
  get dayTicks(): { offset: number; label: string }[] {
    const ticks: { offset: number; label: string }[] = [];
    const step = Math.ceil(this.totalDays / 40);
    for (let i = 0; i <= this.totalDays; i += step) {
      const d = new Date(this.minDate.getTime() + i * 86400000);
      ticks.push({ offset: i * this.dayWidth, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return ticks;
  }

  /** Lignes SVG entre barres de tâches dépendantes. */
  computeDependencyLines(): void {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const positions = new Map<string, { x: number; y: number }>();
    const container = this.scrollRef?.nativeElement;
    const bars = container ? Array.from(container.querySelectorAll<HTMLElement>('[data-bar]')) : [];
    for (const el of bars) {
      const id = el.getAttribute('data-bar') || '';
      const rowEl = el.closest('[data-row]') as HTMLElement | null;
      if (!rowEl) continue;
      const rowY = rowEl.offsetTop + rowEl.offsetHeight / 2;
      positions.set(id, { x: el.offsetLeft + el.offsetWidth, y: rowY });
    }
    const rowEls = container ? Array.from(container.querySelectorAll<HTMLElement>('[data-row]')) : [];
    const rowById = new Map<string, number>();
    rowEls.forEach((el, i) => rowById.set(el.getAttribute('data-row') || '', el.offsetTop + el.offsetHeight / 2));
    for (const row of this.rows) {
      if (!row.deps) continue;
      for (const dep of row.deps) {
        const from = positions.get(dep.fromId);
        const toRow = rowById.get(row.id);
        if (!from || toRow === undefined) continue;
        const toX = this.xOf(row.start) - 6;
        lines.push({ x1: from.x, y1: from.y, x2: toX, y2: toRow });
      }
    }
    this.dependencyLines = lines;
    this.cdr.markForCheck();
  }

  isPlaceholder(row: Row): boolean {
    return row.label.startsWith('projects.');
  }

  rowLink(row: Row): string[] | null {
    return row.kind === 'task' ? ['/projets', this.projectId, 'taches', row.id] : null;
  }

  trackRow(_i: number, r: Row): string {
    return r.id;
  }

  trackLine(_i: number, l: { x1: number; y1: number; x2: number; y2: number }): string {
    return `${l.x1}-${l.y1}`;
  }

  scrollToToday(): void {
    this.scrollRef?.nativeElement.scrollTo({ left: this.todayOffset * this.dayWidth - 120, behavior: 'smooth' });
  }
}
