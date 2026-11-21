/* =========================================================================
   오리지널 아트 — 견습 기사 루크, 요정 피피, 월드 풍경, 보스, 복구 건물
   모두 이 파일에서 직접 그린 SVG 입니다(외부 이미지 없음).
   ========================================================================= */
import { CFG } from '../config.js';

/* 견습 기사 루크 — 작은 투구, 초록 망토, 나무 검 */
export function lukeSvg(size = 140, opts = {}) {
  const cheer = opts.cheer;
  return `<svg class="art luke" viewBox="0 0 120 140" width="${size}" height="${size * 140 / 120}" role="img" aria-label="견습 기사 루크">
  <defs>
    <linearGradient id="lkCape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc84"/><stop offset="1" stop-color="#127a4a"/></linearGradient>
    <linearGradient id="lkHelm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef4ff"/><stop offset="0.6" stop-color="#b9c6dd"/><stop offset="1" stop-color="#7f8ea8"/></linearGradient>
    <linearGradient id="lkSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3c4"/><stop offset="1" stop-color="#f5c29a"/></linearGradient>
  </defs>
  <ellipse cx="60" cy="131" rx="30" ry="6" fill="rgba(0,0,0,0.25)"/>
  <path d="M38 70c-8 18-10 34-8 54h60c2-20 0-36-8-54z" fill="url(#lkCape)"/>
  <path d="M44 76h32l4 44H40z" fill="#2f6f52"/>
  <path d="M44 74l8-8h16l8 8-6 10H50z" fill="#7bd44f"/>
  <rect x="52" y="74" width="16" height="16" rx="5" fill="#ffd166" opacity="0.8"/>
  <rect x="38" y="80" width="10" height="30" rx="5" fill="#2f6f52"/>
  <rect x="72" y="80" width="10" height="30" rx="5" fill="#2f6f52"/>
  <circle cx="43" cy="112" r="6" fill="url(#lkSkin)"/>
  <circle cx="77" cy="112" r="6" fill="url(#lkSkin)"/>
  <rect x="42" y="118" width="14" height="12" rx="5" fill="#6b4a2a"/>
  <rect x="64" y="118" width="14" height="12" rx="5" fill="#6b4a2a"/>
  <rect x="44" y="127" width="12" height="4" rx="2" fill="#3c2a17"/>
  <rect x="64" y="127" width="12" height="4" rx="2" fill="#3c2a17"/>
  <!-- 머리 -->
  <ellipse cx="60" cy="52" rx="20" ry="21" fill="url(#lkSkin)"/>
  <path d="M40 46c0-12 9-20 20-20s20 8 20 20c0 2-1 4-2 6H42c-1-2-2-4-2-6z" fill="url(#lkHelm)"/>
  <path d="M40 46h40" stroke="#6f7f96" stroke-width="2.4"/>
  <rect x="57" y="24" width="6" height="14" rx="2" fill="#9aa8bd"/>
  <path d="M60 18c6-6 14-6 18 0-8-1-14 2-18 6z" fill="#ff5b7f"/>
  <circle cx="52" cy="53" r="2.6" fill="#2a2a35"/>
  <circle cx="68" cy="53" r="2.6" fill="#2a2a35"/>
  <circle cx="52.8" cy="52.2" r="0.9" fill="#fff"/>
  <circle cx="68.8" cy="52.2" r="0.9" fill="#fff"/>
  <path d="${cheer ? 'M54 61c3 3 9 3 12 0' : 'M54 62c3-2 9-2 12 0'}" stroke="#b06a44" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <circle cx="46" cy="58" r="3" fill="#ffb3c1" opacity="0.7"/>
  <circle cx="74" cy="58" r="3" fill="#ffb3c1" opacity="0.7"/>
  <!-- 검 -->
  <g transform="rotate(18 84 96)">
    <rect x="82" y="60" width="4" height="40" rx="2" fill="#dfe7f5"/>
    <rect x="78" y="96" width="12" height="4" rx="2" fill="#c98a00"/>
    <rect x="83" y="100" width="2.5" height="10" rx="1.2" fill="#8a5a2b"/>
  </g>
</svg>`;
}

