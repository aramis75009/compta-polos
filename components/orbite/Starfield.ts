import * as THREE from "three";
import { disposeTree, type OrbiteBody } from "./three-utils";

// Champ d'étoiles : trois nappes (blanches, violettes, mint) sur des coquilles
// de rayons différents. Chacune dérive et scintille à son propre rythme —
// la parallaxe entre nappes donne la profondeur.

/** Positions pseudo-aléatoires mais DÉTERMINISTES sur une coquille sphérique. */
function shellPositions(
  count: number,
  minR: number,
  maxR: number,
  seed: number,
): Float32Array {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const r = minR + rand() * (maxR - minR);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  return pos;
}

type Layer = {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  baseOpacity: number;
  twinkleSpeed: number;
  seed: number;
};

const LAYERS = [
  { count: 700, radius: 34, color: 0xffffff, size: 0.07, seed: 12, opacity: 0.72, twinkle: 0.7 },
  { count: 140, radius: 26, color: 0xa855f7, size: 0.05, seed: 733, opacity: 0.6, twinkle: 1.1 },
  { count: 50, radius: 29, color: 0x47c98e, size: 0.06, seed: 4211, opacity: 0.5, twinkle: 0.9 },
];

export function createStarfield(): OrbiteBody {
  const group = new THREE.Group();
  const layers: Layer[] = [];

  for (const l of LAYERS) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        shellPositions(l.count, l.radius * 0.7, l.radius, l.seed),
        3,
      ),
    );
    const material = new THREE.PointsMaterial({
      color: l.color,
      size: l.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: l.opacity,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    group.add(points);
    layers.push({
      points,
      material,
      baseOpacity: l.opacity,
      twinkleSpeed: l.twinkle,
      seed: l.seed,
    });
  }

  return {
    object: group,
    hitTargets: [],
    update(t, dt) {
      for (const l of layers) {
        l.points.rotation.y += dt * 0.008;
        l.material.opacity =
          l.baseOpacity +
          Math.sin(t * l.twinkleSpeed + l.seed) * l.baseOpacity * 0.25;
      }
    },
    setDimmed() {
      /* le fond d'étoiles ne réagit pas au focus */
    },
    setActive() {
      /* non sélectionnable */
    },
    positionAt: () => new THREE.Vector3(0, 0, 0),
    dispose: () => disposeTree(group),
  };
}
