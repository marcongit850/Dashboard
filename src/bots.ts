export type Hat = "none" | "hardhat" | "chef" | "crown" | "cap" | "phones";

export type Look = {
  hair: string;
  skin: string;
  shirt: string;
  hat: Hat;
  hatColor: string;
};

export type Bot = {
  id: string;
  slug: string;
  display: string;
  fullName: string;
  look: Look;
};

export const BOTS: Bot[] = [
  { id: "chief", slug: "chief", display: "Chief", fullName: "Chief", look: { hair: "#d9d3c5", skin: "#f2c7a0", shirt: "#243e73", hat: "crown", hatColor: "#f0c14a" } },
  { id: "bob", slug: "bob", display: "Bob", fullName: "Bob The Builder", look: { hair: "#6b3f22", skin: "#f2c7a0", shirt: "#e07a2f", hat: "hardhat", hatColor: "#f0c14a" } },
  { id: "money-man", slug: "money-man", display: "money-man", fullName: "money-man", look: { hair: "#1b1b1b", skin: "#e0b08a", shirt: "#1f7a4d", hat: "none", hatColor: "#f0c14a" } },
  { id: "walton", slug: "walton", display: "Walton", fullName: "Walton", look: { hair: "#c47a3a", skin: "#f2c7a0", shirt: "#1f8a8a", hat: "cap", hatColor: "#1f8a8a" } },
  { id: "foody", slug: "foody", display: "Foody", fullName: "Foody & Friends", look: { hair: "#2b2118", skin: "#f2c7a0", shirt: "#e24b4b", hat: "chef", hatColor: "#f7f7fb" } },
  { id: "tango", slug: "tango", display: "Tango", fullName: "Tango", look: { hair: "#111111", skin: "#c68658", shirt: "#c43b78", hat: "none", hatColor: "#c43b78" } },
  { id: "tik-toker", slug: "tik-toker", display: "Tik-Toker", fullName: "Tik-Toker", look: { hair: "#f2f2f2", skin: "#f2c7a0", shirt: "#20242e", hat: "phones", hatColor: "#49e0d0" } },
  { id: "rank", slug: "rank", display: "Rank", fullName: "Rank", look: { hair: "#3a2a55", skin: "#e0b08a", shirt: "#6d4ca8", hat: "none", hatColor: "#6d4ca8" } },
  { id: "outreach", slug: "outreach", display: "Outreach", fullName: "Outreach", look: { hair: "#5a3a2a", skin: "#f2c7a0", shirt: "#3c7dcc", hat: "none", hatColor: "#3c7dcc" } },
  { id: "scout", slug: "scout", display: "Scout", fullName: "Scout", look: { hair: "#8a5a32", skin: "#e0b08a", shirt: "#6d7a3a", hat: "cap", hatColor: "#c2a15a" } },
  { id: "warden", slug: "warden", display: "Warden", fullName: "Warden", look: { hair: "#222222", skin: "#c68658", shirt: "#6e2430", hat: "cap", hatColor: "#2a2a2a" } },
  { id: "savenello-marketing", slug: "savenello-marketing", display: "Savenello Marketing", fullName: "Savenello Marketing", look: { hair: "#7a3048", skin: "#f2c7a0", shirt: "#e07a5f", hat: "none", hatColor: "#e07a5f" } },
  { id: "personal-assistant", slug: "personal-assistant", display: "Personal Assistant", fullName: "Personal Assistant", look: { hair: "#c9893a", skin: "#f2c7a0", shirt: "#c9b6e4", hat: "none", hatColor: "#c9b6e4" } },
];

const EXTRA: Record<string, string> = {
  tiktoker: "tik-toker",
  moneyman: "money-man",
  savenello: "savenello-marketing",
  pa: "personal-assistant",
  "bob builder": "bob",
};

export function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const byNorm = new Map<string, string>();
for (const bot of BOTS) {
  for (const value of [bot.id, bot.slug, bot.display, bot.fullName]) {
    byNorm.set(normName(value), bot.id);
  }
}
for (const [key, id] of Object.entries(EXTRA)) byNorm.set(key, id);

export function matchBot(value: string): string | null {
  const key = normName(value);
  if (!key) return null;
  return byNorm.get(key) ?? null;
}

export function findBot(slug: string): Bot | undefined {
  return BOTS.find((bot) => bot.slug === slug);
}

export function botById(id: string): Bot | undefined {
  return BOTS.find((bot) => bot.id === id);
}
