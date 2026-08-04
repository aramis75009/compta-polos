import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  moonRadius,
  ringRadius,
  type OrbiteData,
  type OrbiteSelection,
} from "@/lib/orbite/types";
import { createStarfield } from "./Starfield";
import { createPlanet } from "./Planet";
import { createMoon } from "./Moon";
import { createOrbitRing } from "./OrbitRing";
import { createVentePoint } from "./VentePoint";
import { disposeTree, easeInOutCubic, type OrbiteBody } from "./three-utils";

// Moteur de la scène Orbite, en three.js impératif.
// Monte le renderer dans un conteneur, assemble les corps depuis les données,
// gère survol / clic / focus caméra, et sait tout défaire (dispose).

/** Position de repos de la caméra : planète, anneaux et orbites tiennent au cadre. */
const CAMERA_REPOS = new THREE.Vector3(0, 2.4, 7.6);
/** Au-delà de ce déplacement du curseur, on considère que l'utilisateur a dragué. */
const SEUIL_CLIC_PX = 5;

type Cadrage = { lookAt: THREE.Vector3; camera: THREE.Vector3 };

type Entry = {
  selection: OrbiteSelection;
  body: OrbiteBody;
  /** Où poser la caméra pour « voyager » vers ce corps, à l'instant t. */
  cadrage: (t: number) => Cadrage;
  label?: HTMLElement;
  /** Le label n'est visible que si le corps est actif (survolé/sélectionné). */
  labelSeulementActif: boolean;
};

export type OrbiteSceneHandle = {
  setSelected(selection: OrbiteSelection | null): void;
  dispose(): void;
};

const memeSelection = (
  a: OrbiteSelection | null,
  b: OrbiteSelection | null,
) => a?.kind === b?.kind && a?.id === b?.id;

/** Petit label flottant en DOM, projeté au-dessus de son corps 3D. */
function creerLabel(texte: string, discret: boolean): HTMLElement {
  const el = document.createElement("div");
  el.textContent = texte;
  el.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    "pointer-events:none",
    "user-select:none",
    "white-space:nowrap",
    "border-radius:10px",
    "font-weight:600",
    "color:#fff",
    "backdrop-filter:blur(8px)",
    "transition:opacity 200ms,background 200ms,border-color 200ms",
    discret ? "padding:4px 9px" : "padding:6px 12px",
    discret ? "font-size:11px" : "font-size:13px",
    discret
      ? "background:rgba(20,10,38,.55);border:1px solid rgba(168,85,247,.28)"
      : "background:rgba(124,58,237,.92);border:1px solid rgba(168,85,247,.8)",
  ].join(";");
  return el;
}

