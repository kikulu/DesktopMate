// manifest.vrm = { file, armAngle?: 1.2, zoom?: 1, rotationY?: 0(度) }
// 需要 `npm install`(three、@pixiv/three-vrm)。支援 VRM 0.x / 1.0。
// 以程式化姿勢驅動(不需要動作檔):待機呼吸、走路擺動、跳舞、睡覺低頭,另有眨眼與視線/頭部追蹤。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));

export async function create({ manifest, baseUrl, size, container }) {
  const cfg = manifest.vrm || {}, H = 1.6, arm = cfg.armAngle ?? 1.2;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(devicePixelRatio); renderer.setSize(size, size); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  cam.position.set(0, H/2, (H * 1.15 / 2) / Math.tan(THREE.MathUtils.degToRad(15)) / (cfg.zoom || 1));
  cam.lookAt(0, H/2, 0);

  const loader = new GLTFLoader(); loader.register(p => new VRMLoaderPlugin(p));
  const gltf = await loader.loadAsync(baseUrl + encodeURI(cfg.file || 'model.vrm'));
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('不是有效的 VRM 檔');
  VRMUtils.rotateVRM0 && VRMUtils.rotateVRM0(vrm);                     // VRM 0.x 轉成面向 +Z
  VRMUtils.removeUnnecessaryVertices && VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons && VRMUtils.combineSkeletons(gltf.scene);
  vrm.scene.traverse(o => { o.frustumCulled = false; });

  const box = new THREE.Box3().setFromObject(vrm.scene), sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  vrm.scene.position.set(-ctr.x, -box.min.y, -ctr.z);
  const pivot = new THREE.Group(); pivot.add(vrm.scene); pivot.scale.setScalar(H / (sz.y || 1)); scene.add(pivot);

  const bone = n => vrm.humanoid.getNormalizedBoneNode(n);
  const N = { hips: bone('hips'), spine: bone('spine'), head: bone('head'),
              lUA: bone('leftUpperArm'), rUA: bone('rightUpperArm'), lUL: bone('leftUpperLeg'), rUL: bone('rightUpperLeg') };
  const lookTarget = new THREE.Object3D(); scene.add(lookTarget);
  if (vrm.lookAt) vrm.lookAt.target = lookTarget;
  const em = vrm.expressionManager;

  // 每個狀態的目標姿勢(弧度);實際姿勢會平滑逼近目標
  const targetPose = (state, t, look) => {
    const T = { lAz: -arm, rAz: arm, lAx: 0, rAx: 0, lLx: 0, rLx: 0, spX: Math.sin(t * 1.6) * 0.02,
                hdX: 0, hdY: 0, hipY: 0, happy: 0, eye: 0 };
    const sw = Math.sin(t * (state === 'follow' ? 12 : 8));
    if (state === 'walk' || state === 'follow' || state === 'climb') { T.lLx = sw * 0.6; T.rLx = -sw * 0.6; T.lAx = -sw * 0.4; T.rAx = sw * 0.4; }
    else if (state === 'dance') { const a = 0.5 + 0.5 * Math.sin(t * 6); T.lAz = -arm + a * 2.4; T.rAz = arm - (1 - a) * 2.4; T.hipY = Math.sin(t * 6) * 0.35; T.happy = 1; }
    else if (state === 'jump') { T.lAz = -arm + 2.0; T.rAz = arm - 2.0; T.lLx = T.rLx = -0.4; T.happy = 1; }
    else if (state === 'drag') { T.lAz = -arm + 1.5; T.rAz = arm - 1.5; T.lLx = Math.sin(t * 5) * 0.3; T.rLx = -T.lLx; }
    if (state === 'sleep') { T.hdX = 0.45; T.spX = 0.12; T.eye = 1; }
    else { T.hdY = clamp(look.x / 400) * 0.4; T.hdX = clamp(look.y / 400) * 0.3; }
    return T;
  };
  const pose = targetPose('idle', 0, { x: 0, y: 0 });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const off = THREE.MathUtils.degToRad(cfg.rotationY || 0);
  let t = 0, yaw = 0, blinkTimer = 2, blinkHold = 0, cur = 'idle';

  return {
    handlesFlip: true,
    setState(s) { cur = s; },
    tick({ dt, dir, state, lookX, lookY }) {
      t += dt; cur = state;
      const T = targetPose(cur, t, { x: lookX, y: lookY }), k = Math.min(1, dt * 10);
      for (const key in T) pose[key] += (T[key] - pose[key]) * k;
      const set = (n, ax, v) => { if (n) n.rotation[ax] = v; };
      set(N.lUA, 'z', pose.lAz); set(N.rUA, 'z', pose.rAz); set(N.lUA, 'x', pose.lAx); set(N.rUA, 'x', pose.rAx);
      set(N.lUL, 'x', pose.lLx); set(N.rUL, 'x', pose.rLx);
      set(N.spine, 'x', pose.spX); set(N.hips, 'y', pose.hipY);
      set(N.head, 'x', pose.hdX); set(N.head, 'y', pose.hdY);

      blinkTimer -= dt; if (blinkTimer < 0) { blinkTimer = 2 + Math.random() * 3; blinkHold = 0.15; }
      const blink = blinkHold > 0 ? 1 : 0; blinkHold -= dt;
      if (em) { em.setValue('blink', Math.max(blink, pose.eye)); em.setValue('happy', pose.happy); }
      if (vrm.lookAt) lookTarget.position.set(clamp(lookX / 300) * 0.8, H * 0.9 - clamp(lookY / 300) * 0.5, 2);

      const moving = state === 'walk' || state === 'follow' || state === 'climb';
      yaw += ((moving ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : 0) - yaw) * Math.min(1, dt * 10);
      pivot.rotation.y = yaw + off;
      vrm.update(dt); renderer.render(scene, cam);
    },
    hitTest({ lx, ly }) {
      ndc.set(lx / size * 2 - 1, -(ly / size * 2 - 1)); ray.setFromCamera(ndc, cam);
      return ray.intersectObject(vrm.scene, true).length > 0;
    },
    destroy() {
      VRMUtils.deepDispose ? VRMUtils.deepDispose(vrm.scene) : scene.traverse(o => { o.geometry && o.geometry.dispose(); });
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    }
  };
}
