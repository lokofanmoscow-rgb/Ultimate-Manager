import { generateWorld, startCareer, processDay } from '../src/engine/game';
import { G, P } from '../src/engine/state';
import { makeBid, startNegotiation, respondTerms, finalizeContract, respondToOffer } from '../src/engine/transfers';
import { askingPrice, fullName } from '../src/engine/player';
import { dayOf, fmtDate } from '../src/engine/util';
await generateWorld(99);
const club = G.clubs.find((c) => c.name === 'Спартак Москва')!;
startCareer({ fn: 'Т', ln: 'Т', nat: 'RUS', dob: dayOf(1980, 1, 1), rep: 60, exp: 3, badge: 4, style: '' } as any, club.id);
club.fin.tBudget = 50_000_000; club.fin.wBudget *= 2;
const target = G.players.find((p) => p && p.club >= 0 && G.clubs[p.club].country === 'NED' && p.ca > 130)!;
console.log('target', fullName(target), G.clubs[target.club].name, 'value', target.value, 'ask', askingPrice(target));
let bid = makeBid({ player: target.id, kind: 'transfer', fee: Math.round(askingPrice(target) * 0.8) });
console.log('bid1', typeof bid === 'string' ? bid : bid.status);
for (let i = 0; i < 3; i++) processDay();
const b1 = G.bids.find((b) => b.player === target.id)!;
console.log('after days', b1.status, b1.counter, G.inbox[0]?.subj);
if (b1.status === 'countered') { bid = makeBid({ player: target.id, kind: 'transfer', fee: b1.counter! }); for (let i = 0; i < 3; i++) processDay(); }
const b2 = G.bids.filter((b) => b.player === target.id).pop()!;
console.log('bid2', b2.status);
if (b2.status === 'accepted') {
  const n: any = startNegotiation(target.id, b2.id);
  console.log('negotiation', n.error || JSON.stringify(n.demand));
  if (!n.error) {
    const r = respondTerms(n, { ...n.demand });
    console.log('respond', r.result, r.text);
    if (r.result === 'accept') console.log(finalizeContract(n, { ...n.demand }));
    console.log('player club now', G.clubs[P(target.id).club].name, 'wage', P(target.id).wage, 'contract', fmtDate(P(target.id).cEnd));
  }
}
// AI offers for user players
let offers = 0;
for (let i = 0; i < 60; i++) {
  processDay();
  for (const m of G.inbox.filter((m) => m.data?.type === 'offer' && !m.done)) {
    offers++;
    m.done = true;
    console.log('offer:', m.subj, '->', respondToOffer(m.data.bid, offers % 2 ? 'accept' : 'reject'));
  }
}
console.log('offers in 60 days', offers, 'date', fmtDate(G.day), 'squad', club.players.length);