export function createOrbiteScene({
  container,
  data,
  onSelect,
}: {
  container: HTMLElement;
  data: OrbiteData;
  onSelect: (selection: OrbiteSelection | null) => void;
}): OrbiteSceneHandle {
  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.1,
    200,
  );
  camera.position.copy(CAMERA_REPOS);

  // Couche DOM des labels, au-dessus du canvas mais transparente aux clics.
  const calqueLabels = document.createElement("div");
  calqueLabels.style.cssText =
    "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  container.appendChild(calqueLabels);

  // Lumières directionnelles : contrairement aux PointLight, leur intensité ne
  // dépend pas de la distance — le rendu reste prévisible quel que soit le zoom.
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xe8e0f0, 2.2);
  key.position.set(6, 5, 5);
  const fillMint = new THREE.DirectionalLight(0x47c98e, 0.5);
  fillMint.position.set(-4, -2, 3);
  const rimViolet = new THREE.DirectionalLight(0xa855f7, 0.6);
  rimViolet.position.set(0, 3, -6);
  scene.add(key, fillMint, rimViolet);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 22;
  controls.autoRotateSpeed = 0.28;

  const reduitLesAnimations =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotate = !reduitLesAnimations;

  // ── Assemblage des corps ────────────────────────────────────────────────

  const decor: OrbiteBody[] = [];
  const entries: Entry[] = [];

  const starfield = createStarfield();
  const planet = createPlanet();
  decor.push(starfield, planet);
  scene.add(starfield.object, planet.object);

  const caMax = Math.max(1, ...data.marques.map((m) => m.ca));

  data.marques.forEach((m, i) => {
    const body = createOrbitRing({
      index: i,
      thickness: m.ca / caMax,
      // Rentable → mint. Sinon or, alterné de violet pour la variété.
      color: m.rentable ? 0x47c98e : i % 2 === 0 ? 0xf0c040 : 0xa855f7,
    });
    const R = ringRadius(i);
    entries.push({
      selection: { kind: "marque", id: m.nom },
      body,
      cadrage: () => ({
        lookAt: new THREE.Vector3(0, 0, 0),
        camera: new THREE.Vector3(R * 1.15, R * 0.8, R * 1.75),
      }),
      labelSeulementActif: true,
    });
    scene.add(body.object);
  });

  data.comptes.forEach((c, i) => {
    const body = createMoon({ index: i, size: c.size });
    const r = moonRadius(c.size);
    const label = creerLabel(
      c.avis > 0 ? `${c.label} · ${c.avis} avis` : c.label,
      true,
    );
    calqueLabels.appendChild(label);
    entries.push({
      selection: { kind: "compte", id: c.id },
      body,
      cadrage: (t) => {
        const pos = body.positionAt(t);
        // On se place dans l'axe planète → lune, en retrait : la planète
        // reste visible derrière la lune.
        const dir = pos.clone().normalize();
        return {
          lookAt: pos,
          camera: pos
            .clone()
            .add(dir.multiplyScalar(r * 6 + 1.3))
            .add(new THREE.Vector3(0, r * 2.4, 0)),
        };
      },
      label,
      labelSeulementActif: false,
    });
    scene.add(body.object);
  });

  data.ventesRecentes.forEach((v) => {
    const body = createVentePoint({ id: v.id, position: v.position });
    const label = creerLabel(v.sku, false);
    label.style.opacity = "0";
    calqueLabels.appendChild(label);
    entries.push({
      selection: { kind: "vente", id: v.id },
      body,
      cadrage: () => {
        const pos = new THREE.Vector3(...v.position);
        const dir = pos.clone().normalize();
        return {
          lookAt: pos,
          camera: pos
            .clone()
            .add(dir.multiplyScalar(1.5))
            .add(new THREE.Vector3(0, 0.3, 0)),
        };
      },
      label,
      labelSeulementActif: true,
    });
    scene.add(body.object);
  });

  // Index cible de raycast → entrée, pour retrouver le corps touché en O(1).
  const parCible = new Map<string, Entry>();
  const cibles: THREE.Object3D[] = [];
  for (const e of entries) {
    for (const h of e.body.hitTargets) {
      parCible.set(h.uuid, e);
      cibles.push(h);
    }
  }

  // ── Interaction ─────────────────────────────────────────────────────────

  const raycaster = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  let survole: Entry | null = null;
  let selectionne: OrbiteSelection | null = null;
  let departClic: { x: number; y: number } | null = null;

  const entreeSous = (ev: PointerEvent): Entry | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointeur.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointeur.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointeur, camera);
    const touches = raycaster.intersectObjects(cibles, false);
    return touches.length ? (parCible.get(touches[0].object.uuid) ?? null) : null;
  };

  const appliquerEtats = () => {
    for (const e of entries) {
      const actif =
        (survole !== null && memeSelection(survole.selection, e.selection)) ||
        memeSelection(selectionne, e.selection);
      e.body.setActive(actif);
      e.body.setDimmed(
        survole !== null && !memeSelection(survole.selection, e.selection),
      );
    }
    planet.setDimmed(survole !== null);
  };

  const onPointerMove = (ev: PointerEvent) => {
    const e = entreeSous(ev);
    if (e === survole) return;
    survole = e;
    renderer.domElement.style.cursor = e ? "pointer" : "auto";
    appliquerEtats();
  };

  const onPointerDown = (ev: PointerEvent) => {
    departClic = { x: ev.clientX, y: ev.clientY };
    // Dès que l'utilisateur prend la main, l'auto-rotation ne revient pas :
    // reprendre en pleine inspection serait désagréable.
    controls.autoRotate = false;
  };

  const onPointerUp = (ev: PointerEvent) => {
    if (!departClic) return;
    const bouge =
      Math.abs(ev.clientX - departClic.x) > SEUIL_CLIC_PX ||
      Math.abs(ev.clientY - departClic.y) > SEUIL_CLIC_PX;
    departClic = null;
    if (bouge) return; // c'était une rotation, pas un clic

    const e = entreeSous(ev);
    // Clic dans le vide → on referme la sélection.
    onSelect(e && !memeSelection(selectionne, e.selection) ? e.selection : null);
  };

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);

  // ── Voyage de caméra ────────────────────────────────────────────────────

  let voyage: {
    depuisCam: THREE.Vector3;
    depuisTarget: THREE.Vector3;
    avancement: number;
  } | null = null;

  const cadragePour = (t: number): Cadrage => {
    const e = entries.find((x) => memeSelection(x.selection, selectionne));
    if (!e) {
      return { lookAt: new THREE.Vector3(0, 0, 0), camera: CAMERA_REPOS.clone() };
    }
    return e.cadrage(t);
  };

  // ── Redimensionnement ───────────────────────────────────────────────────

  const redimensionner = () => {
    const w = container.clientWidth;
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(redimensionner);
  observer.observe(container);

  // ── Boucle de rendu ─────────────────────────────────────────────────────

  // Horloge maison : THREE.Clock est déprécié depuis three 0.185, et
  // performance.now() suffit largement ici. `dt` est borné pour qu'un retour
  // d'onglet en arrière-plan ne fasse pas bondir la scène d'un coup.
  let derniereFrame = performance.now();
  let t = 0;
  let raf = 0;
  const projete = new THREE.Vector3();

  const boucle = () => {
    raf = requestAnimationFrame(boucle);
    const maintenant = performance.now();
    const dt = Math.min(0.05, (maintenant - derniereFrame) / 1000);
    derniereFrame = maintenant;
    t += dt;

    for (const d of decor) d.update(t, dt);
    for (const e of entries) e.body.update(t, dt);

    if (voyage) {
      voyage.avancement = Math.min(1, voyage.avancement + dt * 1.1);
      const k = easeInOutCubic(voyage.avancement);
      const cible = cadragePour(t);
      camera.position.lerpVectors(voyage.depuisCam, cible.camera, k);
      controls.target.lerpVectors(voyage.depuisTarget, cible.lookAt, k);
      if (voyage.avancement >= 1) {
        voyage = null;
        controls.enabled = true;
      }
    }

    controls.update();

    // Labels : projection 3D → écran, mise à jour directe du style (pas de
    // state React, qui provoquerait un rendu à 60 images par seconde).
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const e of entries) {
      if (!e.label) continue;
      const actif =
        (survole !== null && memeSelection(survole.selection, e.selection)) ||
        memeSelection(selectionne, e.selection);
      if (e.labelSeulementActif && !actif) {
        e.label.style.opacity = "0";
        continue;
      }
      projete.copy(e.body.positionAt(t)).project(camera);
      if (projete.z > 1) {
        e.label.style.opacity = "0";
        continue;
      }
      const x = (projete.x * 0.5 + 0.5) * w;
      const y = (-projete.y * 0.5 + 0.5) * h;
      e.label.style.transform = `translate(-50%,-165%) translate(${x}px,${y}px)`;
      e.label.style.opacity = actif ? "1" : survole !== null ? "0.25" : "0.85";
      if (!e.labelSeulementActif) {
        e.label.style.background = actif
          ? "rgba(124,58,237,.92)"
          : "rgba(20,10,38,.55)";
      }
    }

    renderer.render(scene, camera);
  };
  boucle();

  // ── Poignée exposée à React ─────────────────────────────────────────────

  return {
    setSelected(selection) {
      if (memeSelection(selection, selectionne)) return;
      selectionne = selection;
      if (selection) controls.autoRotate = false;
      voyage = {
        depuisCam: camera.position.clone(),
        depuisTarget: controls.target.clone(),
        avancement: 0,
      };
      // Pendant le voyage, OrbitControls est neutralisé : sinon les deux se
      // disputent la position de la caméra et l'image tremble.
      controls.enabled = false;
      appliquerEtats();
    },

    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      for (const d of decor) d.dispose();
      for (const e of entries) e.body.dispose();
      disposeTree(scene);
      scene.clear();
      renderer.dispose();
      calqueLabels.remove();
      renderer.domElement.remove();
    },
  };
}
