import type { Hat, Look } from "./bots";

const CELL = 3;

const TYPE_A = grid([
  "................",
  "................",
  ".....hhhhhh.....",
  "...hhsssssshh...",
  "...hhsseeeessh..",
  "...hhssssssshh..",
  "....ssssssss....",
  "...bbbbbbbbbb...",
  "..bbbbbbbbbbbb..",
  "..dddddddddddd..",
  ".dmmmmmmmmmmmmmd",
  ".dmgggggggggggmd",
  ".dmmmmmmmmmmmmmd",
  ".dkkkkkkkkkkkkkd",
  ".dss........sssd",
  "..dddddddddddd..",
  "..DDDDDDDDDDDD..",
  "................",
]);

const TYPE_B = grid(TYPE_A.map((row, index) => {
  if (index === 13) return ".dsskkkkkkkksssd";
  if (index === 14) return "..dddddddddddd..";
  return row;
}));

const LEAN = grid([
  "................",
  "................",
  "...hhhhhh.......",
  "..hhsssssshh....",
  "..hhsseeeessh...",
  "..hhssssssshh...",
  "...ssssssss.....",
  "..bbbbbbbbbb....",
  ".bbbbbbbbbbbb.rr",
  "bbbb.......rrrr.",
  "..dddddddddddd..",
  ".dmmmmmmmmmmmmmd",
  ".dmnnnnnnnnnnnmd",
  ".dmmmmmmmmmmmmmd",
  "..dddddddddddd..",
  "..dddddddddddd..",
  "..DDDDDDDDDDDD..",
  "................",
]);

function grid(rows: string[]): string[] {
  for (const row of rows) {
    if (row.length !== 16) throw new Error(`Sprite row must be 16 wide, got ${row.length}`);
  }
  return rows;
}

function applyHat(rows: string[], hat: Hat): string[] {
  const next = rows.slice();
  if (hat === "hardhat") {
    next[0] = ".....yyyyyy.....";
    next[1] = "....yyyyyyyy....";
  } else if (hat === "chef") {
    next[0] = "......wwww......";
    next[1] = ".....wwwwww.....";
    next[2] = "....wwwwwwww....";
  } else if (hat === "crown") {
    next[0] = "....G.G..G.G....";
    next[1] = ".....GGGGGG.....";
  } else if (hat === "cap") {
    next[0] = ".....cccccc.....";
    next[1] = "....cccccccc....";
  } else if (hat === "phones") {
    return grid(next.map((row, index) => {
      if (index < 3 || index > 6) return row;
      const chars = row.split("");
      chars[0] = "p";
      chars[1] = "p";
      chars[14] = "p";
      chars[15] = "p";
      return chars.join("");
    }));
  }
  return grid(next);
}

function palette(look: Look): Record<string, string> {
  return {
    h: look.hair,
    s: look.skin,
    e: "#17191f",
    b: look.shirt,
    d: "#e0a45c",
    D: "#a86a32",
    m: "#121820",
    g: "#b6ff73",
    n: "#1d2c26",
    k: "#2c354c",
    y: look.hatColor,
    c: look.hatColor,
    w: "#f7f7fb",
    G: look.hatColor,
    r: "#3c4f78",
    p: "#111318",
  };
}

function paint(rows: string[], colors: Record<string, string>, frame: "a" | "b"): string {
  const rects: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = colors[row[x] ?? ""];
      if (!color) continue;
      rects.push(`<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${color}"/>`);
    }
  });
  return `<g class="frame frame-${frame}">${rects.join("")}</g>`;
}

export function deskSprite(look: Look, pose: "type" | "lean"): string {
  const colors = palette(look);
  const base = pose === "lean" ? LEAN : TYPE_A;
  const frameA = paint(applyHat(base, look.hat), colors, "a");
  const frameB = pose === "type" ? paint(applyHat(TYPE_B, look.hat), colors, "b") : "";
  const extra = pose === "type"
    ? `<rect class="cursor" x="18" y="33" width="3" height="3" fill="#102416"/>`
    : `<g class="zzz"><rect x="36" y="3" width="3" height="3" fill="#d5def2"/><rect x="40" y="0" width="3" height="3" fill="#d5def2"/><rect x="44" y="6" width="3" height="3" fill="#d5def2"/></g>`;
  return `<svg class="pixel" viewBox="0 0 48 54" aria-hidden="true" focusable="false">${frameA}${frameB}${extra}</svg>`;
}
