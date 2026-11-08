import type { Duty } from './attrs';

export interface PStats {
  apps: number; sub: number; gls: number; ast: number; rat: number; ratN: number;
  yc: number; rc: number; min: number; cs: number; potm: number;
}
export const emptyStats = (): PStats => ({ apps: 0, sub: 0, gls: 0, ast: 0, rat: 0, ratN: 0, yc: 0, rc: 0, min: 0, cs: 0, potm: 0 });

export interface PHist { s: number; club: number; apps: number; gls: number; ast: number; rat: number; loan?: 1 }

export interface Player {
  id: number;
  fn: string;
  ln: string;
  nat: string;
  dob: number;
  h: number;
  wt: number;
  fl: number; // left foot 1..20
  fr: number; // right foot
  pos: number[]; // familiarity 0..20 for 14 positions
  a: number[]; // attributes 47
  hid: number[]; // hidden 13
  ca: number;
  pa: number;
  club: number; // -1 free agent
  loan?: { from: number; until: number; wagePct: number; buy?: number };
  wage: number; // weekly
  cEnd: number; // contract end (day)
  rc?: number; // release clause
  value: number;
  rep: number; // 0..100
  cond: number; // 0..100
  sharp: number; // 0..100
  morale: number; // 0..100
  inj?: { name: string; until: number };
  ban: number[]; // [league, cup, euro]
  yc: number[]; // accumulated yellows [league, cup, euro]
  form: number[];
  st: PStats;
  hist: PHist[];
  status: number; // squad status: 0 key,1 regular,2 rotation,3 backup,4 youth/prospect
  listed?: number; // 1 transfer, 2 loan
  shirt: number;
  real?: 1;
  retired?: 1;
  joined: number;
  unhappy?: number; // days unhappy
  wantsOut?: 1;
  devAcc: number;
  lastGame?: number; // day of last appearance
  intl?: number; // caps
}

export type StaffRole = 'ASS' | 'COACH' | 'GKC' | 'FIT' | 'SCOUT' | 'PHYSIO' | 'ANALYST' | 'YOUTH';
export interface Staff {
  id: number;
  fn: string;
  ln: string;
  nat: string;
  dob: number;
  role: StaffRole;
  club: number; // -1 free
  wage: number;
  cEnd: number;
  // attributes 1..20: [att, def, fit, gk, ment, tact, tech, youngsters, adapt, det, disc, manMgmt, motiv, judgeA, judgeP, tactKnow, physio, sportSci]
  a: number[];
  rep: number;
}

export interface TeamInstr {
  mentality: number; // 0..6
  passing: number; // 0..4
  tempo: number; // 0..4
  width: number; // 0..4
  dline: number; // 0..4
  loe: number; // 0..2
  press: number; // 0..3
  tackle: number; // 0..2
  counter: boolean;
  counterPress: boolean;
  offside: boolean;
  playOut: boolean;
  cross: number; // 0 mixed,1 low,2 whipped,3 floated
  shootOnSight: boolean;
  workIntoBox: boolean;
  timeWaste: boolean;
  focus: number; // 0 mixed,1 left,2 centre,3 right
  dribble: number; // 0 less,1 normal,2 more
  gkDist: number; // 0 short,1 mixed,2 long
}

export interface SlotSetting {
  role: string;
  duty: Duty;
}

export interface Tactic {
  name: string;
  formation: string;
  slots: SlotSetting[]; // 11
  ti: TeamInstr;
}

export interface Selection {
  lineup: number[]; // 11 player ids by slot (0 = empty)
  subs: number[]; // bench
  cap: number;
  pen: number;
  fk: number;
  crn: number;
  auto: boolean; // auto-pick lineup (AI)
}

export interface FinMonth {
  y: number;
  m: number;
  inc: Record<string, number>;
  exp: Record<string, number>;
}

export interface ClubFin {
  balance: number;
  tBudget: number; // remaining transfer budget
  wBudget: number; // weekly wage budget
  tvYear: number; // annual TV/central money estimate
  comYear: number; // commercial income per year
  ticket: number; // ticket price avg
  months: FinMonth[];
  debt: number;
}

export interface Club {
  id: number;
  name: string;
  short: string;
  country: string;
  c1: string;
  c2: string;
  kit: string; // '', 's' stripes, 'h' hoops, 'q' halves, 'x' sash
  crest: number; // crest shape index
  rep: number; // 0..100
  league: string | null; // league def id (e.g. 'ENG1'); null = dormant
  cap: number; // stadium capacity
  stadium: string;
  city: string;
  facT: number; // training facilities 1..20
  facY: number; // youth facilities 1..20
  fin: ClubFin;
  players: number[];
  staff: number[];
  tactic: Tactic;
  sel: Selection;
  mgr: string; // AI manager name
  coef: number[]; // last 5 seasons UEFA points (most recent last)
  famil: Record<string, number>; // formation familiarity 0..100
  founded?: number;
  wageScale: number;
  b?: { ambition: number }; // board traits
  lastTalk?: number;
}

export interface Fixture {
  id: number;
  comp: string; // comp instance id
  stage: string; // display name of round/stage
  rnd: number; // matchday / round index
  day: number;
  home: number;
  away: number;
  hg: number;
  ag: number;
  played: boolean;
  et?: 1;
  ph?: number;
  pa?: number;
  tie?: number;
  leg?: number;
  neutral?: 1;
  ev?: number[]; // [minute, type, playerId, side] * n  type: 1 goal,2 own goal,3 pen goal,4 yellow,5 red,6 assist,7 injury
  att?: number;
  potm?: number;
  rh?: number[]; // player ratings home [pid, rating*10]...
  ra?: number[];
  stats?: number[]; // [possH, shotsH, shotsA, sotH, sotA, xgH*100, xgA*100, cornH, cornA, foulH, foulA]
}

