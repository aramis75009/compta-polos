import * as THREE from "three";

// Socle commun des corps de la scène Orbite.
//
// La scène est écrite en three.js impératif (pas de react-three-fiber) : Next 15
// exécute React 19 côté client, et R3F v8 dépend de react-reconciler 0.27 qui
// lit les internals de React 18. Passer en three.js pur supprime purement et
// simplement ce couplage de versions.

/** Un corps de la scène : un objet 3D, animé, survolable, et jetable. */
export type OrbiteBody = {
  object: THREE.Object3D;
  /** Maillages soumis au raycast (souvent des cibles invisibles élargies). */
  hitTargets: THREE.Object3D[];
  /** Appelé à chaque frame. `t` = temps écoulé, `dt` = delta, en secondes. */
  update(t: number, dt: number): void;
  /** Estompe le corps quand un AUTRE corps est survolé. */
  setDimmed(dimmed: boolean): void;
  /** Met le corps en avant (survolé ou sélectionné). */
  setActive(active: boolean): void;
  /** Position monde à l'instant `t` — sert au focus caméra et aux labels. */
  positionAt(t: number): THREE.Vector3;
  dispose(): void;
};

/** Libère géométries et matériaux de tout un sous-arbre. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
      o.geometry.dispose();
      const mat = o.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}

/** Interpolation linéaire bornée. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/** Courbe d'accélération/décélération des voyages de caméra. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Matériau invisible mais toujours touché par le raycast (visible reste true). */
export function hitMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
}
