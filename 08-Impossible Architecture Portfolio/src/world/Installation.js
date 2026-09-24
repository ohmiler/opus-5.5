import * as THREE from 'three';
import { canvasTexture } from '../utils/textures.js';
import { drawPoster, drawScreen } from './posterArt.js';
import { damp } from '../utils/math.js';

/**
 * A portfolio work mounted in the architecture: 'poster', 'screen' or 'monolith'.
 * Exposes `group` for placement and `hit` for raycasting.
 */
export class Installation {
  constructor(project, { type = 'poster', width = 3.2, height = 4.5, materials }) {
    this.project = project;
    this.type = type;
    this.hover = 0;
    this.hoverTarget = 0;
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);

    const isScreen = type === 'screen';
    this.texture = isScreen
      ? canvasTexture(1440, Math.round((1440 * height) / width), (c, w, h) => drawScreen(c, w, h, project))
      : canvasTexture(1024, Math.round((1024 * height) / width), (c, w, h) => drawPoster(c, w, h, project));

    this.material = isScreen
      ? new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false, color: 0xd9d9d9 })
      : new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.82, metalness: 0 });

    this.hit = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.hit.position.z = 0.07;
    this.hit.receiveShadow = !isScreen;
    this.hit.userData.installation = this;
    this.inner.add(this.hit);

    const backing = type === 'monolith'
      ? new THREE.BoxGeometry(width + 1.4, height + 4, 1.4)
      : new THREE.BoxGeometry(width + 0.3, height + 0.3, 0.12);
    this.backing = new THREE.Mesh(backing, materials.dark);
    if (type === 'monolith') this.backing.position.set(0, 1.2, -0.64);
    this.backing.castShadow = this.backing.receiveShadow = true;
    this.inner.add(this.backing);

    // Accent rule under the work: grows on hover as a quiet affordance.
    this.rule = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.035), materials.accent);
    this.rule.position.set(0, -height / 2 - 0.32, 0.08);
    this.rule.scale.x = 0.001;
    this.inner.add(this.rule);
    this.baseZ = 0;
  }

  setHover(on) {
    this.hoverTarget = on ? 1 : 0;
  }

  update(dt, t) {
    this.hover = damp(this.hover, this.hoverTarget, 9, dt);
    const h = this.hover;
    this.inner.position.z = h * 0.22;
    this.rule.scale.x = Math.max(0.001, h);
    if (this.type === 'screen') {
      const flicker = 0.03 * Math.sin(t * 31) * Math.sin(t * 7.3);
      this.material.color.setScalar(0.82 + h * 0.3 + flicker);
    } else {
      this.material.emissive?.setScalar(h * 0.08);
    }
  }

  coverDataURL() {
    return this.texture.image.toDataURL('image/jpeg', 0.86);
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.hit.geometry.dispose();
    this.backing.geometry.dispose();
    this.rule.geometry.dispose();
  }
}
