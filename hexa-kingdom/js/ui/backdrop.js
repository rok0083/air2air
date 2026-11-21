/* =========================================================================
   배경 — 월드(모드)마다 살아 움직이는 풍경
   -------------------------------------------------------------------------
   보드 뒤에 깔리는 장식 레이어입니다. 퍼즐(60fps)과 렌더 예산을 나누기 위해
   배경은 30fps 로만 그리고, 모든 요소를 '시간의 함수'로 계산해 상태 갱신을
   최소화했습니다. (새로고침해도 같은 풍경 = seed 고정)

   · 1 푸른 초원   : 햇살 언덕 · 성 실루엣 · 구름 · 반딧불
   · 2 얼음 왕국   : 오로라 · 얼음 봉우리 · 눈송이 · 서리 반짝임
   · 3 불타는 사막 : 노을 사구 · 피라미드 · 야자수 · 불티
   · 4 수정 정글   : 빛줄기 · 수정 결정 · 포자 · 안개
   · 5 그림자 성   : 폭풍 하늘 · 성탑 · 번개 · 마법 룬 · 보랏빛 불티
   · blitz         : 전기 금빛/코발트 아케이드 오라 · 회전 광선

   화면 구성 메모: 세로 화면에서 보드는 가운데를 크게 차지하므로, 풍경의
   초점(지평선)은 0.46H 근처에 두고 성탑·봉우리·피라미드처럼 '높이 솟는'
   요소가 보드 위 하늘 띠(0~0.25H)로 올라오게, 앞쪽 언덕·풀·불티는 보드
   아래 띠(0.67H~)에 보이게 배치했습니다.
   prefers-reduced-motion 이면 정지 화면 한 장만 그립니다.
   ========================================================================= */

const TAU = Math.PI * 2;

function seeded(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* 부드러운 빛 덩어리 스프라이트 — 매 프레임 그라디언트를 만드는 대신 한 번만 그려 재사용 */
function glowSprite(color) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color.replace(/,\s*1\)$/, ',0.55)'));
  g.addColorStop(1, color.replace(/,\s*1\)$/, ',0)'));
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

const sprites = {};
function sprite(name) {
  if (sprites[name]) return sprites[name];
  const rgb = {
    gold: '255,226,130',
    ember: '255,150,70',
    snow: '225,245,255',
    mint: '140,255,205',
    violet: '178,120,255',
    aqua: '150,235,255',
    cobalt: '110,160,255',
  }[name] || '255,226,130';
  sprites[name] = glowSprite(`rgba(${rgb},1)`);
  return sprites[name];
}

/* ── 공용 도형 ─────────────────────────────────────────────── */

function hill(ctx, W, H, o) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 10; x += 10) {
    const y = o.base * H
      + Math.sin(x * o.k + o.ph) * o.amp * H
      + Math.sin(x * o.k * 2.3 + o.ph * 1.7) * o.amp * H * 0.32;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = o.color;
  ctx.fill();
}

/* 언덕 능선의 빛 — 위에서 비치는 햇살/눈을 표현 */
function crest(ctx, W, H, o) {
  ctx.beginPath();
  for (let x = 0; x <= W + 10; x += 10) {
    const y = o.base * H
      + Math.sin(x * o.k + o.ph) * o.amp * H
      + Math.sin(x * o.k * 2.3 + o.ph * 1.7) * o.amp * H * 0.32;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = o.color;
  ctx.lineWidth = o.w || 2;
  ctx.stroke();
}

function cloudBlob(ctx, x, y, s, a, tint = '255,255,255') {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = `rgb(${tint})`;
  const parts = [[-0.6, 0.1, 0.42], [-0.2, -0.16, 0.55], [0.3, -0.05, 0.5], [0.66, 0.14, 0.34], [0.05, 0.2, 0.44]];
  for (const [dx, dy, rr] of parts) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, rr * s, rr * s * 0.72, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* 멀리 보이는 성 실루엣 — 보드 위로 솟아 보이도록 크게 그린다 */
function castleSil(ctx, cx, baseY, u, color, t) {
  ctx.save();
  ctx.fillStyle = color;
  const tower = (x, w, h, roof) => {
    ctx.fillRect(x - w / 2, baseY - h, w, h);
    if (roof) {
      const apexY = baseY - h - w * 1.35;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.78, baseY - h);
      ctx.lineTo(x, apexY);
      ctx.lineTo(x + w * 0.78, baseY - h);
      ctx.closePath();
      ctx.fill();
      return apexY;
    }
    ctx.fillRect(x - w * 0.62, baseY - h - u * 0.9, w * 1.24, u * 0.9);
    return null;
  };
  ctx.fillRect(cx - u * 10, baseY - u * 6, u * 20, u * 6);       // 성벽
  tower(cx - u * 8.6, u * 2.8, u * 13, true);                    // 좌 탑
  tower(cx + u * 8.6, u * 2.8, u * 13, true);                    // 우 탑
  tower(cx - u * 3.6, u * 2.2, u * 9, false);
  tower(cx + u * 3.6, u * 2.2, u * 9, false);
  const apex = tower(cx, u * 3.6, u * 20, true);                 // 중앙 탑
  // 깃대 + 깃발
  if (apex != null) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, u * 0.18);
    ctx.beginPath();
    ctx.moveTo(cx, apex);
    ctx.lineTo(cx, apex - u * 3);
    ctx.stroke();
    const fw = u * 2.2 + Math.sin(t * 2.1) * u * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, apex - u * 3);
    ctx.quadraticCurveTo(cx + fw * 0.6, apex - u * 2.6, cx + fw, apex - u * 2.2);
    ctx.lineTo(cx, apex - u * 1.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,206,110,0.85)';
    ctx.fill();
  }
  // 창문 불빛
  ctx.fillStyle = 'rgba(255,226,150,0.55)';
  for (const [dx, dy] of [[-8.6, -7], [8.6, -7], [-3.6, -5], [3.6, -5], [0, -13], [0, -7]]) {
    ctx.fillRect(cx + dx * u, baseY + dy * u, u * 0.85, u * 1.2);
  }
  ctx.restore();
}

/* 사막 피라미드 */
function pyramid(ctx, x, baseY, w, hh, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, baseY - hh);
  ctx.lineTo(x + w / 2, baseY);
  ctx.lineTo(x - w / 2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,150,0.16)';
  ctx.beginPath();
  ctx.moveTo(x, baseY - hh);
  ctx.lineTo(x + w / 2, baseY);
  ctx.lineTo(x + w * 0.06, baseY);
  ctx.closePath();
  ctx.fill();
}

