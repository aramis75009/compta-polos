import * as THREE from "three";
import { moonPositionAt, moonRadius } from "@/lib/orbite/types";
import { disposeTree, hitMaterial, lerp, type OrbiteBody } from "./three-utils";

// Une lune = un compte de vente. Sa taille est proportionnelle aux avis (le
// compte Pro est visiblement plus gros). Sa position vient de `moonPositionAt`,
// fonction pure du temps : la caméra et le label évaluent la même formule et
// visent donc exactement là où la lune est affichée.

export function createMoon({
  index,
  size,
}: {
  index: number;
  size: number;
}): OrbiteBody {
  const group = new THREE.Group();
  const r = moonRadius(size);

  const material = new THREE.MeshStandardMaterial({
    color: 0xe8e0f0,
    emissive: 0x47c98e,
    emissiveIntensity: 0.28,
    roughness: 0.45,
    metalness: 0.35,
    transparent: true,
    opacity: 1,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32), material);

  // Halo violet, révélé au survol / à la sélection.
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), haloMat);
  halo.scale.setScalar(1.55);

  // Cible de pointage élargie : viser une petite lune en mouvement est ingrat.
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(r * 1.9, 0.22), 12, 12),
    hitMaterial(),
  );

  group.add(sphere, halo, hit);

  let dimmed = false;
  let active = false;
  let echelle = 1;

  return {
    object: group,
    hitTargets: [hit],
    update(t, dt) {
      const [x, y, z] = moonPositionAt(index, t);
      group.position.set(x, y, z);
      sphere.rotation.y += (active ? 0.02 : 0.005) * dt * 60;

      // Grossissement doux vers l'état cible plutôt qu'un saut brutal.
      echelle = lerp(echelle, active ? 1.28 : 1, dt * 8);
      sphere.scale.setScalar(echelle);
      haloMat.opacity = lerp(haloMat.opacity, active ? 0.16 : 0, dt * 8);
    },
    setDimmed(d) {
      dimmed = d;
      material.color.set(d ? 0x25213a : 0xe8e0f0);
      material.opacity = d ? 0.28 : 1;
      if (!active) material.emissiveIntensity = d ? 0.04 : 0.28;
    },
    setActive(a) {
      active = a;
      material.emissive.set(a ? 0xa855f7 : 0x47c98e);
      material.emissiveIntensity = a ? 0.85 : dimmed ? 0.04 : 0.28;
    },
    positionAt: (t) => new THREE.Vector3(...moonPositionAt(index, t)),
    dispose: () => disposeTree(group),
  };
}
