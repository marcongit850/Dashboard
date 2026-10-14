// Job responsibilities for each bot page. Edit the sentences in this file.

export const JOBS: Record<string, readonly string[]> = {
  chief: [
    "Chief is the chief of staff for Marc's bot team.",
    "Chief coordinates all the bots, keeps the team handbooks, and runs the Team HQ Log.",
  ],
  bob: [
    "Bob The Builder builds and maintains Marc's websites on Cloudflare Workers.",
    "Those sites include Eating on 30A, Eating in Destin, the Tang-O-Mar HOA portal, Walton Dune Lakes, whereisyourbeach, and others.",
    "Bob also builds and maintains this dashboard.",
  ],
  outreach: [
    "Outreach emails restaurants and follows up with them.",
    "The work is for eatingon30a.com and eatingindestin.com.",
  ],
  walton: [
    "Walton runs the Walton County Updates social media.",
    "Walton keeps that feed posted and current.",
  ],
  "tik-toker": [
    "Tik-Toker makes TikTok short videos for Eating on 30A and Eating in Destin.",
    "The clips are short, friendly, and ready to post.",
  ],
  rank: [
    "Rank handles Google Search Console and SEO for Marc's sites.",
    "Rank looks for search problems and fixes what keeps the sites from being found.",
  ],
  warden: [
    "Warden reviews the code and the sites for security problems.",
    "When a review finds a problem, Warden fixes it.",
  ],
  scout: [
    "Scout does the research and scouting for the team.",
    "Scout looks things up and brings back what Marc and the other bots need.",
  ],
  foody: [
    "Foody & Friends makes the food social content.",
    "The posts cover food, friends, and meals worth sharing.",
  ],
  "savenello-marketing": [
    "Savenello Marketing handles all marketing for the Savenello personal finance app.",
    "That includes the message, the posts, and the campaigns for the app.",
  ],
  "personal-assistant": [
    "Personal Assistant helps with Marc's personal projects and daily life.",
    "This work stays separate from the business sites and the other bots.",
  ],
  "money-man": [
    "money-man builds the Savenello personal finance app.",
    "The work is the app itself, including the features and fixes Marc asks for.",
  ],
  tango: [
    "Tango runs social media for the Seaclusion beach rental.",
    "Tango posts about the house and keeps that feed active.",
  ],
};

export function jobFor(id: string): readonly string[] {
  return JOBS[id] ?? [];
}