export interface Row {
  club: number;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  form: string;
  ded?: number;
}

export interface Tie {
  id: number;
  round: string;
  ri: number; // round index
  a: number; // home in first leg
  b: number;
  legs: 1 | 2;
  fx: number[];
  winner?: number;
  neutral?: boolean;
  next?: number; // bracket: tie id the winner goes to
  slot?: number; // 0/1 position in next tie
  path?: string; // euro qualifying path 'CP'/'LP'/'MP'
}

export interface Comp {
  id: string;
  kind: 'league' | 'cup' | 'super' | 'euro' | 'po';
  def: string;
  name: string;
  short: string;
  country?: string;
  tier?: number;
  season: number;
  clubs: number[];
  done: boolean;
  // league
  stage?: number;
  groups?: number[][];
  table?: Record<number, Row>;
  stageStartTable?: Record<number, Row>;
  totalRounds?: number;
  roundDays?: number[];
  // knockout
  ties?: Tie[];
  rounds?: { name: string; days: number[]; done: boolean; drawn: boolean; entrants?: number[]; size?: number; legs: 1 | 2; path?: string }[];
  // euro league phase
  lp?: { teams: number[]; pots: number[][]; md: number; table: Record<number, Row> };
  winner?: number;
  runnerUp?: number;
  scorers: Record<number, number[]>; // pid -> [goals, assists, apps]
  meta?: any;
}

export interface Msg {
  id: number;
  day: number;
  from: string;
  subj: string;
  body: string;
  kind: string;
  read: boolean;
  needs?: boolean; // requires a decision before continuing
  done?: boolean;
  data?: any;
  important?: boolean;
}

export interface Bid {
  id: number;
  player: number;
  buyer: number;
  seller: number; // -1 free agent
  kind: 'transfer' | 'loan' | 'free';
  fee: number;
  sellOn?: number;
  instal?: number; // number of yearly installments
  loanWage?: number; // % paid by buyer
  loanUntil?: number;
  loanFee?: number;
  buyOpt?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'contract' | 'done' | 'cancelled' | 'collapsed';
  respond: number; // day when seller responds
  counter?: number;
  rounds: number;
  user: 'buy' | 'sell' | 'none';
  completeDay?: number;
  terms?: ContractTerms;
  note?: string;
}

export interface ContractTerms {
  wage: number;
  years: number;
  bonus: number; // signing bonus
  rc?: number; // release clause
  status: number; // squad status
  agent?: number;
}

export interface TransferLog {
  day: number;
  player: number;
  from: number;
  to: number;
  fee: number;
  loan?: boolean;
  name: string;
}

export interface Manager {
  fn: string;
  ln: string;
  nat: string;
  dob: number;
  rep: number; // 0..100
  exp: number; // playing experience 0..5
  badge: number; // 0..4 (none, C, B, A, Pro)
  style: string;
  club: number; // -1 unemployed
  wage: number;
  cEnd: number;
  joined: number;
  record: { p: number; w: number; d: number; l: number };
  history: { club: number; from: number; to?: number; p: number; w: number; d: number; l: number; trophies: string[] }[];
  trophies: { name: string; season: number; club: number }[];
}

export interface Board {
  conf: number; // 0..100
  confM: number; // matches component
  confF: number; // finances component
  exp: { league: number; leagueText: string; cup: string; euro: string; finance: string };
  ultimatum?: { from: number; matches: number; pts: number; played: number; got: number; fxStart: number };
  warned?: boolean;
  lastReq?: number;
  history: { day: number; text: string }[];
  meetings: number;
}

export interface Country {
  code: string;
  rank: number; // current assoc ranking (1..)
  coef: number[]; // last 5 seasons points
  lastFinal: { season: number; table: number[][]; cupWinner?: number; cupRunner?: number } | null;
  seasons: Record<string, number>; // league id -> current season label
  curSeason: number; // label of the country's current/most recent season
  pool: number[]; // dormant clubs
}

export interface Honour {
  season: number;
  winner: number;
  runner?: number;
}

export interface NewsItem {
  day: number;
  text: string;
  kind: string;
}

export interface Game {
  v: number;
  seed: number;
  rng: number;
  day: number;
  startDay: number;
  season: number; // European season year (Jul..Jun)
  user: number; // user club id (-1 unemployed)
  mgr: Manager;
  board: Board;
  clubs: Club[];
  players: (Player | null)[];
  staff: (Staff | null)[];
  countries: Record<string, Country>;
  comps: Record<string, Comp>;
  fixtures: Record<number, Fixture>;
  fxByDay: Record<number, number[]>;
  inbox: Msg[];
  news: NewsItem[];
  bids: Bid[];
  transfers: TransferLog[];
  honours: Record<string, Honour[]>; // def id -> list
  nid: { p: number; s: number; fx: number; msg: number; bid: number; tie: number };
  euroHolders: { UCL?: number; UEL?: number; UECL?: number };
  training: { focus: number; intensity: number };
  settings: { mode: number; speed: number; cam: number; autosave: boolean };
  shortlist: number[];
  scouted: Record<number, number>; // player id -> knowledge 0..100
  scoutTasks: { id: number; target: string; until: number; country?: string }[];
  flags: Record<string, any>;
  sacked?: boolean;
  pendingMatch?: number; // fixture id the user must play
  jobOffers?: { club: number; until: number }[];
  lastSaveSlot?: string;
}
