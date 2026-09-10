import { Routes } from '@angular/router';
import { ProjectsDashboardComponent } from './projects-dashboard.component';
import { ProjectPersonalComponent } from './project-personal.component';
import { ProjectNewComponent } from './project-new.component';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectOverviewComponent } from './project-overview.component';
import { ProjectTasksComponent } from './project-tasks.component';
import { ProjectTaskDetailComponent } from './project-task-detail.component';
import { ProjectBoardComponent } from './project-board.component';
import { ProjectPlanningComponent } from './project-planning.component';
import { ProjectMilestonesComponent } from './project-milestones.component';
import { ProjectSprintsComponent } from './project-sprints.component';
import { ProjectTeamComponent } from './project-team.component';
import { ProjectFilesComponent } from './project-files.component';
import { ProjectActivityComponent } from './project-activity.component';
import { ProjectRisksComponent } from './project-risks.component';
import { ProjectIssuesComponent } from './project-issues.component';
import { ProjectReportsComponent } from './project-reports.component';
import { ProjectSettingsComponent } from './project-settings.component';
import { ProjectCalendarComponent } from './project-calendar.component';
import { ProjectBacklogComponent } from './project-backlog.component';
import { ProjectTimeComponent } from './project-time.component';
import { ProjectDeliverablesComponent } from './project-deliverables.component';
import { ProjectEventsComponent } from './project-events.component';

/**
 * Routes du produit GESTION DE PROJET (montées en lazy sous /projets,
 * protégées par productAccessGuard — souscription + licence + rôle).
 *
 * Fil d'Ariane : chaque route porte `data.breadcrumb` (clé i18n) ;
 * le libellé du projet (jamais d'ObjectId brut) est injecté dynamiquement
 * par le BreadcrumbService depuis ProjectDetailComponent.
 */
export const PROJECT_ROUTES: Routes = [
  { path: '', component: ProjectsDashboardComponent },
  { path: 'mes-taches', component: ProjectPersonalComponent, data: { breadcrumb: 'projects.personal.title' } },
  { path: 'nouveau', component: ProjectNewComponent, data: { breadcrumb: 'projects.new.title' } },
  {
    path: ':id',
    component: ProjectDetailComponent,
    data: { breadcrumb: 'projects.detail.breadcrumb' },
    children: [
      { path: '', component: ProjectOverviewComponent, data: { breadcrumb: 'projects.tabs.overview' } },
      { path: 'taches', component: ProjectTasksComponent, data: { breadcrumb: 'projects.tabs.tasks' } },
      { path: 'taches/:taskId', component: ProjectTaskDetailComponent, data: { breadcrumb: 'projects.detail.task' } },
      { path: 'board', component: ProjectBoardComponent, data: { breadcrumb: 'projects.tabs.board' } },
      { path: 'planning', component: ProjectPlanningComponent, data: { breadcrumb: 'projects.tabs.planning' } },
      { path: 'jalons', component: ProjectMilestonesComponent, data: { breadcrumb: 'projects.tabs.milestones' } },
      { path: 'sprints', component: ProjectSprintsComponent, data: { breadcrumb: 'projects.tabs.sprints' } },
      { path: 'backlog', component: ProjectBacklogComponent, data: { breadcrumb: 'projects.tabs.backlog' } },
      { path: 'temps', component: ProjectTimeComponent, data: { breadcrumb: 'projects.tabs.time' } },
      { path: 'livrables', component: ProjectDeliverablesComponent, data: { breadcrumb: 'projects.tabs.deliverables' } },
      { path: 'reunions', component: ProjectEventsComponent, data: { breadcrumb: 'projects.tabs.events' } },
      { path: 'equipe', component: ProjectTeamComponent, data: { breadcrumb: 'projects.tabs.team' } },
      { path: 'fichiers', component: ProjectFilesComponent, data: { breadcrumb: 'projects.tabs.files' } },
      { path: 'activite', component: ProjectActivityComponent, data: { breadcrumb: 'projects.tabs.activity' } },
      { path: 'risques', component: ProjectRisksComponent, data: { breadcrumb: 'projects.tabs.risks' } },
      { path: 'problemes', component: ProjectIssuesComponent, data: { breadcrumb: 'projects.tabs.issues' } },
      { path: 'rapports', component: ProjectReportsComponent, data: { breadcrumb: 'projects.tabs.reports' } },
      { path: 'calendrier', component: ProjectCalendarComponent, data: { breadcrumb: 'projects.tabs.calendar' } },
      { path: 'parametres', component: ProjectSettingsComponent, data: { breadcrumb: 'projects.tabs.settings' } },
    ],
  },
];
