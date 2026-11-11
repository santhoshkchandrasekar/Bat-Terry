/* Terry the bat, in 3D. Procedural three.js (r128 UMD) rig: shell-fur body, bone skeleton + live membrane,
   flap / fly / flip / hang / let go / echolocate. No external models or textures.
   API: TerryBat3D.create(container, opts) -> { flap, fly, flip, echo, setHome, setBranch, hangNow, setScale,
        mode, busy, setSpeed, setTheme, anchor, destroy }   (x,y are container-relative pixels) */
(function () {
  "use strict";
  const T = window.THREE;
  const D = Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const easeIO = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  /* ---------------------------------------------------------------- bat proportions (px at scale 1) */
  const L = { hum: 36, fore: 60, dig: [50, 86, 75, 65], thumb: 10 };           // wing bones
  const SH = [14, 8, 12];                                                      // shoulder (x mirrored)
  const HIP = [9, -9, -22], KNEE = [16, -11, -36], ANK = [21, -11, -52], TAIL = [0, -7, -82];
  const BODY = { rx: 18, ry: 16, rz: 38 };                                     // torso ellipsoid
  const HEAD_PIVOT = [0, 3, 29], HEAD_C = [0, 0, 8], HEAD_R = 17.5;
  const FOOT_LOCAL = [0, -11, -52];                                            // where the feet are, for pinning to a branch

  /* ---------------------------------------------------------------- textures */
  function furTexture() {
    const c = cv(512, 512), g = c.getContext("2d"), r = rng(7);
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
    g.globalCompositeOperation = "lighten";
    for (let i = 0; i < 5200; i++) {
      const x = r() * 512, y = r() * 512, rad = 2.6 + r() * 2.2, h = 90 + r() * 165 | 0;
      for (const ox of [0, -512, 512]) for (const oy of [0, -512, 512]) {
        if (x + ox < -8 || x + ox > 520 || y + oy < -8 || y + oy > 520) continue;
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, `rgb(${h},${h},${h})`); gr.addColorStop(1, "rgb(0,0,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, rad, 0, 6.3); g.fill();
      }
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function membraneTexture() {          // R = veins, G = mottling, B = bone-line fade
    const S = 512, c = cv(S, S), g = c.getContext("2d"), r = rng(31);
    g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 260; i++) {                 // soft mottling
      const x = r() * S, y = r() * S, rad = 14 + r() * 40, a = 0.012 + r() * 0.03;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(0,255,0,${a})`); gr.addColorStop(1, "rgba(0,255,0,0)");
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const line = (pts, w, a) => {
      g.strokeStyle = `rgba(255,0,0,${a})`; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    };
    const N = 9;
    for (let i = 0; i < N; i++) {                   // main veins run across the tile
      const y0 = (i + 0.5) / N * S + (r() - 0.5) * 16, ph = r() * 6, pts = [];
      for (let x = -4; x <= S + 4; x += 16) pts.push([x, y0 + Math.sin(x * 0.02 + ph) * 7]);
      line(pts, 2.6, 0.9);
      for (let k = 0; k < 7; k++) {                 // little branches
        const bx = r() * S, by = y0 + Math.sin(bx * 0.02 + ph) * 7, d = (r() < 0.5 ? -1 : 1), len = 14 + r() * 40, pts2 = [[bx, by]];
        for (let s = 1; s <= 4; s++) pts2.push([bx + s * len / 4 * 0.8, by + d * (s * len / 4) * 0.6 + (r() - 0.5) * 5]);
        line(pts2, 1.2, 0.7);
      }
    }
    for (let i = 0; i < 60; i++) {                  // capillary web
      const x = r() * S, y = r() * S, a = r() * 6.3, l = 10 + r() * 26;
      line([[x, y], [x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 0.8, 0.4);
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
  }
  function earTexture() {
    const c = cv(128, 128), g = c.getContext("2d");
    g.fillStyle = "#17151c"; g.fillRect(0, 0, 128, 128);
    const gr = g.createRadialGradient(64, 78, 4, 64, 78, 58); gr.addColorStop(0, "#5a5268"); gr.addColorStop(0.7, "#3b3548"); gr.addColorStop(1, "#17151c");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(110,110,130,.22)"; g.lineWidth = 1.4;
    for (let i = 1; i < 1; i++) { g.beginPath(); g.moveTo(64, 128); g.quadraticCurveTo(64 + (i - 4.5) * 14, 64, 64 + (i - 4.5) * 12, 10 + Math.abs(i - 4.5) * 8); g.stroke(); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  function envTexture() {                           // equirect studio: dark room, a big softbox up-left, a warm strip behind-right
    const c = cv(512, 256), g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#58627a"); gr.addColorStop(0.5, "#1a1f2b"); gr.addColorStop(1, "#07090d");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    const box = (x, y, w, h, col, blur) => { g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = col; g.fillRect(x, y, w, h); g.restore(); };
    box(110, 30, 90, 60, "#ffffff", 6);
    box(330, 70, 28, 110, "#ffb978", 5);
    box(430, 20, 50, 40, "#9db8ff", 7);
    const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding; return t;
  }
  function blobTexture() {
    const c = cv(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(0.55, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
  }

  /* ---------------------------------------------------------------- parametric surfaces with analytic-ish normals */
  function surf(fn, nu, nv, o = {}) {
    const wrap = o.wrap !== false, pos = [], nor = [], uv = [], idx = [], e = 1e-3, A = new T.Vector3(), B = new T.Vector3(), N = new T.Vector3();
    const P = (u, v) => new T.Vector3().fromArray(fn(u, v));
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv, vv = clamp(v, 0.003, 0.997), uu = wrap ? u : clamp(u, 0.003, 0.997), p = P(u, v);
      A.copy(P(uu + e, vv)).sub(P(uu - e, vv)); B.copy(P(uu, vv + e)).sub(P(uu, vv - e)); N.crossVectors(A, B).normalize();
      if (o.center && N.dot(p.clone().sub(o.center)) < 0) N.negate();
      pos.push(p.x, p.y, p.z); nor.push(N.x, N.y, N.z); uv.push(u, v);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    // make winding agree with the normals
    const ia = idx[0], ib = idx[1], ic = idx[2], pa = new T.Vector3().fromArray(pos, ia * 3), pb = new T.Vector3().fromArray(pos, ib * 3), pc = new T.Vector3().fromArray(pos, ic * 3);
    const fnrm = pb.sub(pa).cross(pc.sub(pa)), vn = new T.Vector3().fromArray(nor, ia * 3);
    if (fnrm.dot(vn) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } }
    return g;
  }
  const dirOf = (u, v) => { const th = u * Math.PI * 2, ph = v * Math.PI; return [Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)]; };
  function torsoPoint(d) {
    const s = (1 + 0.1 * d[2] - 0.14 * (d[2] < 0 ? -d[2] : 0)) * (1 - 0.22 * sstep(0.3, 1.0, d[2]));
    return [BODY.rx * s * d[0], BODY.ry * d[1] * (1 + 0.06 * d[2]) + 1.5 * Math.max(0, d[1]) * (1 - Math.abs(d[2])), BODY.rz * d[2]];
  }
  function headPoint(d) {
    const g = sstep(0.05, 1.0, d[2]);
    const sx = 1 - 0.18 * g, sy = (1 - 0.2 * g) * 0.94;
    return [HEAD_C[0] + HEAD_R * 1.04 * d[0] * sx, HEAD_C[1] + HEAD_R * d[1] * sy - 1.2 * g * g, HEAD_C[2] + HEAD_R * d[2] * (1 + 0.2 * Math.pow(g, 1.3))];
  }
  function jawPoint(d) {                // lower jaw, relative to the hinge
    return [6.2 * d[0] * (1 - 0.35 * sstep(0, 1, d[2])), 2.6 * d[1] - 0.2, 8 + 8.2 * d[2]];
  }
  function earPoint(u, v) {             // u -1..1 across, v 0..1 up. rounded-triangle microbat ear
    const hw = 9.5 * Math.sqrt(Math.max(0.0001, 1 - Math.pow((v - 0.45) / 0.58, 2)));
    const x = u * hw; return [x, v * 15.2, 0.05 * x * x * 0.6 - 3.0 * v * v + 0.9 * (1 - v) * 0];
  }

  /* ---------------------------------------------------------------- materials */
  function makeShared() {
    const V = (x, y, z) => new T.Vector3(x, y, z).normalize();
    return {
      uKeyDir: { value: V(-0.55, 0.75, 0.62) }, uKeyCol: { value: new T.Color(1.0, 0.95, 0.9) },
      uRimDir: { value: V(0.72, 0.35, -0.7) }, uRimCol: { value: new T.Color(0.8, 0.5, 0.3) },
      uFillDir: { value: V(0.6, -0.25, 0.65) }, uFillCol: { value: new T.Color(0.10, 0.13, 0.2) },
      uAmb: { value: new T.Color(0.06, 0.06, 0.08) }, uTrans: { value: 0.07 }, uTime: { value: 0 },
    };
  }
  const SHARED_GLSL = `uniform vec3 uKeyDir,uRimDir,uFillDir,uKeyCol,uRimCol,uFillCol,uAmb;`;
  function furMaterial(sh, tex, o) {
    return new T.ShaderMaterial({
      uniforms: Object.assign({
        uTex: { value: tex }, uLen: { value: o.len }, uRep: { value: new T.Vector2(o.repU, o.repV) },
        uForce: { value: new T.Vector3() }, uBase: { value: new T.Color(o.base || 0x0a0808) }, uTip: { value: new T.Color(o.tip || 0x2c2420) },
        uBare: { value: [new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0)] }, uCut: { value: o.cut == null ? 0.92 : o.cut },
        uSheen: { value: new T.Color(0.35, 0.4, 0.55) },
      }, sh),
      vertexShader: `
        attribute float aLayer; uniform float uLen; uniform vec3 uForce; uniform vec2 uRep;
        varying vec3 vN, vW, vObj; varying vec2 vUv; varying float vL;
        void main(){
          vec3 n = normalize(normal); float l = aLayer;
          vec3 p = position + n*uLen*l;
          vec4 wp = modelMatrix*vec4(p,1.0); wp.xyz += uForce*l*l;
          vW = wp.xyz; vN = normalize(mat3(modelMatrix)*n); vUv = uv*uRep; vL = l; vObj = position;
          gl_Position = projectionMatrix*viewMatrix*wp;
        }`,
      fragmentShader: `
        ${SHARED_GLSL}
        uniform sampler2D uTex; uniform vec3 uBase,uTip,uSheen; uniform vec4 uBare[3]; uniform float uCut;
        varying vec3 vN, vW, vObj; varying vec2 vUv; varying float vL;
        void main(){
          float h = texture2D(uTex, vUv).r;
          if (vL > 0.001) {
            if (h < vL*uCut + 0.05) discard;
            float allow = 1.0;
            for (int i=0;i<3;i++){ float r = uBare[i].w; if (r>0.0) allow = min(allow, smoothstep(r*0.55, r*1.35, distance(vObj, uBare[i].xyz))); }
            if (vL > allow) discard;
          }
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
          float wrapK = clamp((dot(N,uKeyDir)+0.55)/1.55, 0.0, 1.0);
          float wrapF = clamp((dot(N,uFillDir)+0.4)/1.4, 0.0, 1.0);
          vec3 base = mix(uBase, uTip, vL*vL*(0.55+0.9*h)) ;
          vec3 lit = uAmb + uKeyCol*wrapK*0.9 + uFillCol*wrapF;
          float ao = mix(0.42, 1.0, sqrt(vL));
          vec3 col = base*lit*ao*0.8;
          float ndv = max(dot(N,V),0.0), fres = pow(1.0-ndv, 3.2);
          float rimMask = smoothstep(-0.2, 0.8, dot(N,uRimDir));
          col += uRimCol*fres*(0.04+0.6*rimMask)*mix(0.35,1.0,vL);
          col += uSheen*pow(1.0-ndv,4.0)*0.08*vL;
          vec3 H = normalize(uKeyDir+V); col += uKeyCol*pow(max(dot(N,H),0.0),22.0)*0.10*vL*(0.5+h);
          gl_FragColor = vec4(col,1.0);
          #include <encodings_fragment>
        }`,
    });
  }
  function membraneMaterial(sh, tex) {
    return new T.ShaderMaterial({
      uniforms: Object.assign({ uMap: { value: tex }, uAlpha: { value: 0.93 }, uFold: { value: 0 } }, sh),
      side: T.DoubleSide, transparent: true, depthWrite: true,
      vertexShader: `varying vec3 vN, vW; varying vec2 vUv;
        void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix)*normal); vUv = uv; gl_Position = projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: `
        ${SHARED_GLSL}
        uniform sampler2D uMap; uniform float uAlpha, uTrans, uFold; varying vec3 vN, vW; varying vec2 vUv;
        void main(){
          vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
          if (dot(N,V) < 0.0) N = -N;
          vec4 m = texture2D(uMap, vUv);
          float vein = 0.0, mot = clamp(m.g,0.,1.)*0.5;
          float ndl = dot(N,uKeyDir);
          float wrapK = clamp((ndl+0.45)/1.45, 0.0, 1.0);
          float wrapF = clamp(dot(N,uFillDir)*0.5+0.5, 0.0, 1.0);
          wrapK = mix(wrapK, 0.45, uFold); wrapF = mix(wrapF, 0.5, uFold);
          vec3 base = mix(vec3(0.0095,0.0075,0.0125), vec3(0.020,0.016,0.026), mot*1.2);
          base = mix(base, vec3(0.005,0.004,0.007), vein*0.8);
          vec3 col = base*(uAmb + uKeyCol*wrapK*1.1 + uFillCol*wrapF)*0.75;
          // light coming through from behind (rim / back light): warm glow that the veins and bones block
          float tr = max(dot(-N, uRimDir), 0.0) + 0.45*max(-ndl, 0.0);
          float edge = 0.10 + 2.2*pow(1.0-max(dot(N,V),0.0), 2.0);
          vec3 glow = vec3(0.30,0.085,0.035)*tr*edge*(1.0 - vein*0.9)*(0.45+0.9*mot)*uTrans;
          float ndv = max(dot(N,V),0.0), fres = pow(1.0-ndv, 4.0);
          float rm = smoothstep(-0.3,0.8,dot(N,uRimDir));
          col += glow*(1.0-uFold) + uRimCol*fres*(0.04+0.22*rm)*(1.0-0.5*uFold) + uKeyCol*pow(max(dot(N,normalize(uKeyDir+V)),0.0),30.0)*0.025;
          gl_FragColor = vec4(col, clamp(uAlpha - tr*0.10*uTrans, 0.5, 1.0));
          #include <encodings_fragment>
        }`,
    });
  }

  /* ---------------------------------------------------------------- shell-fur mesh */
  function furMesh(geo, mat, layers) {
    const g = new T.InstancedBufferGeometry();
    g.index = geo.index; g.setAttribute("position", geo.attributes.position); g.setAttribute("normal", geo.attributes.normal); g.setAttribute("uv", geo.attributes.uv);
    const a = new Float32Array(layers); for (let i = 0; i < layers; i++) a[i] = i / (layers - 1);
    g.setAttribute("aLayer", new T.InstancedBufferAttribute(a, 1)); g.instanceCount = layers;
    const m = new T.Mesh(g, mat); m.frustumCulled = false; return m;
  }

  /* ---------------------------------------------------------------- the rig */
  function build(sh, envMap) {
    const rig = new T.Group(), body = new T.Group(); rig.add(body);
    const furTex = furTexture(), memTex = membraneTexture(), earTex = earTexture();
    const std = (o) => new T.MeshStandardMaterial(Object.assign({ envMap, envMapIntensity: 0.9 }, o));
    const phys = (o) => new T.MeshPhysicalMaterial(Object.assign({ envMap, envMapIntensity: 1.0 }, o));

    // torso
    const torsoGeo = surf((u, v) => torsoPoint(dirOf(u, v)), 56, 36, { center: new T.Vector3() });
    const torsoMat = furMaterial(sh, furTex, { len: 2.1, repU: 24, repV: 17, base: 0x0a090c, tip: 0x16141a });
    const torso = furMesh(torsoGeo, torsoMat, 24); body.add(torso);

    const fill = new T.Mesh(new T.SphereGeometry(1, 20, 14), new T.MeshStandardMaterial({ color: 0x0c0b0f, roughness: 0.8 })); fill.scale.set(BODY.rx + 3.4, BODY.ry + 1.5, 30); fill.position.z = -4; body.add(fill);
    const B_fill = fill;
    // head
    const headG = new T.Group(); headG.position.set(...HEAD_PIVOT); body.add(headG);
    const headGeo = surf((u, v) => headPoint(dirOf(u, v)), 56, 36, { center: new T.Vector3(...HEAD_C) });
    const headMat = furMaterial(sh, furTex, { len: 1.6, repU: 20, repV: 14, base: 0x0a090c, tip: 0x16141a });
    headG.add(furMesh(headGeo, headMat, 18));
    const eyeDirs = [[0.62, 0.28, 0.73], [-0.62, 0.28, 0.73]].map(d => { const l = Math.hypot(...d); return d.map(x => x / l); });
    const nosePos = headPoint([0, 0.1, 0.995]);
    const eyePos = eyeDirs.map(headPoint);
    headMat.uniforms.uBare.value[0].set(eyePos[0][0], eyePos[0][1], eyePos[0][2], 8.0);
    headMat.uniforms.uBare.value[1].set(eyePos[1][0], eyePos[1][1], eyePos[1][2], 8.0);
    headMat.uniforms.uBare.value[2].set(nosePos[0], nosePos[1], nosePos[2], 8.5);

    // skin patch under the face fur (visible where fur is cleared: eyes, nose)
    const skin = new T.Mesh(headGeo, std({ color: 0x1a1820, roughness: 0.55, metalness: 0 })); headG.add(skin);
    skin.scale.setScalar(0.992);

    // eyes
    const eyeMat = phys({ color: 0x010101, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.0 });
    const eyes = eyePos.map((p, i) => {
      const g = new T.Group(); g.position.set(p[0] * 0.985, p[1] * 0.985, p[2] * 0.985); headG.add(g);
      const m = new T.Mesh(new T.SphereGeometry(4.6, 28, 20), eyeMat); g.add(m);
      const hl = new T.Mesh(new T.SphereGeometry(0.75, 10, 8), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
      hl.position.set(-1.5, 1.9, 3.7); hl.scale.setScalar(1.5); g.add(hl);
      const hl2 = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), hl.material); hl2.position.set(1.4, -1.4, 4.0); g.add(hl2); hl.userData.h2 = hl2;
      const lid = new T.Mesh(new T.SphereGeometry(2.95, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), new T.MeshStandardMaterial({ color: 0x0c0909, roughness: 0.7 }));
      lid.rotation.x = Math.PI * 0.5; lid.visible = false; g.add(lid);
      g.lookAt(new T.Vector3(p[0] * 3, p[1] * 3 + 5, p[2] * 3 + 40)); return { g, m, hl, lid };
    });

    // nose pad
    const nShape = new T.Shape(); nShape.moveTo(-2.3, 1.2); nShape.quadraticCurveTo(0, 2.0, 2.3, 1.2); nShape.quadraticCurveTo(2.9, 0.6, 1.1, -1.5); nShape.quadraticCurveTo(0, -2.3, -1.1, -1.5); nShape.quadraticCurveTo(-2.9, 0.6, -2.3, 1.2);
    const nose = new T.Mesh(new T.ExtrudeGeometry(nShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3, curveSegments: 10 }), new T.MeshStandardMaterial({ color: 0x2a2530, roughness: 0.75, envMapIntensity: 0.05, envMap }));
    nose.position.set(nosePos[0], nosePos[1] + 0.2, nosePos[2] - 0.8); nose.rotation.x = -0.12; headG.add(nose);

    // mouth: dark cavity + jaw hinge
    const cavity = new T.Mesh(new T.SphereGeometry(5, 16, 12), new T.MeshStandardMaterial({ color: 0x3a0f16, roughness: 0.5, emissive: 0x1a0509 }));
    cavity.position.set(0, -4.2, 20); cavity.scale.set(0.95, 0.6, 1.35); headG.add(cavity);
    const jawPivot = new T.Group(); jawPivot.position.set(0, -6.2, 9); headG.add(jawPivot);
    const jawGeo = surf((u, v) => jawPoint(dirOf(u, v)), 28, 18, { center: new T.Vector3(0, 0, 8) });
    const jawMat = furMaterial(sh, furTex, { len: 1.5, repU: 6, repV: 6, base: 0x0a090c, tip: 0x16141a });
    const jaw = furMesh(jawGeo, jawMat, 8); jawPivot.add(jaw);
    const jawSkin = new T.Mesh(jawGeo, std({ color: 0x0d0c10, roughness: 0.6 })); jawSkin.scale.setScalar(0.99); jawPivot.add(jawSkin);
    const tongue = new T.Mesh(new T.SphereGeometry(3, 12, 8), new T.MeshStandardMaterial({ color: 0x7a2a33, roughness: 0.5 }));
    tongue.position.set(0, 0.5, 13); tongue.scale.set(0.9, 0.35, 1.6); jawPivot.add(tongue);

    // ears (cupped, rounded) + tiny tragus
    const earGeo = surf(earPoint, 14, 14, { wrap: false });
    const earMat = new T.MeshStandardMaterial({ map: earTex, side: T.DoubleSide, roughness: 0.55, envMap, envMapIntensity: 0.6, emissive: 0x000000, emissiveIntensity: 0 });
    const ears = [1, -1].map(s => {
      const pivot = new T.Group(); pivot.position.set(s * 14.5, 10.5, -1); headG.add(pivot);
      const inner = new T.Group(); pivot.add(inner);
      const m = new T.Mesh(earGeo, earMat); inner.add(m);
      const tr = new T.Mesh(new T.ConeGeometry(1.6, 6, 8), earMat); tr.position.set(-s * 1.0, 4, 0.6); tr.rotation.z = s * 0.2; inner.add(tr);
      pivot.userData.s = s; return { pivot, inner };
    });

    jawPivot.visible = false; cavity.visible = false;
    const mouthPos = headPoint([0, -0.3, 0.94]);
    const smile = new T.Mesh(new T.TorusGeometry(2.6, 0.38, 8, 24, Math.PI * 0.75), new T.MeshBasicMaterial({ color: 0x4a2a3c }));
    smile.rotation.z = Math.PI * 1.125; smile.position.set(mouthPos[0], mouthPos[1] + 1.0, mouthPos[2] + 0.3); smile.rotation.x = -0.15; headG.add(smile);
    const mouthO = new T.Group(); { const ring = new T.Mesh(new T.RingGeometry(0.62, 1, 28), new T.MeshBasicMaterial({ color: 0x5a2a40, side: T.DoubleSide })); const inner = new T.Mesh(new T.CircleGeometry(0.64, 28), new T.MeshBasicMaterial({ color: 0x14060c })); inner.position.z = 0.01; mouthO.add(ring, inner); }
    mouthO.position.set(mouthPos[0], mouthPos[1] - 0.6, mouthPos[2] + 1.6); mouthO.rotation.x = -0.2; mouthO.visible = false; headG.add(mouthO);
    const tuftGeo = surf((u, v) => { const d = dirOf(u, v); return [9.5 * d[0], -12 + 6.5 * d[1], 22 + 11 * d[2]]; }, 32, 20, { center: new T.Vector3(0, -12, 22) });
    const tuftMat = furMaterial(sh, furTex, { len: 3.0, repU: 14, repV: 10, base: 0x2e2b2b, tip: 0x6b6460 });
    const tuftM = furMesh(tuftGeo, tuftMat, 14); body.add(tuftM);
    // mouth-world anchor for sonar
    const mouthAnchor = new T.Object3D(); mouthAnchor.position.set(0, -2.5, 37); headG.add(mouthAnchor);

    /* ---- wings */
    const boneMat = phys({ color: 0x050507, roughness: 0.9, clearcoat: 0.0, clearcoatRoughness: 0.5, envMapIntensity: 0.08 });
    const boneGeo = new T.CylinderGeometry(0.62, 1, 1, 10, 1); boneGeo.translate(0, 0.5, 0);
    const jointGeo = new T.SphereGeometry(1, 12, 9), clawGeo = new T.ConeGeometry(0.42, 2.0, 8); clawGeo.translate(0, 1.0, 0);
    const clawMat = phys({ color: 0x1a1210, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
    const memMat = membraneMaterial(sh, memTex);
    const mkBone = (par, r) => { const m = new T.Mesh(boneGeo, boneMat); m.userData.r = r; par.add(m); return m; };
    const mkJoint = (par, r) => { const m = new T.Mesh(jointGeo, boneMat); m.userData.r0 = r; m.scale.setScalar(r); par.add(m); return m; };
    const wings = [1, -1].map(sx => {
      const w = { sx, bones: {}, joints: {} };
      w.bones.hum = mkBone(body, 2.2); w.bones.fore = mkBone(body, 1.6);
      w.bones.dig = [0, 1, 2, 3].map(() => [mkBone(body, 0.95), mkBone(body, 0.65)]);
      w.bones.thumb = mkBone(body, 1.3); w.joints = { e: mkJoint(body, 2.4), w: mkJoint(body, 2.4), k: [0, 1, 2, 3].map(() => mkJoint(body, 1.1)) };
      w.claw = new T.Mesh(clawGeo, clawMat); body.add(w.claw);
      // membrane geometry (panels are filled each frame)
      w.panels = [];
      const addPanel = (nu, nv, kind, k) => { w.panels.push({ nu, nv, kind, k, off: 0 }); };
      addPanel(8, 3, "pro"); addPanel(14, 12, "plag"); addPanel(10, 9, "dac", 0); addPanel(10, 9, "dac", 1); addPanel(10, 9, "dac", 2);
      let vc = 0; const uvs = [], idx = [];
      for (const p of w.panels) {
        p.off = vc;
        for (let j = 0; j <= p.nv; j++) for (let i = 0; i <= p.nu; i++) {
          const a = i / p.nu, b = j / p.nv;
          if (p.kind === "dac") uvs.push(a * 1.0 + p.k * 0.31, b * 0.55 + p.k * 0.17); else if (p.kind === "plag") uvs.push(b * 1.2, a * 1.3 + 0.1); else uvs.push(a * 0.5, b * 0.3);
        }
        for (let j = 0; j < p.nv; j++) for (let i = 0; i < p.nu; i++) {
          const a = vc + j * (p.nu + 1) + i, b2 = a + 1, c = a + p.nu + 1, d = c + 1; idx.push(a, c, b2, b2, c, d);
        }
        vc += (p.nu + 1) * (p.nv + 1);
      }
      const g = new T.BufferGeometry(); w.pos = new Float32Array(vc * 3);
      g.setAttribute("position", new T.BufferAttribute(w.pos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute("normal", new T.BufferAttribute(new Float32Array(vc * 3), 3).setUsage(T.DynamicDrawUsage));
      g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
      w.geo = g; w.mesh = new T.Mesh(g, memMat); w.mesh.frustumCulled = false; w.mesh.renderOrder = sx > 0 ? 2 : 3; body.add(w.mesh);
      return w;
    });

    /* ---- hind legs, feet, tail, uropatagium */
    const legs = [1, -1].map(sx => {
      const l = { sx, thigh: mkBone(body, 2.6), shin: mkBone(body, 1.7), knee: mkJoint(body, 2.3), foot: new T.Group(), toes: [], calcar: mkBone(body, 0.7) };
      body.add(l.foot);
      for (let k = 0; k < 5; k++) {
        const t1 = mkBone(l.foot, 1.25), t2 = mkBone(l.foot, 1.05), cl = new T.Mesh(jointGeo, boneMat); cl.scale.setScalar(1.25); l.foot.add(cl); l.toes.push({ t1, t2, cl });
      }
      l.heel = mkJoint(l.foot, 1.7); return l;
    });
    const tail = mkBone(body, 1.1);
    const uroN = [12, 8]; const uroPos = new Float32Array((uroN[0] + 1) * (uroN[1] + 1) * 3), uroUv = [], uroIdx = [];
    for (let j = 0; j <= uroN[1]; j++) for (let i = 0; i <= uroN[0]; i++) uroUv.push(i / uroN[0] * 0.9, j / uroN[1] * 0.6);
    for (let j = 0; j < uroN[1]; j++) for (let i = 0; i < uroN[0]; i++) { const a = j * (uroN[0] + 1) + i, b = a + 1, c = a + uroN[0] + 1, d = c + 1; uroIdx.push(a, c, b, b, c, d); }
    const uroGeo = new T.BufferGeometry(); uroGeo.setAttribute("position", new T.BufferAttribute(uroPos, 3).setUsage(T.DynamicDrawUsage));
    uroGeo.setAttribute("normal", new T.BufferAttribute(new Float32Array(uroPos.length), 3)); uroGeo.setAttribute("uv", new T.Float32BufferAttribute(uroUv, 2)); uroGeo.setIndex(uroIdx);
    const uro = new T.Mesh(uroGeo, memMat); uro.frustumCulled = false; uro.renderOrder = 1; body.add(uro);

    return { fill: B_fill, tuft: tuftM, smile, mouthO, rig, body, torso, torsoMat, headG, headMat, jawMat, eyes, nose, jawPivot, cavity, tongue, ears, wings, legs, tail, uro, uroGeo, uroN, mouthAnchor, memMat, boneMat, skin };
  }

  /* ---------------------------------------------------------------- wing kinematics */
  const dirv = (az, el, sx, o) => { const ce = Math.cos(el); o.set(ce * Math.cos(az) * sx, Math.sin(el), ce * Math.sin(az)); return o; };
  // pose vector: [hAz,hEl, fAz,fEl, (dAz,dEl)x4, tipBend(el)x4, thAz,thEl]  (degrees)
  const POSE_N = 2 + 2 + 8 + 4 + 2;
  function flightPose(phi, e, phiHand, vel, out) {
    const fan = 0.35 + 0.65 * e, ie = 1 - e;
    out[0] = -12 - 38 * ie; out[1] = phi * 0.82 + 6 * ie;
    out[2] = 8 - 70 * ie; out[3] = phi * 0.9 + 26 * ie;
    const az0 = lerp(-84, -4, e), offs = [44, 6, -26, -58];
    for (let k = 0; k < 4; k++) {
      out[4 + k * 2] = az0 + offs[k] * fan;
      out[5 + k * 2] = phiHand * (0.78 - 0.05 * k) + (1 - e) * (-8 + 26 * (k / 3)) + ie * 14;
      out[12 + k] = -7 - 4 * k - clamp(-vel / 11, -34, 34) * (0.45 + 0.2 * k) - ie * 14;       // tips lag the stroke and droop when folded
    }
    out[16] = 62 - 40 * ie; out[17] = 28 + phi * 0.3;
    return out;
  }
  const HANG_POSE = [-92, -24, 88, 8, -112, -6, -118, -14, -124, -22, -132, -30, -4, -4, -4, -4, 110, -10];
  const OPEN_GLIDE = flightPose(8, 1, 6, 0, new Array(POSE_N));

  /* ---------------------------------------------------------------- create */
  function create(container, opts = {}) {
    opts = Object.assign({ scale: 1, shadow: true }, opts);
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cs = getComputedStyle(container); if (cs.position === "static") container.style.position = "relative";
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);   // full-screen canvases: on a 200% laptop screen 2x was 2880x1800 a frame each, too much during the landing move (owner 7 Nov); a soft-edged bat looks the same at 1.5
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", premultipliedAlpha: true });
    renderer.setPixelRatio(dpr); renderer.setClearColor(0x000000, 0); renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.NoToneMapping;
    const cvs = renderer.domElement; cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;background:transparent";
    cvs.setAttribute("aria-hidden", "true"); container.appendChild(cvs);

    const scene = new T.Scene();
    const pm = new T.PMREMGenerator(renderer), env = pm.fromEquirectangular(envTexture()).texture; pm.dispose();
    const sh = makeShared();
    const B = build(sh, env);
    scene.add(B.rig);
    const camera = new T.PerspectiveCamera(18, 1, 10, 6000); scene.add(camera);
    // lights for the standard (non-shader) materials, mirroring the shader lights
    const key = new T.DirectionalLight(0xfff3e6, 1.3), rimL = new T.DirectionalLight(0xff9a50, 1.5), fillL = new T.DirectionalLight(0x6f8fd0, 0.45), hemi = new T.HemisphereLight(0x8090b0, 0x181214, 0.5);
    scene.add(key, rimL, fillL, hemi);
    const setLights = () => { key.position.copy(sh.uKeyDir.value).multiplyScalar(500); rimL.position.copy(sh.uRimDir.value).multiplyScalar(500); fillL.position.copy(sh.uFillDir.value).multiplyScalar(500); };
    setLights();

    // shadow blob (behind the bat; becomes a contact shadow when hanging)
    const blobMat = new T.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0, depthWrite: false, color: 0x000000 });
    const blob = new T.Mesh(new T.PlaneGeometry(1, 1), blobMat); blob.renderOrder = -1; scene.add(blob);

    // sonar rings
    const ringGeo = new T.RingGeometry(0.965, 1, 72);
    const rings = []; for (let i = 0; i < 6; i++) {
      const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0x7fe0d0, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
      const fill = new T.Mesh(new T.CircleGeometry(1, 48), new T.MeshBasicMaterial({ color: 0x7fe0d0, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
      m.add(fill); m.visible = false; m.renderOrder = 10; fill.renderOrder = 9; scene.add(m); rings.push({ m, fill, t: 0, life: 0 });
    }

    /* ---- state */
    const home = Object.assign({ x: 330, y: 240 }, opts.home), branch = Object.assign({ x: 660, y: 112 }, opts.branch);
    const st = {
      x: home.x, y: home.y, z: 0, yaw: 28, pitch: -12, roll: 0, sway: 0, pin: 0, sc: 1,
      rate: 3.2, amp: 1, glide: 0, fold: 0, phase: 0, hover: 1, mode: "hover", busy: false, speed: 1, t: 0,
      half: 0, tilt: 0, nextTilt: 3, mouth: 0, earTw: 0, earSide: 1, blink: 0, headYaw: 0, headPitch: 0, breath: 0, earSplay: 0, grip: 0, kick: 0,
      nextBlink: 2.2, nextTwitch: 1.4, nextLook: 3, look: 0, lookTo: 0, theme: "light", vphi: 0, ax: 0, vx: 0, vy: 0,
      cx: 0, cy: 0,
    };
    const HANGS = 1, HANGH = 68;   // one size in every mode: no hang multiplier
    const tweens = []; let raf = 0, last = null, frozen = false, visible = true, destroyed = false, W = 100, H = 100;
    const base = () => 1.15 * opts.scale;   // the single Terry size (about the old hanging size)
    const Q = new T.Quaternion(), Qs = new T.Quaternion(), QA = new T.Quaternion(), QB = new T.Quaternion(), Eu = new T.Euler(0, 0, 0, "YXZ"), AXZ = new T.Vector3(0, 0, 1), tmpV = new T.Vector3();

    function resize() {
      const r = container.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false); camera.aspect = W / H;
      const dist = (H / 2) / Math.tan(camera.fov * D / 2);          // z=0 plane maps 1:1 to container pixels
      camera.position.set(W / 2, -H / 2, dist); camera.lookAt(W / 2, -H / 2, 0); camera.updateProjectionMatrix();
    }
    resize(); const ro = new ResizeObserver(resize); ro.observe(container);

    function setTheme(th) {
      if (th === "auto") th = (document.documentElement.dataset.theme === "dark" || (document.documentElement.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)) ? "dark" : "light";
      st.theme = th; const dark = th === "dark";
      sh.uRimCol.value.setRGB(dark ? 0.95 : 0.7, dark ? 0.62 : 0.42, dark ? 0.36 : 0.26);
      sh.uFillCol.value.setRGB(dark ? 0.16 : 0.10, dark ? 0.2 : 0.13, dark ? 0.32 : 0.2);
      sh.uAmb.value.setRGB(dark ? 0.10 : 0.07, dark ? 0.105 : 0.07, dark ? 0.13 : 0.085);
      sh.uTrans.value = dark ? 0.55 : 0.07;
      rimL.intensity = dark ? 2.4 : 1.5; fillL.intensity = dark ? 0.8 : 0.45; hemi.intensity = dark ? 0.8 : 0.5;
      B.boneMat.envMapIntensity = dark ? 0.3 : 0.08;
      blobMat.userData.k = dark ? 0.0 : 1.0;
      rings.forEach(r => { r.m.material.color.set(dark ? 0x7fe0d0 : 0x0f8f7f); r.fill.material.color.set(dark ? 0x7fe0d0 : 0x0f8f7f); });
    }
    setTheme(opts.theme || "auto");

    /* ---- tweens */
    function tween(dur, fn) { return new Promise(res => tweens.push({ t: 0, dur, fn, res })); }
    function stepTweens(dt) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const w = tweens[i]; w.t += dt; const u = Math.min(w.t / w.dur, 1); w.fn(u, dt);
        if (u >= 1) { tweens.splice(i, 1); w.res(); }
      }
    }
    async function run(fn) {
      if (st.busy) return false; st.busy = true;
      try { await fn(); } finally { st.busy = false; }
      opts.onState && opts.onState(st.mode); return true;
    }
    const wait = s => tween(s, () => {});

    const idleSway = () => 2.2 * Math.sin(st.t * 0.9) + 0.9 * Math.sin(st.t * 1.7);
    /* ---- orientation / position helpers */
    const lastPose = { x: home.x, y: home.y, q: null, k: 1 };
    function footWorld(q, k) { return tmpV.set(FOOT_LOCAL[0], FOOT_LOCAL[1], FOOT_LOCAL[2]).multiplyScalar(k).applyQuaternion(q); }
    function bodyQuat() {
      if (st.qo) Q.copy(st.qo); else { Eu.set(st.pitch * D, st.yaw * D, st.roll * D, "YXZ"); Q.setFromEuler(Eu); }
      if (st.sway) { Qs.setFromAxisAngle(AXZ, st.sway * D); Q.premultiply(Qs); } return Q;
    }
    function solveBodyPos(pinW) {      // body centre in px (page coords) such that the feet sit on the branch point
      const q = bodyQuat(), k = base() * st.sc, v = footWorld(q, k);
      return { x: branch.x - v.x, y: branch.y + v.y, z: -v.z };
    }

    /* ---- actions */
    async function letGo() {
      st.mode = "flip";
      const p0 = solveBodyPos(); st.x = p0.x; st.y = p0.y; st.z = p0.z; st.pin = 0;
      const y0 = st.y, yaw0 = st.yaw, pit0 = st.pitch, sw0 = st.sway, vx = (home.x > st.x ? 1 : -1) * 90;
      st.hover = 0;
      await tween(0.28, u => { const e = easeIO(u); st.fold = lerp(1, 0.8, e); st.grip = lerp(1, 0, e); st.headPitch = lerp(st.headPitch, 0, e); });
      const x0 = st.x;
      Eu.set(pit0 * D, yaw0 * D, st.roll * D, "YXZ"); QA.setFromEuler(Eu); Eu.set(-6 * D, 40 * D, 0, "YXZ"); QB.setFromEuler(Eu);
      st.qo = QA.clone(); st.sway = 0;
      const sway0 = sw0;
      await tween(1.1, u => {
        const e = easeIO(u), turn = easeIO(clamp((u - 0.08) / 0.84, 0, 1));
        st.qo.slerpQuaternions(QA, QB, turn);
        st.sway = lerp(sway0, 0, e);
        // falls from the feet, then the opening wings catch the air and the fall levels into a swoop
        const fall = 150 * st.sc, k = sstep(0.0, 1, u);
        st.y = y0 + fall * (Math.pow(u, 1.5) * (1 - 0.35 * k));
        st.x = x0 + vx * u * 0.8; st.z = lerp(st.z, 0, e);
        st.fold = lerp(0.8, 0, sstep(0.12, 0.75, u)); st.sc = lerp(HANGS, 1, easeIO(u));
        st.rate = lerp(1.0, 3.8, sstep(0.25, 0.9, u)); st.amp = sstep(0.15, 0.8, u);
        st.hover = sstep(0.6, 1, u);
      });
      st.qo = null; st.pitch = -6; st.yaw = 40; st.roll = 0; st.fold = 0; st.hover = 1; st.mode = "hover";
      const x1 = st.x, y1 = st.y, yw = st.yaw;
      await tween(1.0, u => { const e = easeIO(u); st.x = lerp(x1, home.x, e); st.y = lerp(y1, home.y, e); st.rate = lerp(3.8, 3.2, u); st.yaw = lerp(yw, 28, e); st.pitch = lerp(-6, -12, e); });
    }
    async function grab() {
      st.mode = "flip"; const hv0 = +st.hover || 0;
      const dirS = branch.x >= st.x ? 1 : -1;                           // approach from the side we're on
      const yawA = 40 * dirS;
      const x0 = st.x, y0 = st.y, yaw0 = st.yaw, pit0 = st.pitch, rol0 = st.roll, rate0 = st.rate, gl0 = st.glide;
      const start = { x: branch.x - 150 * dirS, y: branch.y + 170 };
      const far = Math.hypot(start.x - x0, start.y - y0);   // the approach takes as long as the distance needs: no dash across the page
      await tween(clamp(far / 520, 0.9, 2.4), u => { const e = easeIO(u); st.x = lerp(x0, start.x, e); st.y = lerp(y0, start.y, e); st.yaw = lerp(yaw0, yawA, e); st.pitch = lerp(pit0, -22, e); st.rate = lerp(rate0, 4.0, u); st.roll = lerp(rol0, -8 * dirS, e); st.glide = lerp(gl0, 0, e); st.hover = lerp(hv0, 0, e); });
      // the flip: roll through 180 about the long axis while the feet reach up and catch the branch
      const sx = st.x, sy = st.y, r0 = st.roll;
      await tween(0.85, u => {
        const e = easeIO(u);
        st.roll = lerp(r0, 180 * dirS, e) * (dirS > 0 ? 1 : 1);
        st.pitch = lerp(-22, 2, e);
        st.pin = sstep(0.45, 1, u);
        const free = { x: lerp(sx, branch.x - 60 * dirS, e), y: lerp(sy, branch.y + 70, e) - 28 * Math.sin(Math.PI * u), z: 0 };
        st.x = free.x; st.y = free.y; st.z = 0;
        st.rate = lerp(1.2, 1.5, sstep(0.6, 1, u)); st.amp = lerp(1, 0.35, sstep(0.55, 1, u)); st.glide = Math.pow(Math.sin(Math.PI * clamp(u * 1.1, 0, 1)), 0.5); st.half = Math.sin(Math.PI * clamp(u * 1.15, 0, 1)); st.fold = sstep(0.5, 1, u) * 0.6; st.grip = sstep(0.55, 0.95, u);
      });
      st.glide = 0; st.half = 0;
      // pinned: swing down about the feet until hanging
      st.pin = 1; st.mode = "hang";
      const pit1 = st.pitch, yaw1 = st.yaw, rollEnd = st.roll;
      await tween(1.25, u => {
        const e = easeOut(u);
        st.pitch = lerp(pit1, 90, e) + 9 * Math.sin(u * 9) * Math.exp(-3.4 * u) * u * 2;
        st.yaw = lerp(yaw1, 0, easeIO(u));
        st.roll = rollEnd;
        st.fold = lerp(0.6, 1, sstep(0.1, 0.9, u)); st.rate = lerp(1.5, 0, u); st.amp = lerp(0.35, 0, u);
        st.headPitch = lerp(0, HANGH, sstep(0.4, 1, u)); st.sc = lerp(1, HANGS, easeIO(u));
      });
      st.rate = 0; st.amp = 0; st.fold = 1; st.pitch = 90; st.roll = rollEnd; st.headPitch = HANGH; st.sc = HANGS;
      const sw = 8 * dirS; await tween(1.8, u => { st.sway = sw * Math.exp(-3 * u) * Math.cos(u * 11) + (reduced ? 0 : idleSway() * sstep(0.35, 1, u)); });
    }
    const flip = () => reduced ? Promise.resolve(false) : run(async () => { if (st.mode === "hang") await letGo(); else await grab(); });
    function hangNow() {
      tweens.length = 0; st.busy = false; st.qo = null; st.mode = "hang"; st.pin = 1; st.pitch = 90; st.roll = 180; st.yaw = 0; st.fold = 1; st.rate = 0; st.amp = 0; st.sway = 0;
      st.headPitch = HANGH; st.hover = 0; st.grip = 1; st.sc = HANGS;
    }
    function flap() {
      if (reduced) return Promise.resolve(false);
      return run(async () => {
        if (st.mode === "hang") { await letGo(); return; }
        const y0 = st.y, r0 = st.rate;
        await tween(1.6, u => { const k = Math.sin(Math.PI * u); st.rate = lerp(r0, 5.2, k); st.y = y0 - 34 * k; st.pitch = -12 - 12 * k; });
        st.rate = 3.2; st.pitch = -12;
      });
    }
    function fly(path) {
      if (reduced) return Promise.resolve(false);
      return run(async () => {
        if (st.mode === "hang") await letGo();
        st.mode = "fly";
        const cx = opts.flyCenter ? opts.flyCenter.x : home.x + 120, cy = opts.flyCenter ? opts.flyCenter.y : home.y - 10;
        const ax = opts.flyRadius ? opts.flyRadius.x : 250, ay = opts.flyRadius ? opts.flyRadius.y : 70;
        let P;
        if (typeof path === "function") P = path;
        else if (Array.isArray(path) && path.length > 1) { const c = new T.CatmullRomCurve3(path.map(p => new T.Vector3(p.x, p.y, 0))); P = t => { const v = c.getPointAt(clamp(t, 0, 1)); return { x: v.x, y: v.y }; }; }
        else P = t => { const tau = t * Math.PI * 2; return { x: cx + ax * Math.sin(tau), y: cy + ay * Math.sin(2 * tau) }; };
        const p0 = P(0), x0 = st.x, y0 = st.y, yw0 = st.yaw;
        await tween(0.7, u => { const e = easeIO(u); st.x = lerp(x0, p0.x, e); st.y = lerp(y0, p0.y, e); st.rate = lerp(3.2, 3.6, u); });
        const Tm = 7.5; let px = st.x, py = st.y, vx = 0, vy = 0;
        await tween(Tm, (u, dt) => {
          const p = P(u); const nvx = (p.x - px) / dt, nvy = (p.y - py) / dt; px = p.x; py = p.y;
          const ax_ = (nvx - vx) / dt; vx = lerp(vx, nvx, 1 - Math.exp(-dt * 10)); vy = lerp(vy, nvy, 1 - Math.exp(-dt * 10));
          st.ax = lerp(st.ax, clamp(ax_, -900, 900), 1 - Math.exp(-dt * 5));
          st.x = p.x; st.y = p.y;
          const tyaw = clamp(vx / 150, -1, 1) * 56;
          st.yaw = lerp(st.yaw, tyaw, 1 - Math.exp(-dt * 4));
          st.roll = lerp(st.roll, -clamp(st.ax / 22, -26, 26) * Math.sign(1), 1 - Math.exp(-dt * 6));
          st.pitch = lerp(st.pitch, -10 + clamp(vy / 160, -1, 1) * 16, 1 - Math.exp(-dt * 4));
          const glide = Math.pow(Math.max(0, Math.cos(2 * u * Math.PI * 2 + 0.0)), 10);     // brief glides at the turn-arounds
          st.glide = lerp(st.glide, glide, 1 - Math.exp(-dt * 8));
          st.rate = 3.6; st.sc = 0.93 + 0.07 * Math.cos(u * Math.PI * 2);
        });
        const x1 = st.x, y1 = st.y, ya = st.yaw, ro_ = st.roll, pa = st.pitch;
        await tween(0.9, u => { const e = easeIO(u); st.x = lerp(x1, home.x, e); st.y = lerp(y1, home.y, e); st.yaw = lerp(ya, 28, e); st.roll = lerp(ro_, 0, e); st.pitch = lerp(pa, -12, e); st.sc = lerp(st.sc, 1, e); st.glide = lerp(st.glide, 0, e); st.rate = lerp(3.6, 3.2, u); });
        st.mode = "hover"; st.glide = 0;
      });
    }
    let echoing = false;
    function pulse(strong) {
      const r = rings.find(r => r.life <= 0); if (!r) return;
      B.mouthAnchor.updateWorldMatrix(true, false);
      const p = new T.Vector3().setFromMatrixPosition(B.mouthAnchor.matrixWorld);
      const q = new T.Quaternion().setFromRotationMatrix(B.mouthAnchor.matrixWorld);
      const fwd = new T.Vector3(0, 0, 1).applyQuaternion(q);
      r.m.position.copy(p); r.m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), fwd); r.dir = fwd.clone(); r.p0 = p.clone();
      r.t = 0; r.life = strong ? 1.7 : 1.4; r.m.visible = true; r.k = base() * st.sc;
    }
    async function echo() {
      if (echoing) return; echoing = true;
      try {
        for (let k = 0; k < 3; k++) {
          tween(0.24, u => { st.mouth = Math.sin(Math.PI * u) * 0.85; });
          twitch(k % 2 ? -1 : 1, 0.9); pulse(k === 2);
          await wait(0.42);
        }
        await wait(1.2);
      } finally { echoing = false; }
    }
    const twitch = (side, amt = 1) => { st.earSide = side; return tween(0.3, u => { st.earTw = amt * Math.sin(Math.PI * u); }); };
    const blinkNow = () => tween(0.42, u => { st.blink = Math.pow(Math.sin(Math.PI * u), 0.7); });

    /* ---- per-frame pose */
    const tmpA = new T.Vector3(), tmpB = new T.Vector3(), tmpC = new T.Vector3(), tmpD = new T.Vector3();
    const poseR = new Array(POSE_N), poseF = new Array(POSE_N), poseL = new Array(POSE_N);
    const J = () => ({ S: new T.Vector3(), E: new T.Vector3(), W: new T.Vector3(), Th: new T.Vector3(), p1: [0, 1, 2, 3].map(() => new T.Vector3()), p2: [0, 1, 2, 3].map(() => new T.Vector3()), A: new T.Vector3(), Sb: new T.Vector3(), Hp: new T.Vector3(), N: new T.Vector3() });
    const joints = [J(), J()];
    function collide(p, m) {          // keep a point out of the torso
      const z = p.z; if (z < -BODY.rz - 6 || z > BODY.rz + 6) return;
      const rx = BODY.rx + m, ry = BODY.ry + m, rz = BODY.rz + m, d = Math.hypot(p.x / rx, p.y / ry, z / rz);
      if (d < 1 && d > 1e-4) { p.x /= d; p.y /= d; p.z /= d; }
    }
    function shrink(p, m, w) {         // pull a point that hovers outside the torso down onto it (folded wings hug the body)
      if (w <= 0 || p.z < -BODY.rz - 4 || p.z > BODY.rz - 4) return;
      const rx = BODY.rx + m, ry = BODY.ry + m, rz = BODY.rz + m, d = Math.hypot(p.x / rx, p.y / ry, p.z / rz);
      if (d > 1) { const k = lerp(1, 1 / d, w); p.x *= k; p.y *= k; p.z *= k; }
    }
    const place = (mesh, a, b, rr) => {
      const len = tmpC.subVectors(b, a).length(); mesh.position.copy(a);
      mesh.quaternion.setFromUnitVectors(tmpD.set(0, 1, 0), tmpC.multiplyScalar(1 / (len || 1)));
      const r = rr == null ? mesh.userData.r : rr; mesh.scale.set(r, len, r);
    };
    const poly = (a, b, c, f, s, o) => (s < f ? o.lerpVectors(a, b, s / f) : o.lerpVectors(b, c, (s - f) / (1 - f)));

    function solveWing(wi, pose, collideM, wk) {
      const w = B.wings[wi], j = joints[wi], sx = w.sx, d = new T.Vector3(); collideM = sx > 0 ? 3.4 : 4.6; wk = Math.min(1, wk * 1.0);
      j.S.set(SH[0] * sx, SH[1], SH[2]);
      dirv(pose[0] * D, pose[1] * D, sx, d); j.E.copy(j.S).addScaledVector(d, L.hum); collide(j.E, collideM); shrink(j.E, collideM, wk);
      dirv(pose[2] * D, pose[3] * D, sx, d); j.W.copy(j.E).addScaledVector(d, L.fore); collide(j.W, collideM); shrink(j.W, collideM, wk);
      for (let k = 0; k < 4; k++) {
        const l1 = L.dig[k] * 0.52, l2 = L.dig[k] * 0.48;
        dirv(pose[4 + 2 * k] * D, pose[5 + 2 * k] * D, sx, d); j.p1[k].copy(j.W).addScaledVector(d, l1); collide(j.p1[k], collideM); shrink(j.p1[k], collideM, wk);
        dirv((pose[4 + 2 * k] - 4) * D, (pose[5 + 2 * k] + pose[12 + k]) * D, sx, d); j.p2[k].copy(j.p1[k]).addScaledVector(d, l2); collide(j.p2[k], collideM); shrink(j.p2[k], collideM, wk);
      }
      dirv(pose[16] * D, pose[17] * D, sx, d); j.Th.copy(j.W).addScaledVector(d, L.thumb);
      j.Hp.set(sx * 19, -6, -22); j.Sb.set(sx * 21, 1, -4);
      j.N.set(sx * 11, 7, 24);
    }

    function fillWing(wi, pose, ank, billow, tsec, foldK) {
      const w = B.wings[wi], j = joints[wi], pos = w.pos, sx = w.sx;
      const o = new T.Vector3(), o2 = new T.Vector3(), o3 = new T.Vector3(), o4 = new T.Vector3();
      const P = new T.Vector3(), Pn = new T.Vector3();
      const set = (idx, v) => { pos[idx * 3] = v.x; pos[idx * 3 + 1] = v.y; pos[idx * 3 + 2] = v.z; };
      const fing = (k, s, out) => poly(j.W, j.p1[k], j.p2[k], 0.52, clamp(s, 0, 1), out);
      const armF = L.hum / (L.hum + L.fore); const t5 = new T.Vector3(); fing(3, 0.95, t5);
      const sag = lerp(2.6, 1.0, foldK), flutter = 1.3 * (1 - foldK);
      for (const p of w.panels) {
        const { nu, nv, kind } = p;
        let C = null;
        if (kind === "plag") {
          // scalloped trailing edge from ankle to the tip of digit 5 (concave toward the arm)
          C = {
            B: (a, out) => { out.lerpVectors(ank, t5, a); const mid = o3.copy(j.W).add(j.S).multiplyScalar(0.5); o4.subVectors(mid, out).multiplyScalar(0.13 * Math.sin(Math.PI * a)); return out.add(o4); },
            Tp: (a, out) => poly(j.S, j.E, j.W, armF, a, out),
            Lf: (b, out) => (b < 0.4 ? out.lerpVectors(ank, j.Hp, b / 0.4) : b < 0.75 ? out.lerpVectors(j.Hp, j.Sb, (b - 0.4) / 0.35) : out.lerpVectors(j.Sb, j.S, (b - 0.75) / 0.25)),
            R: (b, out) => fing(3, 0.95 * (1 - b), out),
          };
        }
        for (let jj = 0; jj <= nv; jj++) for (let ii = 0; ii <= nu; ii++) {
          const a = ii / nu, b = jj / nv, idx = p.off + jj * (nu + 1) + ii;
          if (kind === "dac") {
            const k = p.k, m = 1 - 0.08 - 0.12 * Math.sin(Math.PI * b);              // scalloped trailing edge: s shortens between the fingertips
            const s = a * (a > 0.999 ? m : 1 - (1 - m) * Math.pow(a, 3));
            fing(k, s, o); fing(k + 1, s, o2); P.lerpVectors(o, o2, b);
          } else if (kind === "pro") {
            poly(j.S, j.E, j.W, armF, a, o);
            o2.lerpVectors(j.N, j.Th, a); o2.z += Math.sin(Math.PI * a) * 3.2; o2.y += Math.sin(Math.PI * a) * 1.5;
            P.lerpVectors(o, o2, b);
          } else {
            C.B(a, o); C.Tp(a, o2); const Lf = C.Lf(b, o3).clone(), R = C.R(b, o4).clone();
            const c00 = ank, c10 = t5, c01 = j.S, c11 = j.W;
            P.copy(o).multiplyScalar(1 - b).addScaledVector(o2, b).addScaledVector(Lf, 1 - a).addScaledVector(R, a)
              .addScaledVector(c00, -(1 - a) * (1 - b)).addScaledVector(c10, -a * (1 - b)).addScaledVector(c01, -(1 - a) * b).addScaledVector(c11, -a * b);
          }
          set(idx, P);
        }
        // sag / billow along the panel normal, dorsal side positive
        const at = (ii, jj) => { const i = p.off + jj * (nu + 1) + ii; return new T.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); };
        const mi = nu >> 1, mj = nv >> 1;
        const n = new T.Vector3().crossVectors(at(mi, nv).sub(at(mi, 0)), at(nu, mj).sub(at(Math.max(1, nu >> 2), mj)));
        if (n.lengthSq() > 1e-6) {
          n.normalize(); if (n.y < 0) n.negate();
          for (let jj = 0; jj <= nv; jj++) for (let ii = 0; ii <= nu; ii++) {
            const a = ii / nu, b = jj / nv, i = p.off + jj * (nu + 1) + ii;
            let env_ = Math.sin(Math.PI * b) * Math.pow(Math.sin(Math.PI * Math.min(a, 0.999) * 0.5 + 0.0), 0.8) * (kind === "dac" ? 1 : kind === "plag" ? Math.sin(Math.PI * a) * Math.sin(Math.PI * b) * 1.2 : 0.4);
            if (kind === "plag") env_ = Math.sin(Math.PI * a) * Math.sin(Math.PI * Math.min(b, 1)) * 1.3;
            const trail = kind === "dac" ? a * a : (kind === "plag" ? (1 - b) : 0);
            const disp = (-sag + billow) * env_ + flutter * trail * Math.sin(tsec * 15 + a * 6 + b * 4 + wi * 1.7) * (0.5 + 0.5 * Math.abs(billow) / 6);
            pos[i * 3] += n.x * disp; pos[i * 3 + 1] += n.y * disp; pos[i * 3 + 2] += n.z * disp;
          }
        }
        for (let jj = 0; jj <= nv; jj++) for (let ii = 0; ii <= nu; ii++) {
          const i = p.off + jj * (nu + 1) + ii; Pn.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); collide(Pn, (w.sx > 0 ? 2.6 : 3.8)); shrink(Pn, (w.sx > 0 ? 2.6 : 3.8), foldK * foldK * 0.92);
          pos[i * 3] = Pn.x; pos[i * 3 + 1] = Pn.y; pos[i * 3 + 2] = Pn.z;
        }
      }
      w.geo.attributes.position.needsUpdate = true; w.geo.computeVertexNormals();
      // bones
      place(w.bones.hum, j.S, j.E); place(w.bones.fore, j.E, j.W);
      for (let k = 0; k < 4; k++) { place(w.bones.dig[k][0], j.W, j.p1[k]); place(w.bones.dig[k][1], j.p1[k], j.p2[k]); w.joints.k[k].position.copy(j.p1[k]); }
      place(w.bones.thumb, j.W, j.Th); w.joints.e.position.copy(j.E); w.joints.w.position.copy(j.W);
      { const bk = 1 - sstep(0.4, 0.85, foldK); const vis = bk > 0.02;
        const bs = m => { m.visible = vis; if (vis) { m.scale.x *= bk; m.scale.z *= bk; } };
        bs(w.bones.hum); bs(w.bones.fore); bs(w.bones.thumb); w.bones.dig.forEach(a => a.forEach(bs));
        [w.joints.e, w.joints.w, ...w.joints.k].forEach(m => { m.visible = vis; m.scale.setScalar(m.userData.r0 * bk); }); w.claw.visible = vis; }
      w.claw.position.copy(j.Th); w.claw.quaternion.setFromUnitVectors(tmpD.set(0, 1, 0), tmpC.subVectors(j.Th, j.W).normalize().add(tmpA.set(0, -0.5, 0.2)).normalize());
    }

    const earRest = [0.0, 0.0];
    function update(dt) {
      st.t += dt; sh.uTime.value = st.t;
      const tsec = st.t;
      // idle life
      if (st.t > st.nextBlink) { st.nextBlink = st.t + 2.2 + Math.random() * 3.5; blinkNow(); }
      if (st.t > st.nextTwitch && !reduced) { st.nextTwitch = st.t + 1.6 + Math.random() * 3; twitch(Math.random() < 0.5 ? -1 : 1, 0.6); }
      if (st.t > st.nextLook) { st.nextLook = st.t + 2.5 + Math.random() * 3.5; st.lookTo = (Math.random() - 0.5) * 2; }
      if (st.t > st.nextTilt && !reduced) { st.nextTilt = st.t + 4 + Math.random() * 5; const sd = Math.random() < 0.5 ? -1 : 1; tween(1.8, u => { st.tilt = sd * 14 * Math.pow(Math.sin(Math.PI * u), 0.6); }); }
      st.look = lerp(st.look, st.lookTo, 1 - Math.exp(-dt * 2.5));
      const hanging = st.mode === "hang" && !st.busy;
      if (hanging && !reduced) st.sway = idleSway();
      if (st.mode === "hover" && !st.busy) {
        st.x = lerp(st.x, home.x, 1 - Math.exp(-dt * 2)); st.y = lerp(st.y, home.y, 1 - Math.exp(-dt * 2));
      }
      st.breath = Math.sin(st.t * (hanging ? 2.4 : 5));

      // wing phase
      st.phase = (st.phase + dt * st.rate) % 1;
      const p = st.phase, DOWN = 0.46;
      const phiAt = pp => { pp = ((pp % 1) + 1) % 1; const A_ = 44, B_ = -38; return pp < DOWN ? lerp(A_, B_, easeIO(pp / DOWN)) : lerp(B_, A_, easeIO((pp - DOWN) / (1 - DOWN))); };
      const eAt = pp => { pp = ((pp % 1) + 1) % 1; return 1 - 0.74 * sstep(DOWN, DOWN + 0.14, pp) * (1 - sstep(0.80, 0.99, pp)); };
      const eps = 0.01;
      const amp = st.amp, gl = st.glide;
      let phi = lerp(10, phiAt(p), amp * (1 - gl)), phiH = lerp(6, phiAt(p - 0.07), amp * (1 - gl));
      const e = Math.min(lerp(1, eAt(p), amp * (1 - gl)), 1 - 0.42 * st.half);
      const vel = ((phiAt(p + eps) - phiAt(p - eps)) / (2 * eps * Math.max(st.rate, 0.01))) * st.rate * amp * (1 - gl);
      flightPose(phi, e, phiH, vel, poseF);
      for (let i = 0; i < POSE_N; i++) poseR[i] = lerp(poseF[i], HANG_POSE[i], st.fold);
      // left wing = mirror (same angles), with small asymmetry from the bank
      const bank = clamp(st.roll, -30, 30) / 30;
      for (let i = 0; i < POSE_N; i++) poseL[i] = poseR[i];
      if (!st.fold) { poseR[1] += bank * 6; poseL[1] -= bank * 6; }
      B.memMat.uniforms.uFold.value = st.fold; B.fill.visible = st.fold < 0.6; B.tuft.visible = st.fold < 0.3;
      const colM = lerp(2.4, 2.0, st.fold);
      const billow = clamp(-vel / 50, -1, 1) * 6.5 * (1 - st.fold);

      // body bob / breathing
      const bob = lerp(0.4, 1, +st.hover || 0) * amp * Math.sin((p + 0.12) * Math.PI * 2) * -2.6;
      B.body.position.set(0, bob, 0);
      const br = 1 + 0.018 * st.breath * (hanging ? 1.4 : 0.8);
      B.torso.scale.set(br, br * (1 + 0.01 * st.breath), 1 + 0.01 * st.breath);

      // legs & tail (anchored); ankles used by membrane
      const ankW = [new T.Vector3(), new T.Vector3()];
      B.legs.forEach((lg, i) => {
        const sx = lg.sx, hip = tmpA.set(HIP[0] * sx, HIP[1], HIP[2]), knee = new T.Vector3(KNEE[0] * sx + sx * 2 * st.fold, KNEE[1] - 1 * st.fold, KNEE[2] + 2 * st.fold);
        const ank = new T.Vector3(ANK[0] * sx - sx * 2.5 * st.fold, ANK[1] + (st.hover ? 0 : 0), ANK[2] + 3 * st.fold + 2 * Math.sin(st.t * 3 + i) * 0.0);
        ankW[i].copy(ank);
        place(lg.thigh, hip, knee); place(lg.shin, knee, ank); lg.knee.position.copy(knee);
        lg.foot.position.copy(ank);
        const g = st.grip;
        lg.toes.forEach((t, k) => {
          const hideT = g > 0.5 && (k === 0 || k === 4); t.t1.visible = t.t2.visible = t.cl.visible = !hideT;
          const f = (k - 2) / 2, spread = f * (g > 0.5 ? 0.9 : 0.55);
          const d1 = tmpB.set(spread * 0.5 * sx * 0.6, -0.3 * g - 0.12, -1).normalize().multiplyScalar(3.4 + 0.5 * g);
          const d2 = tmpC.set(spread * 0.3 * sx * 0.6, lerp(-0.15, 1.5, g), lerp(-0.9, -0.3, g)).normalize().multiplyScalar(2.6 + 0.7 * g);
          const a = new T.Vector3(0, 0, 0), b = d1.clone(), c = b.clone().add(d2);
          place(t.t1, a, b); place(t.t2, b, c);
          t.cl.position.copy(c);
        });
        lg.heel.position.set(0, 0, 0);
        const cal = new T.Vector3(sx * 5, TAIL[1], lerp(TAIL[2] + 8, -42, st.fold)); place(lg.calcar, ank, cal); lg.calcar.visible = st.fold < 0.5;
      });
      const tailTip = new T.Vector3(TAIL[0], TAIL[1] + 0.5 * Math.sin(st.t * 2), lerp(TAIL[2], -50, st.fold));
      place(B.tail, tmpA.set(0, -6, -34), tailTip);
      // uropatagium: between the hips, the legs and the tail tip
      {
        const [nx, ny] = B.uroN, pos = B.uroGeo.attributes.position.array, hl = new T.Vector3(HIP[0], HIP[1], HIP[2] - 2), hr = new T.Vector3(-HIP[0], HIP[1], HIP[2] - 2);
        const aL = ankW[0], aR = ankW[1]; const o = new T.Vector3(), top = new T.Vector3(), bot = new T.Vector3();
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
          const a = i / nx, b = j / ny;
          top.lerpVectors(hr, hl, a); top.z -= 4 * Math.sin(Math.PI * a); top.y -= 2.5 * Math.sin(Math.PI * a) ;
          // trailing edge: left ankle -> tail tip -> right ankle (slightly scalloped)
          const aa = a * 2; if (aa < 1) bot.lerpVectors(aR, tailTip, aa); else bot.lerpVectors(tailTip, aL, aa - 1);
          bot.z += 6 * Math.sin(Math.PI * a) * 0 - 5 * Math.sin(Math.PI * a) ; bot.y -= 0;
          o.lerpVectors(top, bot, b); o.y += -1.6 * Math.sin(Math.PI * b) * (1 - st.fold) + 2.5 * st.fold * Math.sin(Math.PI * b) + 1.2 * Math.sin(st.t * 12 + i + j) * b * (1 - st.fold) * amp;
          const k = (j * (nx + 1) + i) * 3; pos[k] = o.x; pos[k + 1] = o.y; pos[k + 2] = o.z;
        }
        B.uroGeo.attributes.position.needsUpdate = true; B.uroGeo.computeVertexNormals();
      }
      solveWing(0, poseR, colM, st.fold * st.fold); solveWing(1, poseL, colM, st.fold * st.fold);
      fillWing(0, poseR, ankW[0], billow, tsec, st.fold); fillWing(1, poseL, ankW[1], billow, tsec, st.fold);

      // head, ears, eyes, jaw
      const hp = st.headPitch * D + 0.05 * st.breath * (hanging ? 1 : 0.2) + (st.mode === "fly" ? -0.12 : 0);
      B.headG.rotation.set(hp, (st.headYaw + st.look * (hanging ? 4 : 8)) * D, st.tilt * D, "YXZ");
      B.jawPivot.rotation.x = st.mouth * 0.34;
      B.smile.visible = st.mouth < 0.12; B.mouthO.visible = st.mouth >= 0.12; B.mouthO.scale.setScalar(1.0 + 1.0 * st.mouth);
      B.ears.forEach(e_ => {
        const s = e_.pivot.userData.s, twMine = (s === st.earSide ? 1 : 0.35) * st.earTw;
        e_.pivot.rotation.set(-0.18, 0, 0); e_.inner.rotation.set(0.25 * twMine - 0.1, s * 0.07 * twMine, -s * (0.6 + 0.07 * st.mouth * 2 + 0.2 * twMine));
        e_.inner.rotation.x += 0.0; e_.pivot.position.y = 10.5;
      });
      B.eyes.forEach(ey => { const c = st.blink; ey.m.scale.y = 1 - 0.93 * c; ey.hl.visible = c < 0.5; ey.hl.userData.h2.visible = c < 0.5; });

      // fur: gravity droop + sway lag
      const f = tmpA.set(0, -1.4 - 0.5 * st.fold, 0).multiplyScalar(base() * st.sc);
      B.torsoMat.uniforms.uForce.value.copy(f); B.headMat.uniforms.uForce.value.copy(f).multiplyScalar(0.5); B.jawMat.uniforms.uForce.value.copy(f).multiplyScalar(0.4);

      // root transform
      const q = bodyQuat(); B.rig.quaternion.copy(q);
      const k = base() * st.sc; B.rig.scale.setScalar(k);
      const free = { x: st.x, y: st.y, z: st.z }, pinned = solveBodyPos();
      const X = lerp(free.x, pinned.x, st.pin), Y = lerp(free.y, pinned.y, st.pin), Z = lerp(free.z, pinned.z, st.pin);
      B.rig.position.set(X, -Y, Z); lastPose.x = X; lastPose.y = Y; lastPose.q = q; lastPose.k = k;

      // shadow / contact shadow
      {
        const spread = 190 * k * (1 - st.fold * 0.7);
        if (st.pin > 0.5 && opts.shadow) {
          blob.position.set(branch.x, -(branch.y + 4), -6); blob.scale.set(86 * k + 20, 24 * k + 8, 1); blobMat.opacity = 0.42 * (blobMat.userData.k ?? 1) * st.pin;
        } else if (opts.shadow && !opts.noDrop) {
          blob.position.set(X + 26, -(Y + 70 * k), -120); blob.scale.set(spread * 1.5, 40 * k + 10, 1); blobMat.opacity = 0.13 * (blobMat.userData.k ?? 1) * (1 - st.pin);
        } else blobMat.opacity = 0;
      }
      // sonar rings
      for (const r of rings) {
        if (r.life <= 0) continue;
        r.t += dt; const u = r.t / r.life;
        if (u >= 1) { r.life = 0; r.m.visible = false; continue; }
        const rad = (5 + 96 * easeOut(u)) * r.k; r.m.scale.setScalar(rad);
        r.m.position.copy(r.p0).addScaledVector(r.dir, 110 * r.k * easeOut(u));
        r.m.material.opacity = 0.6 * Math.pow(1 - u, 1.6) * sstep(0, 0.06, u); r.fill.material.opacity = 0.05 * Math.pow(1 - u, 2);
      }
    }

    /* ---- main loop */
    // while the opening film covers the page, only the opening's own Terry is drawn; the others keep moving exactly as before
    // (so they are where they should be when the house lights come up) but skip the drawing, which is the expensive part
    const docEl = document.documentElement, mine = !!container.closest("#opening");
    const covered = () => !mine && docEl.classList.contains("op-run") && !docEl.classList.contains("op-lit");
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!visible || frozen) { last = null; return; }
      let dt = last == null ? 1 / 60 : Math.min((now - last) / 1000, 0.05); last = now;
      dt *= st.speed; if (reduced && st.mode !== "hang") hangNow();
      stepTweens(dt); update(dt); if (!covered()) renderer.render(scene, camera);
    }
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); io.observe(container);
    if (opts.hang || reduced) hangNow();
    raf = requestAnimationFrame(frame);

    const api = {
      flap, fly, flip, echo, hangNow,
      setHome(x, y) { home.x = x; home.y = y; }, setBranch(x, y) { branch.x = x; branch.y = y; },
      // page-pixel point of a body landmark, from the last drawn frame: anchor("feet") is where the claws are (x right, y down)
      anchor(name) { if (name !== "feet" || !lastPose.q) return { x: lastPose.x, y: lastPose.y }; const v = footWorld(lastPose.q, lastPose.k); return { x: lastPose.x + v.x, y: lastPose.y - v.y }; },
      setScale(k) { st.sc = k; }, setSpeed(k) { st.speed = k; }, setTheme, mode: () => st.mode, busy: () => st.busy,
      destroy() { destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); cvs.remove(); },
      // test hooks
      _debug: { st, scene, camera, renderer, B, freeze(v) { frozen = v; }, step(dt = 1 / 60, n = 1, noRender) { for (let i = 0; i < n; i++) { stepTweens(dt); update(dt); } if (!noRender) renderer.render(scene, camera); } },
    };
    return api;
  }
  window.TerryBat3D = { create };
})();
