// three.js renderer for the match: stadium, pitch, animated low-poly players, ball, cameras.
import * as THREE from 'three';

export interface KitInfo { shirt: string; shirt2: string; pattern: string; shorts: string; socks: string; gk: string }
export interface RenderPlayer { idx: number; side: number; shirt: number; isGK: boolean; name: string }

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673a'];
const HAIR = ['#2b1d0e', '#4a3420', '#111111', '#8b6b3a', '#d6b370', '#6b3e1f'];

function hashN(n: number) { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; return (x >>> 0); }

export class Match3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  players = new Map<number, { g: THREE.Group; body: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group; shadow: THREE.Mesh; phase: number; face: number; info: RenderPlayer }>();
  ball: THREE.Mesh;
  ballShadow: THREE.Mesh;
  camMode = 0;
  camPos = new THREE.Vector3(0, 30, 60);
  camLook = new THREE.Vector3(0, 0, 0);
  kits: [KitInfo, KitInfo];
  geo: Record<string, THREE.BufferGeometry> = {};
  mats: Record<string, THREE.Material> = {};
  zoom = 1;
  disposed = false;

  constructor(container: HTMLElement, kits: [KitInfo, KitInfo], homeCrowd: string) {
    this.container = container;
    this.kits = kits;
    const w = container.clientWidth || 800, h = container.clientHeight || 450;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1a2b');
    this.scene.fog = new THREE.Fog('#0b1a2b', 120, 260);
    this.camera = new THREE.PerspectiveCamera(34, w / h, 0.5, 600);
    this.scene.add(new THREE.HemisphereLight('#dfe9ff', '#36502f', 1.4));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(-30, 80, 40);
    this.scene.add(sun);
    this.buildPitch();
    this.buildStadium(homeCrowd);
    this.buildGoals();
    // shared geometries
    this.geo.torso = new THREE.BoxGeometry(0.44, 0.56, 0.25);
    this.geo.shorts = new THREE.BoxGeometry(0.42, 0.24, 0.26);
    this.geo.leg = new THREE.CylinderGeometry(0.075, 0.062, 0.8, 7);
    this.geo.leg.translate(0, -0.4, 0);
    this.geo.boot = new THREE.BoxGeometry(0.11, 0.08, 0.24);
    this.geo.arm = new THREE.CylinderGeometry(0.055, 0.045, 0.56, 6);
    this.geo.arm.translate(0, -0.28, 0);
    this.geo.head = new THREE.SphereGeometry(0.125, 12, 10);
    this.geo.hair = new THREE.SphereGeometry(0.132, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    this.geo.shadow = new THREE.CircleGeometry(0.42, 14);
    this.mats.shadow = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false });
    this.mats.boot = new THREE.MeshLambertMaterial({ color: '#111' });
    // ball
    const bt = document.createElement('canvas');
    bt.width = 128; bt.height = 64;
    const bc = bt.getContext('2d')!;
    bc.fillStyle = '#fff'; bc.fillRect(0, 0, 128, 64);
    bc.fillStyle = '#222';
    for (let i = 0; i < 9; i++) { bc.beginPath(); bc.arc((i * 37) % 128, (i * 23) % 64, 6, 0, Math.PI * 2); bc.fill(); }
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(bt) }));
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), this.mats.shadow);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballShadow);
    window.addEventListener('resize', this.onResize);
  }

  onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  buildPitch() {
    const S = 10; // px per meter
    const W = 121, H = 84; // with margins 8m
    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    const c = cv.getContext('2d')!;
    const ox = 8 * S, oy = 8 * S;
    c.fillStyle = '#2a7a3b'; c.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 20; i++) {
      c.fillStyle = i % 2 ? '#2f8a43' : '#2a7d3d';
      c.fillRect(ox + i * 5.25 * S, oy, 5.25 * S + 1, 68 * S);
    }
    c.strokeStyle = 'rgba(255,255,255,0.92)'; c.lineWidth = 0.13 * S;
    const R = (x: number, y: number, w: number, h: number) => c.strokeRect(ox + x * S, oy + y * S, w * S, h * S);
    R(0, 0, 105, 68);
    c.beginPath(); c.moveTo(ox + 52.5 * S, oy); c.lineTo(ox + 52.5 * S, oy + 68 * S); c.stroke();
    c.beginPath(); c.arc(ox + 52.5 * S, oy + 34 * S, 9.15 * S, 0, Math.PI * 2); c.stroke();
    R(0, 34 - 20.16, 16.5, 40.32); R(105 - 16.5, 34 - 20.16, 16.5, 40.32);
    R(0, 34 - 9.16, 5.5, 18.32); R(105 - 5.5, 34 - 9.16, 5.5, 18.32);
    c.fillStyle = '#fff';
    for (const [x, y] of [[11, 34], [94, 34], [52.5, 34]]) { c.beginPath(); c.arc(ox + x * S, oy + y * S, 0.3 * S, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(ox + 11 * S, oy + 34 * S, 9.15 * S, -0.93, 0.93); c.stroke();
    c.beginPath(); c.arc(ox + 94 * S, oy + 34 * S, 9.15 * S, Math.PI - 0.93, Math.PI + 0.93); c.stroke();
    for (const [x, y, a] of [[0, 0, 0], [105, 0, Math.PI / 2], [105, 68, Math.PI], [0, 68, -Math.PI / 2]]) { c.beginPath(); c.arc(ox + x * S, oy + y * S, 1 * S, a, a + Math.PI / 2); c.stroke(); }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    // surrounding track
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(150, 115), new THREE.MeshLambertMaterial({ color: '#2b3a2f' }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.02;
    this.scene.add(ring);
  }

  buildStadium(homeCrowd: string) {
    const crowd = (w: number, h: number) => {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 128;
      const c = cv.getContext('2d')!;
      c.fillStyle = '#1b2230'; c.fillRect(0, 0, 512, 128);
      const cols = [homeCrowd, homeCrowd, '#ffffff', '#c9c9c9', '#333a48', '#7a2030', '#204070'];
      for (let i = 0; i < 2600; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(Math.random() * 512, Math.random() * 128, 3, 3); }
      for (let r = 0; r < 128; r += 8) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, r, 512, 1); }
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(w / 30, 1);
      t.colorSpace = THREE.SRGBColorSpace;
      void h;
      return t;
    };
    const mk = (len: number, x: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      const tribune = new THREE.Mesh(new THREE.PlaneGeometry(len, 26), new THREE.MeshLambertMaterial({ map: crowd(len, 26), side: THREE.DoubleSide }));
      tribune.rotation.x = -Math.PI / 2 + 0.55;
      tribune.position.set(0, 10.5, 0);
      g.add(tribune);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 16), new THREE.MeshLambertMaterial({ color: '#39424f' }));
      roof.position.set(0, 23, -6);
      g.add(roof);
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, 24, 0.6), new THREE.MeshLambertMaterial({ color: '#232b38' }));
      back.position.set(0, 11, -11.5);
      g.add(back);
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      this.scene.add(g);
    };
    mk(130, 0, -55, 0);
    mk(130, 0, 55, Math.PI);
    mk(90, -75, 0, Math.PI / 2);
    mk(90, 75, 0, -Math.PI / 2);
    // advertising boards
    const adc = document.createElement('canvas');
    adc.width = 1024; adc.height = 64;
    const a = adc.getContext('2d')!;
    const ads = ['ULTIMATE MANAGER', 'FOOTBALL', 'UEFA', 'GOAL!', 'STADIUM', 'SPORT TV'];
    for (let i = 0; i < 6; i++) { a.fillStyle = ['#0b3d91', '#c8102e', '#111', '#f5c518', '#16894a', '#5d2d8f'][i]; a.fillRect(i * 171, 0, 171, 64); a.fillStyle = i === 3 ? '#111' : '#fff'; a.font = 'bold 26px Arial'; a.fillText(ads[i], i * 171 + 8, 42); }
    const adt = new THREE.CanvasTexture(adc);
    adt.wrapS = THREE.RepeatWrapping; adt.repeat.set(4, 1);
    adt.colorSpace = THREE.SRGBColorSpace;
    for (const [z, ry] of [[-38.5, 0], [38.5, Math.PI]] as const) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(110, 1), new THREE.MeshBasicMaterial({ map: adt }));
      b.position.set(0, 0.5, z);
      b.rotation.y = ry;
      this.scene.add(b);
    }
    // floodlights
    for (const [x, z] of [[-70, -50], [70, -50], [-70, 50], [70, 50]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 40, 6), new THREE.MeshLambertMaterial({ color: '#555c66' }));
      pole.position.set(x, 20, z);
      this.scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 1), new THREE.MeshBasicMaterial({ color: '#fffbe0' }));
      lamp.position.set(x, 40, z);
      lamp.lookAt(0, 0, 0);
      this.scene.add(lamp);
    }
  }

  buildGoals() {
    const postMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const netMat = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.35 });
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      const post = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8);
      for (const z of [-3.66, 3.66]) {
        const p = new THREE.Mesh(post, postMat);
        p.position.set(0, 1.22, z);
        g.add(p);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 8), postMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0, 2.44, 0);
      g.add(bar);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44, 18, 6), netMat);
      back.position.set(sx * 1.8, 1.22, 0);
      back.rotation.y = Math.PI / 2;
      g.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 7.32, 4, 18), netMat);
      top.rotation.x = Math.PI / 2;
      top.position.set(sx * 0.9, 2.44, 0);
      g.add(top);
      for (const z of [-3.66, 3.66]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.44, 4, 6), netMat);
        side.position.set(sx * 0.9, 1.22, z);
        g.add(side);
      }
      g.position.set(sx * 52.5, 0, 0);
      this.scene.add(g);
    }
  }

  shirtTexture(kit: KitInfo, number: number, gk: boolean): THREE.Texture {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const c = cv.getContext('2d')!;
    const base = gk ? kit.gk : kit.shirt;
    c.fillStyle = base; c.fillRect(0, 0, 128, 128);
    if (!gk) {
      c.fillStyle = kit.shirt2;
      if (kit.pattern === 's') for (let x = 10; x < 128; x += 32) c.fillRect(x, 0, 14, 128);
      if (kit.pattern === 'h') for (let y = 14; y < 128; y += 36) c.fillRect(0, y, 128, 16);
      if (kit.pattern === 'q') c.fillRect(64, 0, 64, 128);
      if (kit.pattern === 'x') { c.beginPath(); c.moveTo(0, 20); c.lineTo(20, 0); c.lineTo(128, 108); c.lineTo(108, 128); c.fill(); }
    }
    c.font = 'bold 54px Arial';
    c.textAlign = 'center';
    const lum = parseInt(base.slice(1, 3), 16) * 0.3 + parseInt(base.slice(3, 5), 16) * 0.59 + parseInt(base.slice(5, 7), 16) * 0.11;
    c.fillStyle = lum > 150 ? '#111' : '#fff';
    c.strokeStyle = lum > 150 ? '#fff' : '#000';
    c.lineWidth = 3;
    c.strokeText(String(number), 64, 84);
    c.fillText(String(number), 64, 84);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  ensurePlayer(info: RenderPlayer) {
    let pl = this.players.get(info.idx);
    if (pl) return pl;
    const kit = this.kits[info.side];
    const h = hashN(info.idx * 7 + info.shirt);
    const skin = new THREE.MeshLambertMaterial({ color: SKIN[h % SKIN.length] });
    const hair = new THREE.MeshLambertMaterial({ color: HAIR[(h >> 3) % HAIR.length] });
    const shirtTex = this.shirtTexture(kit, info.shirt, info.isGK);
    const shirtMat = new THREE.MeshLambertMaterial({ map: shirtTex });
    const sleeve = new THREE.MeshLambertMaterial({ color: info.isGK ? kit.gk : kit.shirt });
    const shorts = new THREE.MeshLambertMaterial({ color: info.isGK ? '#222222' : kit.shorts });
    const socks = new THREE.MeshLambertMaterial({ color: info.isGK ? kit.gk : kit.socks });
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const torso = new THREE.Mesh(this.geo.torso, shirtMat);
    torso.position.y = 1.18;
    body.add(torso);
    const sh = new THREE.Mesh(this.geo.shorts, shorts);
    sh.position.y = 0.86;
    body.add(sh);
    const head = new THREE.Mesh(this.geo.head, skin);
    head.position.y = 1.6;
    body.add(head);
    const hr = new THREE.Mesh(this.geo.hair, hair);
    hr.position.y = 1.62;
    body.add(hr);
    const mkLeg = (x: number) => {
      const lg = new THREE.Group();
      lg.position.set(x, 0.8, 0);
      const leg = new THREE.Mesh(this.geo.leg, socks);
      lg.add(leg);
      const boot = new THREE.Mesh(this.geo.boot, this.mats.boot);
      boot.position.set(0, -0.78, 0.05);
      lg.add(boot);
      body.add(lg);
      return lg;
    };
    const mkArm = (x: number) => {
      const ag = new THREE.Group();
      ag.position.set(x, 1.42, 0);
      const arm = new THREE.Mesh(this.geo.arm, sleeve);
      ag.add(arm);
      body.add(ag);
      return ag;
    };
    const legL = mkLeg(-0.11), legR = mkLeg(0.11);
    const armL = mkArm(-0.29), armR = mkArm(0.29);
    const shadow = new THREE.Mesh(this.geo.shadow, this.mats.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    const sc = 1.0;
    g.scale.set(sc, sc, sc);
    this.scene.add(g);
    pl = { g, body, legL, legR, armL, armR, shadow, phase: Math.random() * 6, face: 0, info };
    this.players.set(info.idx, pl);
    return pl;
  }

  /** frame: positions (field coords), velocities, acts */
  update(
    list: { info: RenderPlayer; x: number; y: number; vx: number; vy: number; act: number; visible: boolean }[],
    ball: { x: number; y: number; z: number },
    dt: number,
  ) {
    for (const it of list) {
      const pl = this.ensurePlayer(it.info);
      pl.g.visible = it.visible;
      if (!it.visible) continue;
      const X = it.x - 52.5, Z = it.y - 34;
      pl.g.position.set(X, 0, Z);
      const sp = Math.hypot(it.vx, it.vy);
      // facing: movement direction or towards ball
      let target = pl.face;
      if (sp > 0.6) target = Math.atan2(it.vx, it.vy);
      else target = Math.atan2(ball.x - it.x, ball.y - it.y);
      let d = target - pl.face;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      pl.face += d * Math.min(1, dt * 8);
      pl.g.rotation.y = pl.face;
      // gait
      pl.phase += dt * (2.5 + sp * 1.55);
      const amp = Math.min(0.95, sp * 0.13);
      const s = Math.sin(pl.phase);
      pl.legL.rotation.x = s * amp;
      pl.legR.rotation.x = -s * amp;
      pl.armL.rotation.x = -s * amp * 0.8;
      pl.armR.rotation.x = s * amp * 0.8;
      pl.armL.rotation.z = 0.08;
      pl.armR.rotation.z = -0.08;
      pl.body.rotation.set(sp > 4 ? 0.12 : 0.03, 0, 0);
      pl.body.position.set(0, Math.abs(s) * amp * 0.06, 0);
      switch (it.act) {
        case 1: // kick
          pl.legR.rotation.x = -1.1; pl.legL.rotation.x = 0.2; pl.armL.rotation.z = 0.6; break;
        case 2: case 3: { // dive
          const dir = it.act === 2 ? 1 : -1;
          pl.body.rotation.z = dir * 1.25;
          pl.body.position.set(0, 0.25, 0);
          pl.armL.rotation.x = -2.8; pl.armR.rotation.x = -2.8;
          break;
        }
        case 4: // celebrate
          pl.armL.rotation.z = 2.6; pl.armR.rotation.z = -2.6; pl.armL.rotation.x = 0; pl.armR.rotation.x = 0; break;
        case 5: // fall
          pl.body.rotation.x = 1.35; pl.body.position.set(0, 0.2, 0); break;
        case 6: // header
          pl.body.position.y = 0.35; pl.armL.rotation.z = 0.9; pl.armR.rotation.z = -0.9; break;
        case 7: // throw-in
          pl.armL.rotation.x = -3.0; pl.armR.rotation.x = -3.0; break;
      }
    }
    const bx = ball.x - 52.5, bz = ball.y - 34;
    this.ball.position.set(bx, 0.16 + Math.max(0, ball.z), bz);
    this.ball.rotation.x += dt * 4;
    this.ballShadow.position.set(bx, 0.02, bz);
    // camera
    this.updateCamera(bx, bz, ball.z, dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(bx: number, bz: number, by: number, dt: number) {
    const z = this.zoom;
    let pos: THREE.Vector3, look: THREE.Vector3;
    if (this.camMode === 0) {
      const cx = Math.max(-40, Math.min(40, bx));
      pos = new THREE.Vector3(cx * 0.94, 15.5 * z, 47 * z + bz * 0.3);
      look = new THREE.Vector3(cx, 0, bz * 0.6);
    } else if (this.camMode === 1) {
      pos = new THREE.Vector3(bx * 0.6, 62 * z, 26 * z);
      look = new THREE.Vector3(bx * 0.6, 0, bz * 0.3);
    } else if (this.camMode === 2) {
      const side = bx >= 0 ? 1 : -1;
      pos = new THREE.Vector3(side * (58 + 12 * z), 14 * z, bz * 0.4);
      look = new THREE.Vector3(bx * 0.7, 0, bz);
    } else {
      pos = new THREE.Vector3(bx - 14 * z, 7 * z, bz + 10 * z);
      look = new THREE.Vector3(bx, 1 + by * 0.3, bz);
    }
    const k = Math.min(1, dt * 2.6);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  snapCamera() {
    this.camPos.set(0, 30, 70);
    this.camLook.set(0, 0, 0);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.scene.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
      }
    });
    this.renderer.domElement.remove();
  }
}

export function kitFor(club: { c1: string; c2: string; kit: string }, other?: { c1: string; c2: string }): KitInfo {
  let shirt = club.c1, shirt2 = club.c2, pattern = club.kit;
  if (other && colorDist(club.c1, other.c1) < 90) {
    // away kit: swap colours, or fall back to white/black
    if (colorDist(club.c2, other.c1) > 120) { shirt = club.c2; shirt2 = club.c1; }
    else { shirt = colorDist('#ffffff', other.c1) > 150 ? '#f2f2f2' : '#1b1b1b'; shirt2 = club.c1; }
    pattern = '';
  }
  return { shirt, shirt2, pattern, shorts: luminance(shirt) > 0.7 ? shirt2 : '#f2f2f2', socks: shirt, gk: '#e8c400' };
}
export function colorDist(a: string, b: string) {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const x = p(a), y = p(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
function luminance(h: string) {
  return (parseInt(h.slice(1, 3), 16) * 0.299 + parseInt(h.slice(3, 5), 16) * 0.587 + parseInt(h.slice(5, 7), 16) * 0.114) / 255;
}
