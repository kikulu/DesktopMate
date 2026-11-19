// manifest.model3d = { file, zoom?, rotationY?(度), animations?: { idle:"Clip名", walk:"…", … } }
// 需要 `npm install`(three)。支援 .glb / .gltf。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const GUESS = { idle: /idle|stand|breath/i, walk: /walk|run/i, follow: /run|walk/i, climb: /climb|walk/i,
                dance: /dance/i, sleep: /sleep|lie|rest/i, jump: /jump/i, drag: /fall|hang|drag|idle/i };

export async function create({ manifest, baseUrl, size, container }) {
  const cfg = manifest.model3d || {}, H = 1.6;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(devicePixelRatio); renderer.setSize(size, size); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, H/2, (H * 1.15 / 2) / Math.tan(THREE.MathUtils.degToRad(15)) / (cfg.zoom || 1));
  cam.lookAt(0, H/2, 0);

  const gltf = await new GLTFLoader().loadAsync(baseUrl + encodeURI(cfg.file || 'model.glb'));
  const model = gltf.scene, box = new THREE.Box3().setFromObject(model);
  const sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  model.position.set(-ctr.x, -box.min.y, -ctr.z);              // 腳底置中
  const pivot = new THREE.Group(); pivot.add(model); pivot.scale.setScalar(H / (sz.y || 1)); scene.add(pivot);

  const mixer = new THREE.AnimationMixer(model), clips = gltf.animations || [];
  const find = s => {
    const byName = n => clips.find(c => c.name === n);
    return (cfg.animations?.[s] && byName(cfg.animations[s])) || clips.find(c => GUESS[s]?.test(c.name))
        || (cfg.animations?.idle && byName(cfg.animations.idle)) || clips.find(c => GUESS.idle.test(c.name)) || clips[0];
  };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let action = null, curState = null, yaw = 0, targetYaw = 0;
  const off = THREE.MathUtils.degToRad(cfg.rotationY || 0);

  return {
    handlesFlip: true,
    setState(s) {
      if (s === curState) return; curState = s;
      const clip = find(s); if (!clip) return;
      const next = mixer.clipAction(clip); if (next === action) return;
      next.reset().fadeIn(0.25).play(); action && action.fadeOut(0.25); action = next;
    },
    tick({ dt, dir, state }) {
      const moving = ['walk', 'follow', 'climb'].includes(state);
      targetYaw = moving ? (dir > 0 ? Math.PI/2 : -Math.PI/2) : 0;   // 移動時面向行進方向,其餘面向螢幕
      yaw += (targetYaw - yaw) * Math.min(1, dt * 10);
      pivot.rotation.y = yaw + off;
      mixer.update(dt); renderer.render(scene, cam);
    },
    hitTest({ lx, ly }) {                       // 射線檢測:有打到模型才算
      ndc.set(lx / size * 2 - 1, -(ly / size * 2 - 1)); ray.setFromCamera(ndc, cam);
      return ray.intersectObject(model, true).length > 0;
    },
    destroy() {
      scene.traverse(o => { o.geometry && o.geometry.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    }
  };
}