/* 요정 피피 — 반짝이는 날개와 빛무리 */
export function pipiSvg(size = 100) {
  return `<svg class="art pipi" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="요정 피피">
  <defs>
    <radialGradient id="ppGlow"><stop offset="0" stop-color="#fffbe6" stop-opacity="0.95"/><stop offset="0.5" stop-color="#ffe066" stop-opacity="0.55"/><stop offset="1" stop-color="#ffe066" stop-opacity="0"/></radialGradient>
    <linearGradient id="ppWing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6f6ff" stop-opacity="0.95"/><stop offset="1" stop-color="#7fd8ff" stop-opacity="0.45"/></linearGradient>
    <radialGradient id="ppBody"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#fff3b0"/><stop offset="1" stop-color="#ffd166"/></radialGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#ppGlow)"/>
  <path d="M46 48C30 26 14 30 20 46c4 11 16 14 26 8z" fill="url(#ppWing)" stroke="#bfefff" stroke-width="1.2"/>
  <path d="M54 48c16-22 32-18 26-2-4 11-16 14-26 8z" fill="url(#ppWing)" stroke="#bfefff" stroke-width="1.2"/>
  <path d="M46 56C32 66 24 62 28 54c3-6 12-6 18-2z" fill="url(#ppWing)" opacity="0.8"/>
  <path d="M54 56c14 10 22 6 18-2-3-6-12-6-18-2z" fill="url(#ppWing)" opacity="0.8"/>
  <circle cx="50" cy="52" r="15" fill="url(#ppBody)" stroke="#ffe9a3" stroke-width="1"/>
  <circle cx="45" cy="50" r="2" fill="#4a3b1a"/>
  <circle cx="55" cy="50" r="2" fill="#4a3b1a"/>
  <path d="M46 57c2 2 6 2 8 0" stroke="#c98a00" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <circle cx="36" cy="44" r="2.6" fill="#ffb3c1" opacity="0.8"/>
  <circle cx="64" cy="44" r="2.6" fill="#ffb3c1" opacity="0.8"/>
  <path d="M50 30l2 5 5 1-4 4 1 5-4-2.6-4 2.6 1-5-4-4 5-1z" fill="#fff" opacity="0.9"/>
  <circle cx="26" cy="30" r="1.6" fill="#fff"/>
  <circle cx="76" cy="26" r="1.8" fill="#fff"/>
  <circle cx="80" cy="68" r="1.4" fill="#fff"/>
</svg>`;
}

/* 월드 풍경 카드 배경 */
export function worldSceneSvg(worldId, w = 360, h = 150) {
  const scenes = {
    1: `<path d="M0 110q60-46 120-16t120-10 120 22v44H0z" fill="#2f8f47"/><path d="M0 126q70-30 140-6t110-2 110 10v22H0z" fill="#3ddc84" opacity=".55"/><g fill="#ffe9a8"><circle cx="300" cy="34" r="16"/></g><g stroke="#7a4a26" stroke-width="4"><path d="M60 108V84"/><path d="M300 106V86"/></g><g fill="#7bd44f"><circle cx="60" cy="78" r="14"/><circle cx="300" cy="80" r="12"/></g>`,
    2: `<path d="M0 118l80-54 60 34 70-46 90 48 60-24v42H0z" fill="#dff2ff"/><path d="M0 132q80-22 180-4t180 6v16H0z" fill="#b8e6ff"/><circle cx="300" cy="34" r="15" fill="#ffffff" opacity=".85"/><g fill="#ffffff" opacity=".9"><circle cx="70" cy="40" r="2"/><circle cx="120" cy="26" r="2.4"/><circle cx="190" cy="46" r="2"/><circle cx="250" cy="22" r="2.2"/></g>`,
    3: `<path d="M0 112q60-34 120-10t80-8 100 18 60 6v38H0z" fill="#e0a75a"/><path d="M0 128q80-22 140-6t120 0 100 8v26H0z" fill="#f2cd8b"/><circle cx="292" cy="38" r="20" fill="#ffd166"/><path d="M0 96q40-20 90-6t70 6" stroke="#c98a3a" stroke-width="4" fill="none"/>`,
    4: `<path d="M0 116q50-40 110-14t90-10 100 20 60 12v34H0z" fill="#1f6b3b"/><g fill="#2f8f47"><circle cx="50" cy="94" r="24"/><circle cx="120" cy="86" r="20"/><circle cx="300" cy="92" r="26"/></g><g fill="#7bd44f" opacity=".7"><circle cx="40" cy="86" r="12"/><circle cx="310" cy="82" r="14"/></g><path d="M190 96l10-46 10 46z" fill="#a98cff" opacity=".8"/>`,
    5: `<path d="M0 118h360v38H0z" fill="#211a33"/><g fill="#332a4d"><rect x="120" y="46" width="120" height="76" rx="4"/><path d="M110 46h140l-20-26h-100z"/><rect x="160" y="82" width="24" height="40" rx="10" fill="#1a1428"/></g><g fill="#8b6cff" opacity=".8"><rect x="132" y="58" width="12" height="20" rx="6"/><rect x="216" y="58" width="12" height="20" rx="6"/></g><circle cx="60" cy="42" r="18" fill="#b06cff" opacity=".35"/><circle cx="300" cy="34" r="14" fill="#8b6cff" opacity=".4"/>`,
  };
  return `<svg viewBox="0 0 360 150" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="wsky${worldId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${worldSky(worldId)[0]}"/><stop offset="1" stop-color="${worldSky(worldId)[1]}"/>
    </linearGradient></defs>
    <rect width="360" height="150" fill="url(#wsky${worldId})"/>
    ${scenes[worldId] || scenes[1]}
  </svg>`;
}

