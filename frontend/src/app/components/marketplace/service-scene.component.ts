import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Scène visuelle d'un produit (ServiceDetail).
 *
 * Architecture 3D progressive :
 *   - WebGL disponible + motion réduit désactivé → Three.js + GSAP
 *     (importés dynamiquement pour ne pas alourdir le bundle principal) ;
 *   - sinon → fallback CSS/SVG attrayant (même conteneur, aucune rupture).
 *
 * Chaque produit a un concept visuel distinct (workflow nodes, réseau,
 * timeline, organigramme…) via une config par clé.
 */
@Component({
  selector: 'app-service-scene',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS],
  templateUrl: './service-scene.component.html',
})
export class ServiceSceneComponent implements AfterViewInit, OnDestroy {
  @Input() productKey = 'servicedesk';
  @Input() color = '#6366f1';

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fallback', { static: true }) fallbackRef!: ElementRef<HTMLDivElement>;

  fallback = false;
  labelKey = '';

  private disposed = false;

  constructor() {}

  ngAfterViewInit(): void {
    this.labelKey = `scene.${this.productKey}.label`;
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const webgl = this.webglAvailable();

    if (!webgl || prefersReduced) {
      this.fallback = true;
      return;
    }
    // Chargement différé de Three.js + GSAP (hors bundle initial).
    import('three')
      .then(async (THREE) => {
        if (this.disposed) return;
        const gsapMod = await import('gsap');
        const gsap = gsapMod.gsap || gsapMod.default;
        this.buildScene(THREE, gsap);
      })
      .catch(() => {
        if (!this.disposed) this.fallback = true;
      });
  }

