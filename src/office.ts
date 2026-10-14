import type { Hat, Look } from "./bots";

function hatArt(hat: Hat, color: string): string {
  if (hat === "crown") {
    return `<path d="M44 30l5-12 7 8 4-12 4 12 7-8 5 12z" fill="${color}"/>`;
  }
  if (hat === "hardhat") {
    return `<path d="M42 32c0-14 8-20 18-20s18 6 18 20" fill="${color}"/><rect x="38" y="30" width="44" height="6" rx="3" fill="${color}"/>`;
  }
  if (hat === "chef") {
    return `<ellipse cx="60" cy="16" rx="16" ry="9" fill="#f7f7fb"/><rect x="50" y="14" width="20" height="16" rx="7" fill="#f7f7fb"/><rect x="46" y="28" width="28" height="6" rx="2" fill="#f7f7fb"/>`;
  }
  if (hat === "cap") {
    return `<path d="M46 32c0-12 6-18 14-18s14 6 14 18" fill="${color}"/><ellipse cx="70" cy="32" rx="18" ry="5" fill="${color}"/>`;
  }
  if (hat === "phones") {
    return `<path d="M48 30h24" fill="none" stroke="#20242e" stroke-width="3" stroke-linecap="round"/><rect x="40" y="28" width="8" height="12" rx="3" fill="#20242e"/><rect x="72" y="28" width="8" height="12" rx="3" fill="#20242e"/><circle cx="44" cy="34" r="2" fill="${color}"/><circle cx="76" cy="34" r="2" fill="${color}"/>`;
  }
  return "";
}

function arms(pose: "type" | "lean", shirt: string, skin: string): string {
  if (pose === "lean") {
    return `<g class="arm arm-l"><path d="M46 62c-14 8-12 22-2 26" fill="none" stroke="${shirt}" stroke-width="7" stroke-linecap="round"/><circle cx="42" cy="90" r="4.5" fill="${skin}"/></g>
      <g class="arm arm-r"><path d="M74 60c14 4 18 14 12 22" fill="none" stroke="${shirt}" stroke-width="7" stroke-linecap="round"/><circle cx="88" cy="84" r="4.5" fill="${skin}"/></g>
      <g class="coffee"><rect x="92" y="76" width="12" height="14" rx="3" fill="#f7f4ee"/><path d="M104 80h4a4 4 0 0 1 0 8h-4" fill="none" stroke="#f7f4ee" stroke-width="2"/><path class="steam" d="M96 72c1.5-4 4-4 2.5-8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></g>`;
  }
  return `<g class="arm arm-l"><path d="M48 62c-10 18-8 40-2 50" fill="none" stroke="${shirt}" stroke-width="7" stroke-linecap="round"/><circle cx="46" cy="114" r="5" fill="${skin}"/></g>
    <g class="arm arm-r"><path d="M72 62c10 18 8 40 2 50" fill="none" stroke="${shirt}" stroke-width="7" stroke-linecap="round"/><circle cx="74" cy="114" r="5" fill="${skin}"/></g>`;
}

export function characterSvg(look: Look, pose: "type" | "lean"): string {
  const lean = pose === "lean" ? ` transform="rotate(-8 60 72)"` : "";
  return `<svg class="toon" viewBox="0 0 120 132" aria-hidden="true" focusable="false">
    <ellipse cx="60" cy="126" rx="40" ry="6" fill="#000" opacity="0.12"/>
    <path d="M44 96c-2 14 2 18 16 18s18-4 16-18" fill="#5c6b84"/>
    <rect x="50" y="78" width="8" height="20" rx="3" fill="#2a3142"/>
    <rect x="62" y="78" width="8" height="20" rx="3" fill="#2a3142"/>
    <g class="person"${lean}>
      <rect x="46" y="54" width="28" height="28" rx="11" fill="${look.shirt}"/>
      <rect x="55" y="50" width="10" height="8" rx="3" fill="${look.skin}"/>
      <circle cx="60" cy="36" r="15" fill="${look.skin}"/>
      <path d="M45 36c0-16 6-24 15-24s15 8 15 24c-2-7-7-10-15-10s-13 3-15 10z" fill="${look.hair}"/>
      ${hatArt(look.hat, look.hatColor)}
      <ellipse cx="51" cy="42" rx="2.6" ry="1.5" fill="#e0897a" opacity="0.75"/>
      <ellipse cx="69" cy="42" rx="2.6" ry="1.5" fill="#e0897a" opacity="0.75"/>
      <circle cx="54" cy="36" r="2.2" fill="#1b2436"/>
      <circle cx="66" cy="36" r="2.2" fill="#1b2436"/>
      <circle cx="54.8" cy="35.3" r="0.8" fill="#fff"/>
      <circle cx="66.8" cy="35.3" r="0.8" fill="#fff"/>
      <path d="M54 43c2.2 3 9.8 3 12 0" fill="none" stroke="#a15a4a" stroke-width="1.5" stroke-linecap="round"/>
    </g>
    <path d="M14 102h92l8 16H6z" fill="#e2a45c"/>
    <path d="M6 118h108l-3 8H9z" fill="#b87a3c"/>
    <rect x="78" y="88" width="26" height="16" rx="3" fill="#243044"/>
    <rect x="80" y="90" width="22" height="10" rx="2" fill="#9fd4ff"/>
    <rect x="88" y="104" width="6" height="5" fill="#243044"/>
    <rect class="keys" x="34" y="112" width="36" height="6" rx="2" fill="#3d4d66"/>
    <g class="limbs"${lean}>
      ${arms(pose, look.shirt, look.skin)}
    </g>
  </svg>`;
}

