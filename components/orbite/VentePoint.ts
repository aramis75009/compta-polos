import * as THREE from "three";
import { disposeTree, hitMaterial, type OrbiteBody } from "./three-utils";

// Une vente récente = un point lumineux additif qui pulse, posé sur une
// coquille juste au-dessus de la planète. Couleur et phase de pulsation sont
// dérivées de l'id : stables d'un rendu à l'autre, et donc jamais clignotantes.

const COLORS = [0xa855f7, 0x47c98e, 0xf0c040];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function createVentePoint({
  id,
  position,
}: {
  id: string;
  position: [number, number, number];
}): OrbiteBody {
  const group = new THREE.Group();
  group.position.set(...position);

  const h = hashCode(id);
  const couleur = COLORS[h % COLORS.length];
  const phase = ((h % 100) / 100) * Math.PI * 2;

  const material = new THREE.MeshBasicMaterial({
    color: couleur,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const point = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 14), material);

  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), hitMaterial());

  group.add(point, hit);

  let active = false;

  return {
    object: group,
    hitTargets: [hit],
    update(t) {
      const pulse = 1 + Math.sin(t * 2.4 + phase) * 0.28;
      point.scale.setScalar(active ? pulse * 1.9 : pulse);
    },
    setDimmed(d) {
      material.opacity = d ? 0.12 : 0.92;
    },
    setActive(a) {
      active = a;
      material.color.set(a ? 0xffffff : couleur);
    },
    positionAt: () => new THREE.Vector3(...position),
    dispose: () => disposeTree(group),
  };
}
