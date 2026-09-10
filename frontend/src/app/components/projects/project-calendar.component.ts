import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { CalendarData, Sprint, Task } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

interface CalendarEvent {
  date: string; // ISO yyyy-mm-dd
  kind: 'task' | 'milestone' | 'sprint' | 'project';
  label: string;
  ref?: string;
  id?: string;
  color: string;
}

/**
 * Calendrier du projet (route /projets/:id/calendrier) — vues mois /
 * semaine / liste : échéances de tâches, jalons, sprints et bornes du
 * projet. Composant léger sans dépendance externe.
 */
@Component({
  selector: 'app-project-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './project-calendar.component.html',
})
export class ProjectCalendarComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  data: CalendarData | null = null;
  events: CalendarEvent[] = [];
  view: 'month' | 'week' | 'list' = 'month';
  cursor = new Date();

  private readonly destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ProjectService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cursor = new Date();
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          return this.api.calendar(p['id']);
        })
      )
      .subscribe({
        next: (d) => {
          this.data = d;
          this.buildEvents(d);
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

  private buildEvents(d: CalendarData): void {
    const events: CalendarEvent[] = [];
    for (const t of d.tasks) {
      if (t.dueDate) {
        events.push({
          date: t.dueDate.slice(0, 10),
          kind: 'task',
          label: t.title,
          ref: t.ref,
          id: t._id,
          color: 'bg-indigo-500',
        });
      }
    }
    for (const m of d.milestones) {
      if (m.dueDate) {
        events.push({ date: m.dueDate.slice(0, 10), kind: 'milestone', label: m.name, color: m.kind === 'phase' ? 'bg-violet-500' : 'bg-amber-500' });
      }
    }
    for (const s of d.sprints) {
      if (s.startDate) events.push({ date: s.startDate.slice(0, 10), kind: 'sprint', label: s.name, color: 'bg-emerald-500' });
      if (s.endDate) events.push({ date: s.endDate.slice(0, 10), kind: 'sprint', label: s.name + ' ⤵', color: 'bg-emerald-600' });
    }
    if (d.project.startDate) events.push({ date: d.project.startDate.slice(0, 10), kind: 'project', label: '▶', color: 'bg-slate-400' });
    if (d.project.endDate) events.push({ date: d.project.endDate.slice(0, 10), kind: 'project', label: '■', color: 'bg-slate-500' });
    this.events = events;
  }

  // --- Grille mensuelle ------------------------------------------------------

  move(dir: -1 | 1): void {
    const c = new Date(this.cursor);
    if (this.view === 'month') c.setMonth(c.getMonth() + dir);
    else c.setDate(c.getDate() + dir * 7);
    this.cursor = c;
    this.cdr.markForCheck();
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(this.cursor);
  }

  get weekLabel(): string {
    const start = this.weekStart(this.cursor);
    const end = new Date(start.getTime() + 6 * 86400000);
    return `${start.toLocaleDateString(this.locale())} → ${end.toLocaleDateString(this.locale())}`;
  }

  private locale(): string {
    return (document.documentElement.lang || 'fr').replace('_', '-');
  }

  /** Cellules du mois : dates du calendrier (avec remplissage des semaines). */
  get monthCells(): { date: Date; inMonth: boolean }[] {
    const first = new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 1);
    const start = new Date(first);
    const offset = (first.getDay() + 6) % 7; // lundi = 0
    start.setDate(1 - offset);
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      cells.push({ date: d, inMonth: d.getMonth() === first.getMonth() });
    }
    return cells;
  }

  weekStart(d: Date): Date {
    const c = new Date(d);
    const offset = (c.getDay() + 6) % 7;
    c.setDate(c.getDate() - offset);
    c.setHours(0, 0, 0, 0);
    return c;
  }

  get weekDays(): Date[] {
    const start = this.weekStart(this.cursor);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));
  }

  eventsOn(date: Date): CalendarEvent[] {
    const iso = this.iso(date);
    return this.events.filter((e) => e.date === iso);
  }

  /** Trois premiers événements d'une cellule (lisibilité de la grille). */
  firstEvents(date: Date): CalendarEvent[] {
    return this.eventsOn(date).slice(0, 3);
  }

  /** Événements triés pour la vue liste (dans la fenêtre du mois courant). */
  get listEvents(): CalendarEvent[] {
    const month = this.cursor.getMonth();
    const year = this.cursor.getFullYear();
    return this.events
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  todayIso(): string {
    return this.iso(new Date());
  }

  isToday(d: Date): boolean {
    return this.iso(d) === this.todayIso();
  }

  taskLink(e: CalendarEvent): string[] | null {
    return e.kind === 'task' && e.id ? ['/projets', this.projectId, 'taches', e.id] : null;
  }

  kindLabel(e: CalendarEvent): string {
    return 'projects.meta.eventKind.' + e.kind;
  }

  trackCell(_i: number, c: { date: Date; inMonth: boolean }): string {
    return this.iso(c.date);
  }

  trackEvent(_i: number, e: CalendarEvent): string {
    return e.date + e.kind + e.label;
  }
}