function windowPane(x: number): string {
  return `<g>
    <rect x="${x}" y="36" width="210" height="150" rx="16" fill="#e7d3b0"/>
    <rect x="${x + 12}" y="48" width="186" height="126" rx="10" fill="url(#sky)"/>
    <rect x="${x + 100}" y="48" width="8" height="126" fill="#e7d3b0"/>
    <rect x="${x + 12}" y="104" width="186" height="8" fill="#e7d3b0"/>
    <circle cx="${x + 48}" cy="78" r="12" fill="#ffe08a"/>
    <circle cx="${x + 150}" cy="70" r="2" fill="#fff"/>
    <circle cx="${x + 164}" cy="92" r="1.6" fill="#fff"/>
    <circle cx="${x + 138}" cy="118" r="1.4" fill="#fff"/>
  </g>`;
}

function plant(x: number, y: number, scale: number): string {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="36" rx="22" ry="7" fill="#000" opacity="0.12"/>
    <path d="M-10 8h20l4 28h-28z" fill="#d08a45"/>
    <circle cx="0" cy="-4" r="18" fill="#3f8f55"/>
    <circle cx="-16" cy="6" r="12" fill="#2f6e40"/>
    <circle cx="16" cy="4" r="13" fill="#67c07a"/>
  </g>`;
}

export function roomSvg(): string {
  return `<svg class="room" viewBox="0 0 1200 860" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6aa6e8"/>
        <stop offset="1" stop-color="#f6d98a"/>
      </linearGradient>
      <linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f7f1e6"/>
        <stop offset="1" stop-color="#e7d9c4"/>
      </linearGradient>
      <linearGradient id="floorg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e4bf86"/>
        <stop offset="1" stop-color="#c99658"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="860" fill="url(#floorg)"/>
    <polygon points="70,230 1130,230 1200,860 0,860" fill="#d7ad72"/>
    <g opacity="0.18" stroke="#8d6436" stroke-width="3">
      <line x1="180" y1="230" x2="60" y2="860"/>
      <line x1="400" y1="230" x2="340" y2="860"/>
      <line x1="620" y1="230" x2="620" y2="860"/>
      <line x1="840" y1="230" x2="900" y2="860"/>
      <line x1="1040" y1="230" x2="1140" y2="860"/>
    </g>
    <rect width="1200" height="250" fill="url(#wallg)"/>
    <rect y="232" width="1200" height="18" fill="#d8c3a2"/>
    <rect x="36" y="48" width="130" height="100" rx="8" fill="#f7f4ee" stroke="#cbbba6" stroke-width="6"/>
    <path d="M54 74h92" fill="none" stroke="#5aa0e6" stroke-width="4" stroke-linecap="round"/>
    <path d="M54 96h64" fill="none" stroke="#e07a5f" stroke-width="4" stroke-linecap="round"/>
    <path d="M54 118h84" fill="none" stroke="#3f8f55" stroke-width="4" stroke-linecap="round"/>
    ${windowPane(190)}
    ${windowPane(495)}
    ${windowPane(800)}
    <circle cx="1110" cy="92" r="30" fill="#f7f4ee" stroke="#cbbba6" stroke-width="6"/>
    <path d="M1110 92V74M1110 92l16 8" fill="none" stroke="#243044" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="600" cy="520" rx="340" ry="120" fill="#3e6f8c" opacity="0.28"/>
    ${plant(64, 300, 1)}
    ${plant(1136, 320, 0.95)}
    ${plant(58, 700, 0.8)}
    ${plant(1148, 710, 0.75)}
    <rect x="1048" y="150" width="70" height="64" rx="4" fill="#8d5a32"/>
    <rect x="1054" y="156" width="58" height="8" fill="#d24b4b"/>
    <rect x="1054" y="168" width="58" height="8" fill="#3d7ec4"/>
    <rect x="1054" y="180" width="58" height="8" fill="#3f8f55"/>
    <rect x="1054" y="192" width="58" height="8" fill="#e0b04a"/>
  </svg>`;
}