/* 사막 유적 — 뾰족한 오벨리스크 */
function obelisk(ctx, x, baseY, h, w, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, baseY);
  ctx.lineTo(x - w * 0.34, baseY - h * 0.9);
  ctx.lineTo(x, baseY - h);
  ctx.lineTo(x + w * 0.34, baseY - h * 0.9);
  ctx.lineTo(x + w / 2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,150,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, baseY - h * 0.85);
  ctx.lineTo(x - w * 0.1, baseY - h * 0.1);
  ctx.stroke();
}

/* 그림자 성의 뾰족한 탑 */
function spire(ctx, x, baseY, w, hh, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, baseY - hh, w, hh);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.85, baseY - hh);
  ctx.lineTo(x, baseY - hh - w * 2.8);
  ctx.lineTo(x + w * 0.85, baseY - hh);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, baseY - hh - w * 2.8);
  ctx.lineTo(x + w * 0.12, baseY - hh - w * 4);
  ctx.lineTo(x - w * 0.12, baseY - hh - w * 4);
  ctx.closePath();
  ctx.fill();
}

/* 마법 룬 원 */
function runeRing(ctx, x, y, r, t, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke();
  ctx.rotate(t * 0.12);
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.lineTo(Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97);
    ctx.stroke();
  }
  ctx.rotate(-t * 0.3);
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, -r * 0.24);
  ctx.lineTo(r * 0.42, -r * 0.24);
  ctx.lineTo(0, r * 0.42);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/* ── 장면 ─────────────────────────────────────────────────── */
/* 모든 장면은 (ctx, W, H, t, state) 를 받고, 화면 전체를 칠합니다. */

