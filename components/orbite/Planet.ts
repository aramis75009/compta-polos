import * as THREE from "three";
import { disposeTree, type OrbiteBody } from "./three-utils";

// Planète centrale : sphère vert forêt (#1A5336), veinée d'un maillage mint
// (#47C98E) émissif qui pulse, enveloppée d'une atmosphère additive.
// Le rendu « veiné » vient d'un icosaèdre en fil de fer posé juste au-dessus
// de la surface : pas de shader custom à maintenir, et l'intensité se pilote
// comme une émissive classique.

const VITESSE_ROTATION = 0.08; // rad/s
const PERIODE_PULSE = 1.6; // rad/s

export function createPlanet(): OrbiteBody {
  const group = new THREE.Group();

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x1a5336,
    emissive: 0x47c98e,
    emissiveIntensity: 0.3,
    roughness: 0.68,
    metalness: 0.18,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), coreMat);

  const veinsMat = new THREE.MeshBasicMaterial({
    color: 0x47c98e,
    wireframe: true,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const veins = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), veinsMat);
  veins.scale.setScalar(1.008);

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x47c98e,
    transparent: true,
    opacity: 0.1,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), haloMat);
  halo.scale.setScalar(1.14);

  group.add(core, veins, halo);

  let dimmed = false;

  return {
    object: group,
    hitTargets: [],
    update(t, dt) {
      core.rotation.y += dt * VITESSE_ROTATION;
      veins.rotation.y += dt * VITESSE_ROTATION;
      veins.rotation.x += dt * VITESSE_ROTATION * 0.25;

      // Pulsation mint : émissive du noyau et opacité des veines, en phase.
      const pulse = (Math.sin(t * PERIODE_PULSE) + 1) / 2; // 0 → 1
      coreMat.emissiveIntensity = dimmed ? 0.08 : 0.22 + pulse * 0.22;
      veinsMat.opacity = dimmed ? 0.04 : 0.14 + pulse * 0.16;
      haloMat.opacity = dimmed ? 0.03 : 0.1;
      halo.scale.setScalar(1.14 + pulse * 0.02);
    },
    setDimmed(d) {
      dimmed = d;
      coreMat.color.set(d ? 0x0d2e1e : 0x1a5336);
    },
    setActive() {
      /* la planète n'est pas sélectionnable */
    },
    positionAt: () => new THREE.Vector3(0, 0, 0),
    dispose: () => disposeTree(group),
  };
}
