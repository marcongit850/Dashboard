export type Post = {
  at: Date;
  botId: string;
  source: string;
  site: string;
  platform: string;
  account: string;
  status: string;
  topic: string;
  url: string;
  notes: string;
};

export type StatusState = "started" | "working" | "finished" | "blocked" | "idle" | "unknown";

export type StatusRow = {
  at: Date;
  botId: string;
  state: StatusState;
  task: string;
  link: string;
  needsMarc: boolean;
};

export type Pull = {
  repo: string;
  title: string;
  branch: string;
  url: string;
  createdAt: Date;
  mergedAt: Date | null;
  botId: string;
};

export type Commit = {
  repo: string;
  message: string;
  url: string;
  at: Date;
  branch: string;
  botId: string;
};

export type DocLink = {
  name: string;
  url: string;
  about: string;
  ownerId: string | null;
  ownerLabel: string;
};

export type RawData = {
  posts: Post[];
  statuses: StatusRow[];
  pulls: Pull[];
  commits: Commit[];
  docs: DocLink[];
  notes: string[];
};