  private webglAvailable(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  /**
   * Construit la scène Three.js propre au produit — chaque produit a un
   * CONCEPT VISUEL distinct (workflow, réseau, timeline, organisation,
   * tunnel commercial, sauvegarde, IA…) plutôt qu'une forme générique.
   */
  private buildScene(THREE: any, gsap: any): void {
    const container = this.canvasRef.nativeElement;
    const canvas = container;
    const parent = canvas.parentElement as HTMLElement;
    const width = parent?.clientWidth || 480;
    const height = parent?.clientHeight || 360;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mobile = width < 480;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(dpr);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, mobile ? 9 : 10);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(4, 6, 6);
    scene.add(dir);

    const color = new THREE.Color(this.color);
    const group = new THREE.Group();
    scene.add(group);
    const disposables: { dispose(): void }[] = [];

    const mesh = (geo: any, mat: any) => {
      const m = new THREE.Mesh(geo, mat);
      disposables.push(geo, mat);
      group.add(m);
      return m;
    };
    const sphereMat = (c: any, opacity = 1) =>
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, transparent: opacity < 1, opacity });

    // ----- Concept par produit (config déclarative) -----
    const layout = this.sceneLayout(THREE, mobile);
    layout(group, mesh, sphereMat, color, disposables);

    // GSAP : entrée + rotation continue (subtle).
    const tl = gsap.timeline({ repeat: -1, ease: 'sine.inOut', duration: 14 });
    tl.to(group.rotation, { y: Math.PI * 2, duration: 26, repeat: -1, ease: 'none' });
    gsap.fromTo(
      group.scale,
      { x: 0.6, y: 0.6, z: 0.6 },
      { x: 1, y: 1, z: 1, duration: 1.2, ease: 'power2.out' }
    );

    const resize = () => {
      const w = parent?.clientWidth || 480;
      const h = parent?.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', resize);

    let raf = 0;
    const loop = () => {
      if (this.disposed) return;
      raf = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    loop();

    this.cleanup = () => {
      cancelAnimationFrame(raf);
      tl.kill();
      window.removeEventListener('resize', resize);
      disposables.forEach((d) => {
        try {
          d.dispose();
        } catch {
          /* ignore */
        }
      });
      renderer.dispose();
    };
  }

  private cleanup: (() => void) | null = null;

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.cleanup) this.cleanup();
  }

  /** Config visuelle déclarative par produit — concepts distincts. */
  private sceneLayout(THREE: any, mobile: boolean) {
    const count = mobile ? 6 : 9;
    const ringCount = mobile ? 3 : 6;
    const layouts: Record<string, any> = {
      // ServiceDesk : nœuds de workflow connectés (incident → analyse → résolution).
      servicedesk: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        const nodes: any[] = [];
        const nodeGeo = new THREE.SphereGeometry(0.28, 24, 24);
        const linkMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
        disp.push(nodeGeo, linkMat);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const n = mesh(nodeGeo.clone(), sphereMat(color));
          n.position.set(Math.cos(a) * 2.4, Math.sin(a) * 1.9, (i % 3) * 0.8 - 0.8);
          nodes.push(n);
        }
        for (let i = 0; i < nodes.length - 1; i++) {
          const geo = new THREE.BufferGeometry().setFromPoints([nodes[i].position.clone(), nodes[i + 1].position.clone()]);
          disp.push(geo);
          group.add(new THREE.Line(geo, linkMat));
        }
      },
      // Gestion de projet : timeline de jalons (barres successives).
      project_management: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        const w = mobile ? 0.4 : 0.55;
        for (let i = 0; i < 6; i++) {
          const h = 0.5 + (i % 3) * 0.45;
          const bar = mesh(
            new THREE.BoxGeometry(w, h, w),
            sphereMat(color, 0.55 + i * 0.07)
          );
          bar.position.set(-2.6 + i * 1.05, -1.4 + h / 2, 0);
        }
        const base = mesh(new THREE.BoxGeometry(6.2, 0.06, 0.06), new THREE.MeshBasicMaterial({ color, opacity: 0.35, transparent: true }));
        base.position.set(0, -1.5, 0.3);
      },
      // Parc / actifs : anneaux de rotation (véhicules/équipements en mouvement).
      fleet_management: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        for (let i = 0; i < ringCount; i++) {
          const ring = mesh(
            new THREE.TorusGeometry(1.6 + i * 0.55, 0.03, 8, 60),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 - i * 0.07 })
          );
          ring.rotation.x = Math.PI / 2.2 + i * 0.12;
          ring.rotation.y = i * 0.3;
        }
        const dot = mesh(new THREE.SphereGeometry(0.22, 20, 20), sphereMat(color));
        dot.position.set(3, 0.6, 0.4);
      },
      // RH : organigramme concentrique (personnes autour d'un cœur).
      hr_center: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        const core = mesh(new THREE.SphereGeometry(0.55, 28, 28), sphereMat(color));
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const p = mesh(new THREE.SphereGeometry(0.2, 18, 18), sphereMat(color, 0.7));
          p.position.set(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0);
        }
        for (let r = 1; r <= 2; r++) {
          const ring = mesh(
            new THREE.TorusGeometry(r * 2.2, 0.015, 6, 64),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 })
          );
          ring.rotation.x = Math.PI / 2;
        }
      },
      // CRM : tunnel commercial (cônes empilés).
      crm: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        for (let i = 0; i < 5; i++) {
          const cone = mesh(
            new THREE.ConeGeometry(1.7 - i * 0.28, 0.5, 24),
            sphereMat(color, 0.35 + i * 0.12)
          );
          cone.position.set(0, -1.6 + i * 0.75, 0);
        }
        const orb = mesh(new THREE.SphereGeometry(0.3, 20, 20), sphereMat(color));
        orb.position.set(0, 1.9, 0.2);
      },
      // Sécurité : bouclier stylisé (anneau + nœuds menaçants).
      security_center: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        const shield = mesh(
          new THREE.ConeGeometry(2.4, 0.08, 4, 1),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
        );
        shield.rotation.y = Math.PI / 4;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const n = mesh(new THREE.SphereGeometry(0.16, 16, 16), sphereMat(color, 0.8));
          n.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0.2);
        }
      },
      // Sauvegarde : blocs de données empilés + réplication.
      backup_management: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        for (let i = 0; i < 4; i++) {
          const b = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), sphereMat(color, 0.5 + i * 0.12));
          b.position.set(-1.4 + i * 0.95, -1.5 + i * 0.7, 0);
        }
        const rep = mesh(new THREE.SphereGeometry(0.24, 18, 18), sphereMat(color));
        rep.position.set(2.2, 0.9, 0.3);
      },
      // IA : réseau de neurones (grille de nœuds).
      ai_assistant: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        const linkMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 });
        disp.push(linkMat);
        const grid: any[] = [];
        for (let x = 0; x < 3; x++) {
          for (let y = 0; y < 3; y++) {
            const n = mesh(new THREE.SphereGeometry(0.18, 16, 16), sphereMat(color, 0.85));
            n.position.set((x - 1) * 1.3, (y - 1) * 1.3, 0);
            grid.push(n);
          }
        }
        for (let i = 0; i < grid.length - 1; i++) {
          const geo = new THREE.BufferGeometry().setFromPoints([grid[i].position.clone(), grid[i + 1].position.clone()]);
          disp.push(geo);
          group.add(new THREE.Line(geo, linkMat));
        }
      },
      // BI : barres de reporting.
      business_intelligence: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        for (let i = 0; i < 7; i++) {
          const h = 0.4 + ((i * 37) % 5) * 0.45;
          const b = mesh(new THREE.BoxGeometry(0.42, h, 0.42), sphereMat(color, 0.45 + i * 0.06));
          b.position.set(-2.8 + i * 0.93, -1.6 + h / 2, 0);
        }
      },
      // Monitoring : orbites de supervision.
      monitoring: (group: any, mesh: any, sphereMat: any, color: any, disp: any[]) => {
        const core = mesh(new THREE.SphereGeometry(0.5, 24, 24), sphereMat(color));
        for (let i = 0; i < ringCount; i++) {
          const ring = mesh(
            new THREE.TorusGeometry(1.8 + i * 0.5, 0.02, 8, 56),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 - i * 0.05 })
          );
          ring.rotation.x = Math.PI / 2.1 + i * 0.15;
        }
        const sat = mesh(new THREE.SphereGeometry(0.16, 16, 16), sphereMat(color, 0.9));
        sat.position.set(2.6, 0.8, 0.2);
      },
    };
    const fallback = layouts['servicedesk'];
    return layouts[this.productKey] || fallback;
  }
}