function worldSky(id) {
  return { 1: ['#bdf0c9', '#4fb173'], 2: ['#dff4ff', '#7fb6d9'], 3: ['#ffe2a8', '#e08b3c'], 4: ['#c8f5cf', '#2f8f47'], 5: ['#4a3b73', '#1a1428'] }[id] || ['#bdf0c9', '#4fb173'];
}

/* 보스 초상 */
export function bossSvg(kind, size = 110) {
  const body = {
    slime: `<path d="M20 96c-6-30 12-58 40-58s46 28 40 58z" fill="#7bdc7b"/><circle cx="42" cy="66" r="6" fill="#1f4d1f"/><circle cx="78" cy="66" r="6" fill="#1f4d1f"/><path d="M48 82c8 6 16 6 24 0" stroke="#1f4d1f" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    golem: `<path d="M24 96V58l14-22h44l14 22v38z" fill="#cfe8ff"/><circle cx="44" cy="60" r="6" fill="#2b5e86"/><circle cx="76" cy="60" r="6" fill="#2b5e86"/><path d="M48 78h24" stroke="#2b5e86" stroke-width="4"/><path d="M28 30l10-10 8 10z" fill="#9fe8ff"/>`,
    sphinx: `<path d="M22 96c4-26 14-40 28-40h20c14 0 24 14 28 40z" fill="#e3b56a"/><circle cx="50" cy="48" r="16" fill="#f2cd8b"/><circle cx="44" cy="46" r="3" fill="#66401a"/><circle cx="56" cy="46" r="3" fill="#66401a"/><path d="M40 56h20" stroke="#66401a" stroke-width="3"/><path d="M34 34l-12-10 14-2zM66 34l12-10-14-2z" fill="#e3b56a"/>`,
    vine: `<path d="M50 20c-18 14-18 34 0 48 18 14 18 34 0 48" stroke="#3f9e57" stroke-width="9" fill="none"/><path d="M50 20c18 14 18 34 0 48-18 14-18 34 0 48" stroke="#2f7d43" stroke-width="7" fill="none"/><circle cx="50" cy="44" r="7" fill="#ffb3c1"/><circle cx="50" cy="8" r="14" fill="#7bd44f"/><circle cx="36" cy="12" r="7" fill="#7bd44f"/><circle cx="64" cy="12" r="7" fill="#7bd44f"/>`,
    shadow: `<path d="M50 12l30 14v26c0 22-14 34-30 42-16-8-30-20-30-42V26z" fill="#4a3b73"/><circle cx="40" cy="50" r="5" fill="#ff5b7f"/><circle cx="60" cy="50" r="5" fill="#ff5b7f"/><path d="M40 66c6 4 14 4 20 0" stroke="#ff5b7f" stroke-width="3" fill="none"/><path d="M50 12l4-10 6 10z" fill="#b06cff"/>`,
  }[kind] || '';
  return `<svg viewBox="0 0 100 110" width="${size}" height="${size * 1.1}" aria-hidden="true">${body}</svg>`;
}

/* 복구 건물 아이콘 (과제 카드) */
export function buildSvg(type, size = 44) {
  const shapes = {
    mill: `<path d="M16 40V24h16v16z" fill="#c58a52"/><path d="M24 24L10 8M24 24l14-16M24 24L6 30M24 24l18 6" stroke="#e8d7a8" stroke-width="3"/>`,
    tower: `<path d="M18 42V16h12v26z" fill="#b9c6dd"/><path d="M16 16h16l-2-8H18z" fill="#7f8ea8"/><rect x="22" y="24" width="4" height="6" fill="#4a5568"/>`,
    bridge: `<path d="M6 34c8-12 28-12 36 0" stroke="#b07a45" stroke-width="4" fill="none"/><path d="M10 34v8M38 34v8M24 26v16" stroke="#8a5a2b" stroke-width="3"/>`,
    well: `<ellipse cx="24" cy="38" rx="12" ry="4" fill="#8b8fa3"/><path d="M14 36V22h20v14" fill="#a9b0c2"/><path d="M14 22l10-8 10 8" stroke="#7a4a26" stroke-width="3" fill="none"/>`,
    lamp: `<rect x="22" y="20" width="4" height="24" fill="#6c7a92"/><circle cx="24" cy="16" r="7" fill="#ffe066"/><path d="M16 44h16" stroke="#6c7a92" stroke-width="3"/>`,
    house: `<path d="M10 40V24l14-10 14 10v16z" fill="#e0c39a"/><path d="M8 24L24 10l16 14" stroke="#b0503a" stroke-width="4" fill="none"/><rect x="20" y="30" width="8" height="10" fill="#7a4a26"/>`,
  };
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${shapes[type] || shapes.house}</svg>`;
}

export function sceneBadge(worldId) {
  const w = CFG.worlds[(worldId - 1) % 5];
  return `<span class="badge-world" style="--h:${w.hue}">${w.name}</span>`;
}
