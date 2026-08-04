import * as THREE from "three";
import { ringRadius, ringTilt } from "@/lib/orbite/types";
import { disposeTree, hitMaterial, lerp, type OrbiteBody } from "./three-utils";

// Un anneau = une marque. L'épaisseur du tore est proportionnelle au CA, la
// couleur dit la rentabilité (mint = rentable, or/violet sinon). Un second tore
// invisible et bien plus épais sert de cible de pointage : viser un anneau fin
// à la souris est sinon impossible.

export function createOrbitRing({
  index,
  thickness,
  color,
}: {
  index: number;
  /** 0 → 1 : part du CA de la marque la plus forte. */
  thickness: number;
  color: number;
}): OrbiteBody {
  const radius = ringRadius(index);
  const [tiltX, tiltZ] = ringTilt(index);

  // Le groupe porte l'inclinaison, le tore tourne dans son propre plan.
  const group = new THREE.Group();
  group.rotation.set(tiltX, 0, tiltZ);

  const tube = 0.014 + thickness * 0.055;
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.55,
    roughness: 0.55,
    metalness: 0.45,
  });
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, 140),
    material,
  );

  const hit = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.12, 6, 64),
    hitMaterial(),
  );

  group.add(torus, hit);

  let dimmed = false;
  let active = false;

  const emissiveCible = () => (active ? 1.1 : dimmed ? 0.08 : 0.45);
  const opaciteCible = () => (active ? 0.95 : dimmed ? 0.12 : 0.55);

  return {
    object: group,
    hitTargets: [hit],
    update(_t, dt) {
      torus.rotation.z += dt * 0.02;
      hit.rotation.z = torus.rotation.z;
      material.emissiveIntensity = lerp(
        material.emissiveIntensity,
        emissiveCible(),
        dt * 8,
      );
      material.opacity = lerp(material.opacity, opaciteCible(), dt * 8);
    },
    setDimmed(d) {
      dimmed = d;
    },
    setActive(a) {
      active = a;
    },
    /** Un anneau n'a pas de position ponctuelle : on vise son centre. */
    positionAt: () => new THREE.Vector3(0, 0, 0),
    dispose: () => disposeTree(group),
  };
}
