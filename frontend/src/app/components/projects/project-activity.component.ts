import { ProjectActivityPipe } from './project.pipes';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ActivityEntry } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Journal d'activité du projet (route /projets/:id/activite) — historique
 * traduit et filtrable (type d'événement, acteur, période), paginé serveur.
 */
@Component({
  selector: 'app-project-activity',
  standalone: true,
  imports: [ProjectActivityPipe, CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './project-activity.component.html',
})
export class ProjectActivityComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  items: ActivityEntry[] = [];
  kinds: string[] = [];
  total = 0;
  page = 1;
  pages = 1;
  fKind = '';
  fUser = '';

  private readonly destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ProjectService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          return this.refresh();
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refresh() {
    this.loading = true;
    return this.api.activity(this.projectId, { page: String(this.page), kind: this.fKind, user: this.fUser }).pipe(
      takeUntil(this.destroy$)
    );
  }

  load(): void {
    this.refresh().subscribe({
      next: (r) => {
        this.items = r.items;
        this.kinds = r.kinds;
        this.total = r.total;
        this.pages = r.pages;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'projects.errors.load';
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  goPage(p: number): void {
    this.page = p;
    this.load();
  }

  trackA(_i: number, a: ActivityEntry): string {
    return a._id;
  }
}
