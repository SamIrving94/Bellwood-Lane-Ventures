# Proposal: EIG subscription (£30/month)

**For:** Anthony
**From:** Sam
**Date:** May 2026
**Decision needed:** sign off on a £30/month EIG subscription
**Recoupable:** one acquisition from this signal pays back ~33 years of the subscription

---

## The ask

Subscribe to EIG (Essential Information Group) at **£30/month**. They aggregate every UK property auction that runs each week. Crucially, they publish the **lots that failed to sell** — the unsold inventory — within hours of the auction ending.

---

## Why this isn't already covered by what we have

We're already pulling **PropertyData's `auction-properties` list** — and it works. But that's the wrong half of the market.

| Signal | What it tells us |
|---|---|
| PropertyData `auction-properties` | Properties going to auction soon — competitive, full reserve, multiple buyers |
| **EIG unsold lots** | Properties that **failed to sell at auction** — reserve not met, no winning bid, legal pack already prepared, demonstrably motivated seller |

A property that didn't sell at auction is the **most pre-qualified distressed seller in the UK market.** They:

1. Already tried the fast route and it didn't work
2. Have a legal pack ready, sitting on a solicitor's desk
3. Have a guide price that didn't get a bid → real negotiating room
4. Have an auctioneer who needs to explain the failure to the seller and is open to a quick exit

UK auction clearance fell to **36% in London in April 2026.** Roughly two thirds of lots don't sell. That's the harvest. Nobody else is systematically working it.

---

## What we'd actually do with it

A workflow that runs the morning after every auction:

1. EIG scraper pulls the previous day's unsold lots in our target postcodes
2. Our existing Bellwood Score runs on each one (we already have the pipeline)
3. Within 2 hours of the hammer falling, **Marketer drafts a personalised message to the auctioneer** (not the seller — auctioneer respects that boundary)
4. The message: *"We saw Lot [X] didn't sell yesterday. We can offer £[Y] cash, 28-day exchange. Want to talk this morning?"*
5. Board (you or me) approves and Liaison sends

We arrive in the auctioneer's inbox **before any other cash buyer has woken up.** That's a real edge — built from a £30/month feed and infrastructure we already have.

---

## The economics

| | |
|---|---|
| Cost | £360/year |
| Average Bellwood acquisition margin | ~25% × ~£200k = £50k per deal |
| Break-even | **less than 1% of one deal** |
| Realistic conversion target | 1 deal/quarter from this channel = ~£200k/year of acquisition flow |

This isn't a 12-month ROI calculation. It's: **one closed deal from this source in the first year recovers the subscription for the next three decades.**

---

## Alternatives I considered (and why they're worse)

| Option | Verdict |
|---|---|
| Scrape individual auction houses (Allsop, SDL, Auction House UK, Hammered, etc.) | Each has different formats, ToS risks, fragile pipelines. 5 separate integrations vs 1. |
| Stick with PropertyData `auction-properties` only | Wrong signal — those are pre-auction listings, not failed ones. |
| Pay one of the big proptech aggregators | £200-500/month. Same data, 10× the price. |
| Subscribe to Allsop direct (the biggest single auction house) | Misses everything else. EIG aggregates all major auctioneers. |

EIG is the consolidated source. £30/month is roughly the marginal cost of being able to act on this signal at all.

---

## The compounding angle (why I'd subscribe even if the first deal takes 6 months)

Every unsold lot we pursue teaches us:
- Which auctioneers are responsive (and which are gatekeepers)
- Which postcodes have systematically unsold stock (= where to focus our scouting)
- What discount level actually clears (we calibrate the Bellwood offer)
- Which property types fail at auction in our regions

That's market intelligence we don't get any other way. Six months of EIG data is a defensible private dataset.

---

## What I need from you

A **yes / no** on £30/month.

If yes:
1. I sign up at [eigpropertyauctions.co.uk](https://www.eigpropertyauctions.co.uk/) on the company card
2. I wire the EIG scraper into the scouting pipeline alongside `/sourced-properties`, `/planning-applications` and `/national-hmo-register`
3. We auto-trigger the morning-after workflow within a week
4. First failed-auction outreach goes out within 14 days
5. I report back at the 30-day mark on what came through — keep or kill based on real data

If no: tell me what about it doesn't sit right and we'll work the alternative.

---

## My honest belief

We've spent the last few weeks getting PropertyData working. That covers 80% of automated distress signals — but **only the listings side**. EIG covers a market that PropertyData doesn't see at all, and it's the most motivated single segment in UK property right now. £30/month to plug that gap is the cheapest defensible advantage we can buy.