function sceneMeadow(ctx, W, H, t, st) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.52);
  sky.addColorStop(0, '#2d7f9c');
  sky.addColorStop(0.22, '#46aab8');
  sky.addColorStop(0.5, '#89d8ae');
  sky.addColorStop(0.74, '#cfeaa6');
  sky.addColorStop(1, '#fdf6cc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 해와 햇살
  const sunX = W * 0.72, sunY = H * 0.115;
  const sr = W * 0.42;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sr);
  sunGlow.addColorStop(0, 'rgba(255,252,230,0.95)');
  sunGlow.addColorStop(0.12, 'rgba(255,240,180,0.6)');
  sunGlow.addColorStop(0.42, 'rgba(255,222,130,0.22)');
  sunGlow.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath(); ctx.arc(sunX, sunY, sr, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff5c2';
  ctx.beginPath(); ctx.arc(sunX, sunY, W * 0.055, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,238,170,0.55)';
  ctx.beginPath(); ctx.arc(sunX, sunY, W * 0.075, 0, TAU); ctx.fill();

  // 구름
  for (const c of st.clouds) {
    const x = (((c.x + t * c.v) % 1.3) - 0.15) * W;
    cloudBlob(ctx, x, c.y * H, c.s * W, c.a);
  }

  // 멀리 나는 새
  ctx.strokeStyle = 'rgba(28,60,52,0.55)';
  ctx.lineWidth = 1.6;
  for (const b of st.birds) {
    const x = (((b.x + t * b.v) % 1.3) - 0.15) * W;
    const y = b.y * H + Math.sin(t * 0.8 + b.ph) * 4;
    const s = b.s;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.7, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.7, x + s, y);
    ctx.stroke();
  }

  // 지평선의 성
  castleSil(ctx, W * 0.26, H * 0.475, W * 0.0295, 'rgba(36,86,74,0.95)', t);

  // 겹겹 언덕
  hill(ctx, W, H, { base: 0.475, amp: 0.014, k: 0.004, ph: 0.4 + t * 0.04, color: '#79c98a' });
  hill(ctx, W, H, { base: 0.55, amp: 0.03, k: 0.006, ph: 2.1 + t * 0.06, color: '#4fa96b' });
  hill(ctx, W, H, { base: 0.66, amp: 0.035, k: 0.009, ph: 4.2 + t * 0.08, color: '#2f8354' });
  crest(ctx, W, H, { base: 0.66, amp: 0.035, k: 0.009, ph: 4.2 + t * 0.08, color: 'rgba(214,246,180,0.5)', w: 2.4 });
  hill(ctx, W, H, { base: 0.78, amp: 0.028, k: 0.013, ph: 1.1 + t * 0.1, color: '#1c643f' });

  // 바람에 흔들리는 풀잎
  ctx.lineCap = 'round';
  for (const b of st.grass) {
    const sway = Math.sin(t * b.sp + b.ph) * b.amp;
    ctx.strokeStyle = b.c;
    ctx.globalAlpha = b.a;
    ctx.lineWidth = b.w;
    ctx.beginPath();
    ctx.moveTo(b.x * W, H + 2);
    ctx.quadraticCurveTo(b.x * W + sway * 0.45, H - b.h * H * 0.55, b.x * W + sway, H - b.h * H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 반딧불 · 꽃가루
  ctx.globalCompositeOperation = 'lighter';
  for (const f of st.flies) {
    const x = (f.x + Math.sin(t * f.sx + f.ph) * f.dx) * W;
    const y = (f.y + Math.cos(t * f.sy + f.ph * 1.7) * f.dy) * H;
    const pulse = 0.5 + 0.5 * Math.sin(t * f.p + f.ph);
    const r = f.r * (0.6 + pulse * 0.9);
    ctx.globalAlpha = 0.35 + pulse * 0.5;
    ctx.drawImage(sprite('gold'), x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function sceneFrost(ctx, W, H, t, st) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, '#102a58');
  sky.addColorStop(0.34, '#1b5580');
  sky.addColorStop(0.66, '#2c8ba6');
  sky.addColorStop(1, '#9adcdf');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 별
  for (const s of st.stars) {
    const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.p + s.ph));
    ctx.globalAlpha = tw * s.a;
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H * 0.42, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 달
  const mx = W * 0.79, my = H * 0.11, mr = W * 0.062;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(sprite('snow'), mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(233,246,255,0.95)';
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(184,208,232,0.4)';
  ctx.beginPath(); ctx.arc(mx + mr * 0.25, my - mr * 0.2, mr * 0.22, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(mx - mr * 0.3, my + mr * 0.28, mr * 0.15, 0, TAU); ctx.fill();

  // 오로라 — 넓은 붓터치를 여러 겹 겹쳐 빛의 띠를 만든다
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const bands = [
    { y: 0.1, amp: 0.028, k: 0.0075, sp: 0.22, color: '92,240,200', w: 54 },
    { y: 0.165, amp: 0.034, k: 0.0058, sp: -0.17, color: '110,165,255', w: 68 },
    { y: 0.225, amp: 0.026, k: 0.0098, sp: 0.13, color: '176,108,255', w: 42 },
  ];
  for (const b of bands) {
    for (let layer = 0; layer < 4; layer++) {
      ctx.strokeStyle = `rgba(${b.color},${0.11 - layer * 0.018})`;
      ctx.lineWidth = b.w * (1 - layer * 0.22);
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 12) {
        const y = b.y * H
          + Math.sin(x * b.k + t * b.sp + layer * 0.5) * b.amp * H
          + Math.sin(x * b.k * 2.4 + t * b.sp * 0.7) * b.amp * H * 0.45;
        x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  // 얼음 봉우리 (정상이 보드 위로 솟는다)
  const peaks = (base, color, amp, seed, capColor) => {
    const r = seeded(seed);
    const apexes = [];
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, base * H);
    let x = 0;
    while (x < W) {
      const w = W * (0.13 + r() * 0.13);
      const hh = H * amp * (0.5 + r() * 0.8);
      const ax = x + w * 0.5, ay = base * H - hh;
      ctx.lineTo(ax, ay);
      apexes.push([ax, ay, w, hh]);
      x += w;
      ctx.lineTo(x, base * H + H * 0.01);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (!capColor) return;
    ctx.fillStyle = capColor;
    for (const [ax, ay, w, hh] of apexes) {
      const cw = w * 0.17, ch = hh * 0.26;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + cw, ay + ch);
      ctx.lineTo(ax + cw * 0.2, ay + ch * 0.6);
      ctx.lineTo(ax, ay + ch * 1.05);
      ctx.lineTo(ax - cw * 0.45, ay + ch * 0.62);
      ctx.lineTo(ax - cw, ay + ch);
      ctx.closePath();
      ctx.fill();
    }
  };
  peaks(0.5, '#2b6b8f', 0.27, 21, 'rgba(226,246,255,0.75)');
  peaks(0.6, '#17496b', 0.2, 77, 'rgba(205,236,255,0.5)');
  // 눈 덮인 앞쪽 언덕
  hill(ctx, W, H, { base: 0.72, amp: 0.03, k: 0.006, ph: 1.2 + t * 0.05, color: '#17415c' });
  crest(ctx, W, H, { base: 0.72, amp: 0.03, k: 0.006, ph: 1.2 + t * 0.05, color: 'rgba(196,232,255,0.45)' });
  hill(ctx, W, H, { base: 0.85, amp: 0.03, k: 0.009, ph: 3.6 + t * 0.06, color: '#0e2c42' });
  crest(ctx, W, H, { base: 0.85, amp: 0.03, k: 0.009, ph: 3.6 + t * 0.06, color: 'rgba(180,220,255,0.3)' });

  // 눈발
  for (const f of st.snow) {
    const y = ((f.y + t * f.v) % 1.12) * H;
    const x = (f.x + Math.sin(t * f.sp + f.ph) * f.dx) * W;
    ctx.globalAlpha = f.a;
    ctx.fillStyle = '#eaf7ff';
    ctx.beginPath(); ctx.arc(x, y, f.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 서리 반짝임
  ctx.globalCompositeOperation = 'lighter';
  for (const s of st.sparkle) {
    const tw = Math.sin(t * s.p + s.ph);
    if (tw < 0.35) continue;
    const k = (tw - 0.35) / 0.65;
    const x = s.x * W, y = s.y * H, r = s.r * (0.6 + k * 0.8);
    ctx.globalAlpha = k * 0.85;
    ctx.drawImage(sprite('snow'), x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function sceneDesert(ctx, W, H, t, st) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.52);
  sky.addColorStop(0, '#4a1220');
  sky.addColorStop(0.22, '#8f2f1f');
  sky.addColorStop(0.48, '#cf6a27');
  sky.addColorStop(0.72, '#f6ae4f');
  sky.addColorStop(1, '#ffe0a0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 하늘 높이 뜬 해
  const sunX = W * 0.31, sunY = H * 0.15, sunR = W * 0.085;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.95;
  ctx.drawImage(sprite('ember'), sunX - sunR * 4, sunY - sunR * 4, sunR * 8, sunR * 8);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const sunG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
  sunG.addColorStop(0, '#fff6d2');
  sunG.addColorStop(1, 'rgba(255,190,90,0.85)');
  ctx.fillStyle = sunG;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, TAU); ctx.fill();

  // 멀리 구름 띠
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = '#ffd8a0';
  for (const c of st.haze) {
    const x = (((c.x + t * c.v) % 1.4) - 0.2) * W;
    ctx.beginPath();
    ctx.ellipse(x, c.y * H, c.w * W, c.h * H, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 피라미드 · 신전 기둥
  pyramid(ctx, W * 0.22, H * 0.52, W * 0.44, H * 0.32, '#54241a');
  pyramid(ctx, W * 0.58, H * 0.525, W * 0.28, H * 0.21, '#43190f');
  ctx.fillStyle = '#3f1810';
  for (let i = 0; i < 5; i++) ctx.fillRect(W * (0.78 + i * 0.045), H * 0.44, W * 0.022, H * 0.085);
  ctx.fillRect(W * 0.77, H * 0.43, W * 0.25, H * 0.014);

  // 잊힌 유적의 오벨리스크
  obelisk(ctx, W * 0.1, H * 0.535, H * 0.36, W * 0.05, 'rgba(66,28,16,0.95)');
  obelisk(ctx, W * 0.17, H * 0.545, H * 0.24, W * 0.038, 'rgba(60,26,15,0.85)');
  obelisk(ctx, W * 0.93, H * 0.545, H * 0.2, W * 0.034, 'rgba(60,26,15,0.8)');

  // 높이 나는 독수리
  ctx.strokeStyle = 'rgba(48,18,10,0.6)';
  ctx.lineWidth = 1.7;
  for (const b2 of st.birds) {
    const x = (((b2.x + t * b2.v) % 1.3) - 0.15) * W;
    const y = b2.y * H + Math.sin(t * 0.5 + b2.ph) * 8;
    const sz = b2.s;
    ctx.beginPath();
    ctx.moveTo(x - sz, y);
    ctx.quadraticCurveTo(x - sz * 0.35, y - sz * 0.75, x, y);
    ctx.quadraticCurveTo(x + sz * 0.35, y - sz * 0.75, x + sz, y);
    ctx.stroke();
  }

  // 사구 3겹
  hill(ctx, W, H, { base: 0.525, amp: 0.02, k: 0.0032, ph: 0.6 + t * 0.03, color: '#e2a05c' });
  hill(ctx, W, H, { base: 0.63, amp: 0.03, k: 0.0052, ph: 2.4 + t * 0.05, color: '#b87736' });
  hill(ctx, W, H, { base: 0.76, amp: 0.03, k: 0.008, ph: 4.6 + t * 0.06, color: '#845021' });

  // 사구 능선의 열기 물결
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#ffe0a8';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) {
      const y = H * (0.62 + i * 0.025) + Math.sin(x * 0.02 + t * 1.4 + i) * 3;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 피어오르는 불티와 모래 먼지
  ctx.globalCompositeOperation = 'lighter';
  for (const e of st.embers) {
    const y = ((e.y - t * e.v) % 1.1 + 1.1) % 1.1;
    const x = (e.x + Math.sin(t * e.sp + e.ph) * e.dx) * W;
    const flick = 0.45 + 0.55 * Math.sin(t * e.p + e.ph);
    const r = e.r * (0.7 + flick * 0.6);
    ctx.globalAlpha = (1 - y) * flick * 0.9;
    ctx.drawImage(sprite('ember'), x - r, y * H - r, r * 2, r * 2);
  }
  for (const d of st.dust) {
    const x = (((d.x + t * d.v) % 1.2) - 0.1) * W;
    const y = (d.y + Math.sin(t * d.sp + d.ph) * 0.01) * H;
    ctx.globalAlpha = d.a * (0.5 + 0.5 * Math.sin(t * d.p + d.ph));
    ctx.fillStyle = '#ffe3a8';
    ctx.beginPath(); ctx.arc(x, y, d.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function sceneJungle(ctx, W, H, t, st) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#103d2c');
  sky.addColorStop(0.3, '#1c6d4b');
  sky.addColorStop(0.62, '#2a9a72');
  sky.addColorStop(0.88, '#43c795');
  sky.addColorStop(1, '#176349');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 수정 빛무리
  ctx.globalCompositeOperation = 'lighter';
  for (const c of st.halos) {
    const pulse = 0.55 + 0.45 * Math.sin(t * c.p + c.ph);
    const r = c.r * W * (0.9 + pulse * 0.15);
    ctx.globalAlpha = 0.12 + pulse * 0.12;
    ctx.drawImage(sprite(c.tint), c.x * W - r, c.y * H - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 위에서 내려오는 빛줄기
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of st.beams) {
    const pulse = 0.5 + 0.5 * Math.sin(t * b.p + b.ph);
    const x0 = b.x * W + Math.sin(t * 0.15 + b.ph) * W * 0.02;
    const wTop = W * b.w;
    const wBot = W * b.w * 2.4;
    const g = ctx.createLinearGradient(x0, 0, x0 + W * 0.1, H * 0.62);
    g.addColorStop(0, `rgba(212,255,232,${0.17 + pulse * 0.12})`);
    g.addColorStop(0.75, `rgba(150,245,200,${0.05 + pulse * 0.05})`);
    g.addColorStop(1, 'rgba(140,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - wTop / 2, 0);
    ctx.lineTo(x0 + wTop / 2, 0);
    ctx.lineTo(x0 + wBot / 2 + W * 0.1, H * 0.62);
    ctx.lineTo(x0 - wBot / 2 + W * 0.1, H * 0.62);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 캐노피(위쪽 잎 그늘)
  for (const c of st.canopy) {
    for (let layer = 0; layer < 3; layer++) {
      ctx.globalAlpha = 0.5 - layer * 0.12;
      ctx.fillStyle = '#04241a';
      ctx.beginPath();
      ctx.ellipse(c.x * W, c.y * H + layer * H * 0.012, c.w * W * (1 + layer * 0.18), c.h * H * (1 + layer * 0.2), 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // 캐노피 아래로 늘어진 잎
  ctx.fillStyle = '#052a1c';
  for (const c of st.canopy) {
    for (let i = -2; i <= 2; i++) {
      const lx = c.x * W + i * c.w * W * 0.34;
      const ly = c.y * H + c.h * H * 1.05;
      const ls = c.h * H * 0.75;
      ctx.beginPath();
      ctx.ellipse(lx, ly + ls * 0.35, ls * 0.24, ls * 0.5, i * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  // 늘어진 덩굴
  ctx.strokeStyle = 'rgba(28,86,56,0.85)';
  ctx.lineWidth = 2.6;
  for (const v of st.vines) {
    const sway = Math.sin(t * v.p + v.ph) * W * 0.014;
    const x0 = v.x * W;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.bezierCurveTo(x0 + sway * 2.4, v.len * H * 0.35, x0 - sway * 2.2, v.len * H * 0.7, x0 + sway, v.len * H);
    ctx.stroke();
    // 잎
    ctx.fillStyle = 'rgba(52,150,96,0.9)';
    ctx.beginPath();
    ctx.ellipse(x0 + sway, v.len * H, W * 0.02, W * 0.008, 0.6 + sway * 0.02, 0, TAU);
    ctx.fill();
  }

  // 지평선의 수정 결정 (끝이 보드 위로 솟는다)
  ctx.globalCompositeOperation = 'lighter';
  for (const k of st.crystals) {
    const pulse = 0.55 + 0.45 * Math.sin(t * k.p + k.ph);
    const x = k.x * W, y = k.y * H, s = k.s * W;
    ctx.globalAlpha = 0.18 + pulse * 0.22;
    ctx.drawImage(sprite(k.tint), x - s * 2, y - s * 1.8, s * 4, s * 4);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const k of st.crystals) {
    const pulse = 0.55 + 0.45 * Math.sin(t * k.p + k.ph);
    const x = k.x * W, y = k.y * H, s = k.s * W;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2.4);
    ctx.lineTo(x + s * 0.5, y - s * 0.3);
    ctx.lineTo(x + s * 0.22, y + s * 1.2);
    ctx.lineTo(x - s * 0.22, y + s * 1.2);
    ctx.lineTo(x - s * 0.5, y - s * 0.3);
    ctx.closePath();
    ctx.fillStyle = `rgba(${k.rgb},${0.45 + pulse * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(235,255,245,${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  // 하늘에 떠 있는 수정 조각
  ctx.globalCompositeOperation = 'lighter';
  for (const f of st.shards) {
    const x = f.x * W, y = f.y * H + Math.sin(t * f.p + f.ph) * H * 0.012, s2 = f.s * W;
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * f.p * 1.3 + f.ph);
    ctx.drawImage(sprite(f.tint), x - s2 * 2.2, y - s2 * 2.2, s2 * 4.4, s2 * 4.4);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const f of st.shards) {
    const x = f.x * W, y = f.y * H + Math.sin(t * f.p + f.ph) * H * 0.012, s2 = f.s * W;
    ctx.beginPath();
    ctx.moveTo(x, y - s2 * 1.7);
    ctx.lineTo(x + s2 * 0.5, y + s2 * 0.1);
    ctx.lineTo(x, y + s2 * 1.6);
    ctx.lineTo(x - s2 * 0.5, y + s2 * 0.1);
    ctx.closePath();
    ctx.fillStyle = `rgba(${f.rgb},0.8)`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(244,255,250,0.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 앞쪽 숲 그늘
  hill(ctx, W, H, { base: 0.72, amp: 0.03, k: 0.006, ph: 1.9 + t * 0.05, color: '#0b3524' });
  hill(ctx, W, H, { base: 0.84, amp: 0.026, k: 0.01, ph: 4.4 + t * 0.07, color: '#062418' });

  // 앞쪽 고사리 잎
  ctx.strokeStyle = 'rgba(28,110,70,0.9)';
  ctx.lineCap = 'round';
  for (const f of st.ferns) {
    const sway = Math.sin(t * 0.7 + f.ph) * f.sw;
    ctx.lineWidth = 2.2;
    for (let i = -2; i <= 2; i++) {
      const a = -Math.PI / 2 + i * 0.42 + sway * 0.02;
      ctx.beginPath();
      ctx.moveTo(f.x * W, H + 4);
      ctx.quadraticCurveTo(
        f.x * W + Math.cos(a) * f.h * W * 0.3, H - f.h * H * 0.55,
        f.x * W + Math.cos(a) * f.h * W * 0.55 + sway, H - f.h * H,
      );
      ctx.stroke();
    }
  }

  // 바닥 안개
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#b9ffdc';
  for (const m of st.mist) {
    const x = (((m.x + t * m.v) % 1.4) - 0.2) * W;
    ctx.beginPath();
    ctx.ellipse(x, m.y * H, m.w * W, m.h * H, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 포자
  ctx.globalCompositeOperation = 'lighter';
  for (const s of st.spores) {
    const y = ((s.y - t * s.v) % 1.1 + 1.1) % 1.1;
    const x = (s.x + Math.sin(t * s.sp + s.ph) * s.dx) * W;
    const pulse = 0.5 + 0.5 * Math.sin(t * s.p + s.ph);
    const r = s.r * (0.7 + pulse * 0.7);
    ctx.globalAlpha = (0.45 + pulse * 0.5) * s.a;
    ctx.drawImage(sprite(s.tint), x - r, y * H - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function sceneShadow(ctx, W, H, t, st) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#0d0619');
  sky.addColorStop(0.28, '#2a1348');
  sky.addColorStop(0.58, '#4e2470');
  sky.addColorStop(0.82, '#7d3f8f');
  sky.addColorStop(1, '#3a1c52');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 폭풍 구름
  for (const c of st.clouds) {
    const x = (((c.x + t * c.v) % 1.3) - 0.15) * W;
    cloudBlob(ctx, x, c.y * H, c.s * W, c.a, '44,24,74');
  }

  // 하늘의 룬 봉인
  runeRing(ctx, W * 0.5, H * 0.14, W * 0.22, t, '#c08cff', 0.32);
  runeRing(ctx, W * 0.5, H * 0.14, W * 0.145, -t * 0.8, '#8fe0ff', 0.2);

  // 성이 앉은 먼 능선 (지평선 = 보드 위 가장자리)
  const baseY = H * 0.305;
  const ridge = (base, color, amp, seed) => {
    const r = seeded(seed);
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, base * H);
    let x = 0;
    while (x < W) {
      const w = W * (0.16 + r() * 0.16);
      ctx.lineTo(x + w * 0.5, base * H - H * amp * (0.4 + r() * 0.8));
      x += w;
      ctx.lineTo(x, base * H + H * 0.01);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(0.315, '#241338', 0.05, 5);

  // 성 — 몸통 + 뾰족 지붕 + 불 켜진 창
  const stone = '#1d1233';
  const tower = (x, w, top, roofH) => {
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#150c26');
    g.addColorStop(0.35, stone);
    g.addColorStop(1, '#0f0819');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, top, w, baseY - top);
    ctx.strokeStyle = 'rgba(178,132,250,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, top, w, baseY - top);
    // 창
    const rows = Math.max(1, Math.round((baseY - top) / (H * 0.032)));
    for (let i = 0; i < rows; i++) {
      const wy = top + H * 0.016 + i * H * 0.03;
      if (wy > baseY - H * 0.012) break;
      const flick = 0.5 + 0.5 * Math.sin(t * (1.4 + i * 0.4) + x);
      ctx.fillStyle = `rgba(208,166,255,${0.45 + flick * 0.5})`;
      ctx.fillRect(x - w * 0.2, wy, w * 0.16, H * 0.013);
      ctx.fillRect(x + w * 0.04, wy, w * 0.16, H * 0.013);
    }
    // 지붕
    const roof = ctx.createLinearGradient(x - w * 0.7, top - roofH, x + w * 0.7, top);
    roof.addColorStop(0, '#241242');
    roof.addColorStop(1, '#0e0718');
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.72, top);
    ctx.lineTo(x, top - roofH);
    ctx.lineTo(x + w * 0.72, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(186,140,255,0.55)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // 꼭대기 깃발
    ctx.strokeStyle = 'rgba(190,150,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(x, top - roofH);
    ctx.lineTo(x, top - roofH - H * 0.026);
    ctx.stroke();
    const fw = W * 0.03 + Math.sin(t * 2 + x) * W * 0.004;
    ctx.fillStyle = 'rgba(196,128,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(x, top - roofH - H * 0.026);
    ctx.lineTo(x + fw, top - roofH - H * 0.018);
    ctx.lineTo(x, top - roofH - H * 0.009);
    ctx.closePath();
    ctx.fill();
  };

  // 성벽
  ctx.fillStyle = stone;
  ctx.fillRect(W * 0.04, baseY - H * 0.05, W * 0.92, H * 0.05);
  for (let i = 0; i < 13; i++) ctx.fillRect(W * (0.05 + i * 0.072), baseY - H * 0.062, W * 0.034, H * 0.014);
  tower(W * 0.10, W * 0.075, H * 0.2, H * 0.085);
  tower(W * 0.28, W * 0.09, H * 0.155, H * 0.105);
  tower(W * 0.5, W * 0.12, H * 0.1, H * 0.13);
  tower(W * 0.72, W * 0.09, H * 0.16, H * 0.1);
  tower(W * 0.9, W * 0.075, H * 0.21, H * 0.08);

  // 앞쪽 땅 — 언덕 · 안개 · 바위 · 땅의 룬
  hill(ctx, W, H, { base: 0.72, amp: 0.03, k: 0.005, ph: 1.4 + t * 0.04, color: '#1b1030' });
  hill(ctx, W, H, { base: 0.85, amp: 0.026, k: 0.008, ph: 3.8 + t * 0.05, color: '#120a20' });
  crest(ctx, W, H, { base: 0.72, amp: 0.03, k: 0.005, ph: 1.4 + t * 0.04, color: 'rgba(150,100,220,0.35)', w: 2 });
  crest(ctx, W, H, { base: 0.85, amp: 0.026, k: 0.008, ph: 3.8 + t * 0.05, color: 'rgba(130,80,200,0.25)', w: 2 });
  const fog = ctx.createLinearGradient(0, H * 0.62, 0, H * 0.82);
  fog.addColorStop(0, 'rgba(90,50,140,0)');
  fog.addColorStop(0.55, 'rgba(104,60,158,0.2)');
  fog.addColorStop(1, 'rgba(70,36,110,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, H * 0.62, W, H * 0.22);
  ctx.fillStyle = '#0d0718';
  for (const r of st.rocks) {
    ctx.beginPath();
    ctx.moveTo(r.x * W - r.w * W, r.y * H);
    ctx.lineTo(r.x * W - r.w * W * 0.4, r.y * H - r.h * H);
    ctx.lineTo(r.x * W + r.w * W * 0.3, r.y * H - r.h * H * 0.8);
    ctx.lineTo(r.x * W + r.w * W, r.y * H);
    ctx.closePath();
    ctx.fill();
  }
  runeRing(ctx, W * 0.24, H * 0.88, W * 0.12, t * 0.5, '#b06cff', 0.16);
  runeRing(ctx, W * 0.8, H * 0.93, W * 0.09, -t * 0.4, '#8fd8ff', 0.12);

  // 번개 (6.5초 주기, 결정적)
  const cycle = 6.5;
  const ph = t % cycle;
  if (ph < 0.5) {
    const f = ph < 0.1 ? 1 : Math.max(0, 1 - (ph - 0.1) / 0.4);
    ctx.fillStyle = `rgba(200,175,255,${0.22 * f})`;
    ctx.fillRect(0, 0, W, H);
    if (ph < 0.26) {
      const r = seeded(Math.floor(t / cycle) + 3);
      let x = W * (0.15 + r() * 0.7), y = 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(238,229,255,${0.9 * f})`;
      ctx.lineWidth = 2.4;
      ctx.shadowColor = 'rgba(190,150,255,0.9)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < H * 0.3) {
        x += (r() - 0.5) * W * 0.1;
        y += H * (0.03 + r() * 0.05);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // 보랏빛 불티
  ctx.globalCompositeOperation = 'lighter';
  for (const e of st.embers) {
    const y = ((e.y - t * e.v) % 1.15 + 1.15) % 1.15;
    const x = (e.x + Math.sin(t * e.sp + e.ph) * e.dx) * W;
    const flick = 0.4 + 0.6 * Math.sin(t * e.p + e.ph);
    const r = e.r * (0.6 + flick * 0.7);
    ctx.globalAlpha = (1 - y) * flick * 0.9;
    ctx.drawImage(sprite('violet'), x - r, y * H - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function sceneBlitz(ctx, W, H, t, st) {
  const cx = W * 0.5, cy = H * 0.46;
  const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.85);
  bg.addColorStop(0, '#341f74');
  bg.addColorStop(0.35, '#180f3c');
  bg.addColorStop(1, '#06040f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 중심 오라
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const ar = Math.max(W, H) * (0.36 + pulse * 0.03);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(sprite('gold'), cx - ar, cy - ar, ar * 2, ar * 2);
  ctx.globalAlpha = 0.3;
  ctx.drawImage(sprite('cobalt'), cx - ar * 1.5, cy - ar * 1.5, ar * 3, ar * 3);
  const ringR = Math.min(W, H) * 0.52;
  const ringG = ctx.createRadialGradient(cx, cy, ringR * 0.8, cx, cy, ringR * 1.45);
  ringG.addColorStop(0, 'rgba(255,209,102,0)');
  ringG.addColorStop(0.5, `rgba(255,214,140,${0.2 + pulse * 0.14})`);
  ringG.addColorStop(1, 'rgba(255,209,102,0)');
  ctx.fillStyle = ringG;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // 퍼져 나가는 충격 링
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.42 + i / 3) % 1);
    const r = p * Math.max(W, H) * 0.66;
    ctx.strokeStyle = `rgba(120,200,255,${(1 - p) * 0.18})`;
    ctx.lineWidth = 2 + (1 - p) * 4;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  }

  // 회전하는 방사형 광선 — 넓은 빛무리 + 밝은 심지
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const s of st.streaks) {
    const a = s.a + t * s.v;
    const len = Math.max(W, H) * s.len * (0.85 + 0.15 * Math.sin(t * s.p + s.ph));
    const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
    const col = s.hue === 'gold' ? '255,209,102' : '120,175,255';
    const grad = ctx.createLinearGradient(0, 0, ex, ey);
    grad.addColorStop(0, `rgba(${col},0)`);
    grad.addColorStop(0.3, `rgba(${col},${0.16 + s.o})`);
    grad.addColorStop(0.62, `rgba(${col},${0.26 + s.o})`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = s.w * 3.4;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.2, s.w * 0.7);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * len * 0.18, Math.sin(a) * len * 0.18);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // 광선을 타고 흐르는 빛 알갱이
    const p = ((t * (0.4 + s.w * 0.08) + s.ph / TAU) % 1);
    const px = Math.cos(a) * len * p, py = Math.sin(a) * len * p;
    const pr = 8 + s.w * 3;
    ctx.globalAlpha = (1 - Math.abs(p - 0.55) * 1.6) * 0.9;
    ctx.drawImage(sprite(s.hue === 'gold' ? 'gold' : 'aqua'), px - pr, py - pr, pr * 2, pr * 2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 반짝이는 입자
  for (const s of st.sparkles) {
    const p = ((t * s.v + s.ph) % 1);
    const a = s.a + s.swirl * Math.sin(t * 0.8 + s.ph);
    const d = p * Math.max(W, H) * 0.7;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.9;
    const r = s.r * (1 - p * 0.4);
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.drawImage(sprite(s.hue === 'gold' ? 'gold' : 'aqua'), x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

const SCENES = {
  1: sceneMeadow,
  2: sceneFrost,
  3: sceneDesert,
  4: sceneJungle,
  5: sceneShadow,
  blitz: sceneBlitz,
};

/* ── 장면별 입자 만들기 (seed 고정) ───────────────────────── */
function buildState(id) {
  const r = seeded(1000 + (typeof id === 'number' ? id : 9) * 37);
  const st = {};
  if (id === 1) {
    st.clouds = Array.from({ length: 5 }, () => ({ x: r(), y: 0.06 + r() * 0.2, s: 0.1 + r() * 0.1, v: 0.004 + r() * 0.006, a: 0.2 + r() * 0.18 }));
    st.birds = Array.from({ length: 4 }, () => ({ x: r(), y: 0.07 + r() * 0.16, s: 4 + r() * 5, v: 0.006 + r() * 0.008, ph: r() * TAU }));
    st.grass = Array.from({ length: 90 }, () => ({
      x: r(), h: 0.03 + r() * 0.07, amp: 2 + r() * 6, ph: r() * TAU, sp: 0.8 + r() * 1.2,
      w: 1 + r() * 1.6, a: 0.4 + r() * 0.4, c: ['#3fae5c', '#6ceb96', '#2b8450'][Math.floor(r() * 3)],
    }));
    st.flies = Array.from({ length: 30 }, () => ({
      x: r(), y: 0.08 + r() * 0.75, r: 2.2 + r() * 3.2, dx: 0.01 + r() * 0.03, dy: 0.01 + r() * 0.04,
      sx: 0.2 + r() * 0.5, sy: 0.15 + r() * 0.4, p: 1 + r() * 2.2, ph: r() * TAU,
    }));
  } else if (id === 2) {
    st.stars = Array.from({ length: 70 }, () => ({ x: r(), y: r() * 0.5, r: 0.5 + r() * 1.2, p: 0.6 + r() * 2, ph: r() * TAU, a: 0.3 + r() * 0.7 }));
    st.snow = Array.from({ length: 70 }, () => ({ x: r(), y: r() * 1.1, v: 0.02 + r() * 0.06, r: 0.8 + r() * 1.9, a: 0.35 + r() * 0.55, sp: 0.4 + r() * 1.1, ph: r() * TAU, dx: 0.01 + r() * 0.03 }));
    st.sparkle = Array.from({ length: 16 }, () => ({ x: r(), y: r() * 0.85, r: 2 + r() * 3, p: 1.2 + r() * 2, ph: r() * TAU }));
  } else if (id === 3) {
    st.birds = Array.from({ length: 4 }, () => ({ x: r(), y: 0.1 + r() * 0.14, s: 5 + r() * 5, v: 0.004 + r() * 0.006, ph: r() * TAU }));
    st.haze = Array.from({ length: 5 }, () => ({ x: r(), y: 0.3 + r() * 0.16, w: 0.18 + r() * 0.2, h: 0.006 + r() * 0.012, v: 0.003 + r() * 0.005 }));
    st.embers = Array.from({ length: 40 }, () => ({ x: r(), y: 0.25 + r() * 0.7, v: 0.02 + r() * 0.05, r: 1.6 + r() * 2.8, sp: 0.4 + r() * 0.9, ph: r() * TAU, dx: 0.01 + r() * 0.03, p: 1.5 + r() * 2.5 }));
    st.dust = Array.from({ length: 44 }, () => ({ x: r(), y: 0.4 + r() * 0.55, v: 0.004 + r() * 0.01, r: 0.6 + r() * 1.2, a: 0.2 + r() * 0.4, sp: 0.3 + r() * 0.8, ph: r() * TAU, p: 1 + r() * 2 }));
  } else if (id === 4) {
    st.halos = Array.from({ length: 5 }, () => ({ x: 0.12 + r() * 0.76, y: 0.1 + r() * 0.35, r: 0.14 + r() * 0.16, tint: r() > 0.5 ? 'mint' : 'violet', p: 0.4 + r() * 0.8, ph: r() * TAU }));
    st.beams = Array.from({ length: 4 }, () => ({ x: 0.15 + r() * 0.7, w: 0.05 + r() * 0.07, p: 0.3 + r() * 0.6, ph: r() * TAU }));
    st.canopy = Array.from({ length: 9 }, () => ({ x: r(), y: -0.02 + r() * 0.1, w: 0.1 + r() * 0.16, h: 0.04 + r() * 0.07 }));
    st.vines = Array.from({ length: 7 }, () => ({ x: r(), len: 0.1 + r() * 0.2, p: 0.3 + r() * 0.6, ph: r() * TAU }));
    st.crystals = Array.from({ length: 5 }, () => ({
      x: 0.08 + r() * 0.84, y: 0.5 + r() * 0.06, s: 0.016 + r() * 0.018,
      tint: r() > 0.4 ? 'mint' : 'violet', rgb: r() > 0.4 ? '110,240,180' : '170,140,255',
      p: 0.5 + r() * 0.9, ph: r() * TAU,
    }));
    st.ferns = Array.from({ length: 12 }, () => ({ x: r(), h: 0.05 + r() * 0.05, ph: r() * TAU, sw: 4 + r() * 8 }));
    st.mist = Array.from({ length: 4 }, () => ({ x: r(), y: 0.66 + r() * 0.18, w: 0.22 + r() * 0.2, h: 0.03 + r() * 0.04, v: 0.004 + r() * 0.008 }));
    st.shards = Array.from({ length: 5 }, () => ({
      x: 0.12 + r() * 0.76, y: 0.07 + r() * 0.15, s: 0.016 + r() * 0.014,
      tint: r() > 0.5 ? 'mint' : 'violet', rgb: r() > 0.5 ? '120,245,190' : '180,150,255',
      p: 0.5 + r() * 0.8, ph: r() * TAU,
    }));
    st.spores = Array.from({ length: 52 }, () => ({ x: r(), y: r() * 1.1, v: 0.008 + r() * 0.025, r: 1.4 + r() * 2.4, sp: 0.3 + r() * 0.8, ph: r() * TAU, dx: 0.015 + r() * 0.04, p: 1 + r() * 2, a: 0.4 + r() * 0.5, tint: r() > 0.5 ? 'mint' : 'violet' }));
  } else if (id === 5) {
    st.clouds = Array.from({ length: 6 }, () => ({ x: r(), y: 0.02 + r() * 0.22, s: 0.12 + r() * 0.14, v: 0.006 + r() * 0.012, a: 0.34 + r() * 0.24 }));
    st.rocks = Array.from({ length: 7 }, () => ({ x: 0.06 + r() * 0.88, y: 0.9 + r() * 0.08, w: 0.02 + r() * 0.05, h: 0.02 + r() * 0.05 }));
    st.embers = Array.from({ length: 30 }, () => ({ x: r(), y: 0.1 + r() * 0.9, v: 0.012 + r() * 0.035, r: 1.4 + r() * 2.4, sp: 0.3 + r() * 0.7, ph: r() * TAU, dx: 0.008 + r() * 0.025, p: 1.2 + r() * 2.4 }));
  } else {
    st.streaks = Array.from({ length: 30 }, (_, i) => ({
      a: (i / 30) * TAU + r() * 0.2, v: (r() > 0.5 ? 1 : -1) * (0.12 + r() * 0.3),
      len: 0.3 + r() * 0.45, w: 1 + r() * 2.6, hue: r() > 0.32 ? 'gold' : 'cobalt',
      o: r() * 0.1, p: 0.5 + r() * 1.5, ph: r() * TAU,
    }));
    st.sparkles = Array.from({ length: 50 }, () => ({
      a: r() * TAU, v: 0.06 + r() * 0.22, r: 1.6 + r() * 2.8, swirl: 0.1 + r() * 0.4,
      hue: r() > 0.5 ? 'gold' : 'aqua', ph: r() * TAU,
    }));
  }
  return st;
}

/* ── Backdrop ─────────────────────────────────────────────── */
export class Backdrop {
  constructor(canvas) {
    this.canvas = canvas || null;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.w = 0; this.h = 0; this.dpr = 1;
    this.sceneId = 1;
    this.mode = 'game';
    this.dim = 0;
    this.t = 0;
    this.lastDraw = 0;
    this.raf = 0;
    this.st = buildState(1);
    this.frames = 0;
    this.fps = 0;
    this._fpsT = 0;

    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.mq = mq;
    this.reduced = !!(mq && mq.matches);
    const onChange = () => { this.reduced = !!(mq && mq.matches); this.start(true); };
    if (mq?.addEventListener) mq.addEventListener('change', onChange);
    this._onChange = onChange;
  }

  /* 화면 크기에 맞추기 — #app(모바일 프레임) 크기를 그대로 따른다 */
  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.w === w && this.h === h && this.canvas.width === Math.round(w * this.dpr)) return;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this._scrim = null;
    if (this.raf && !this.reduced) this.draw(0);
  }

  /* 장면 전환: 월드 번호(1~5) 또는 'blitz' */
  setScene(id, mode = 'game') {
    const next = id === 'blitz' ? 'blitz' : (Number(id) || 1);
    const dim = mode === 'home' ? 0.5 : 0;
    if (next === this.sceneId && this.st && mode === this.mode) { this.dim = dim; return; }
    this.sceneId = next;
    this.mode = mode;
    this.dim = dim;
    this.st = buildState(next);
    this._scrim = null;
    this.t = 0;
    if (this.raf) this.draw(0);
  }

  start(force = false) {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    if (this.reduced && !force) { this.draw(0); return; }  // 정지 화면 한 장
    if (this.raf) return;
    this.lastDraw = 0;
    this._loop = this._loop || this.loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    this.mq?.removeEventListener?.('change', this._onChange);
    this.canvas = null;
    this.ctx = null;
  }

  loop(now) {
    this.raf = requestAnimationFrame(this._loop);
    // 30fps — 퍼즐 렌더(60fps)와 예산을 나눈다
    if (this.lastDraw && now - this.lastDraw < 31) return;
    const dt = this.lastDraw ? Math.min(0.12, (now - this.lastDraw) / 1000) : 0.016;
    this.lastDraw = now;
    this.t += dt;
    this.draw(dt);
    this.frames++;
    if (now - this._fpsT > 1000) { this.fps = this.frames; this.frames = 0; this._fpsT = now; }
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx || !this.w) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const fn = SCENES[this.sceneId] || SCENES[1];
    try {
      fn.call(this, ctx, this.w, this.h, this.t, this.st);
    } catch (err) {
      console.warn('[hexa-kingdom] 배경 렌더 오류', err);
      this.stop();
    }
    this.scrim(ctx, this.w, this.h);
  }

  /* 위(점수·목표)·아래(부스터) 가독성 + 가장자리 비네트 */
  scrim(ctx, W, H) {
    if (!this._scrim) {
      const top = ctx.createLinearGradient(0, 0, 0, H * 0.22);
      top.addColorStop(0, 'rgba(5,12,9,0.5)');
      top.addColorStop(0.55, 'rgba(5,12,9,0.18)');
      top.addColorStop(1, 'rgba(5,12,9,0)');
      const bottom = ctx.createLinearGradient(0, H * 0.64, 0, H);
      bottom.addColorStop(0, 'rgba(5,12,9,0)');
      bottom.addColorStop(0.55, 'rgba(5,12,9,0.36)');
      bottom.addColorStop(1, 'rgba(5,12,9,0.74)');
      const vig = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.72, W / 2, H * 0.46, Math.max(W, H) * 0.98);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.3)');
      this._scrim = { top, bottom, vig };
    }
    const s = this._scrim;
    ctx.fillStyle = s.top; ctx.fillRect(0, 0, W, H * 0.22);
    ctx.fillStyle = s.bottom; ctx.fillRect(0, H * 0.64, W, H * 0.36);
    ctx.fillStyle = s.vig; ctx.fillRect(0, 0, W, H);
    if (this.dim > 0) {
      ctx.fillStyle = `rgba(5,12,9,${this.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

export default Backdrop;
