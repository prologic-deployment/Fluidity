import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  template: `
    <div class="flex h-screen w-full overflow-hidden bg-muted/30">
      <app-sidebar></app-sidebar>
      <div class="flex-1 overflow-y-auto">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
})
export class ShellComponent {}
