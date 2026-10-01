# Strategy check — does Option C fit Kept?

_Written: 2026-10-01. Checked against `docs/DECISION-STACK.md`, `docs/brand/KEPT.md`, `docs/marketing/PLAN.md`, `docs/OCTOBER-LAUNCH.md`, `docs/LEARNINGS.md`._

Founder chose **Option C** (neutral sell-vs-let calculator). This is the "one more message" the challenge rule asks for.

---

## 1. Who Kept serves (from the Decision Stack)

- People who need to sell **fast and for certain**, not for the last pound.
- Probate, chain breaks, relocations, problem properties, distress.
- Kept buys **below market by design**, and says who it is wrong for.
- The wedge is the **fall-through moment** (Bet 1).
- "Vendors Google in private at 11pm, on a phone" (PLAN.md §1). ChatGPT is now one of those places.

## 2. Does Option C fit? Mostly no.

| Question | Answer |
|:--|:--|
| Is the "sell or let?" asker in Kept's ICP? | **Mostly no.** They have time and options. They want the most money. That is who Kept is "wrong for". |
| When the maths says "sell", who do they call? | **Usually an estate agent**, not a below-market cash buyer. |
| Does it ladder up to a Bet? | Weakly. Not Bet 1 (fall-through) or Bet 4 (capital). |
| Does it fit the October launch? | No. October is Keyhole pilots, the agent channel and the prime trial. This would be a new channel. |
| Brand risk? | Medium. A buyer-run "should you sell?" tool reads as a funnel (Keyhole lesson, 29 Aug). |

**Will it get customers?** My honest guess: **very few.** I can't prove it, because we have no data on this channel. But the logic is weak: the audience self-selects *away* from what we sell.

## 3. Where the same idea DOES fit

Keep the plugin, and keep it neutral. Change **who it is for**. Three better-aimed versions:

| Idea | Who asks ChatGPT | Why it fits Kept | Watch out |
|:--|:--|:--|:--|
| **A. "My buyer pulled out — what now?"** | Seller whose chain just broke | **Bet 1, the wedge.** Panicked, private, late at night: exactly the ChatGPT moment. | Most go via their agent. Copy must not prey on panic. |
| **B. "Inherited a house — sell or let?"** | Executors and beneficiaries | **Probate = segment #1.** Keyhole already does open-data reports with no valuation. Same sell-or-let maths, aimed right. | Executor duty (devastavit). Frame it as **evidence for the decision file**, like Keyhole. No numbers on IHT (KEPT.md). |
| **C2. "Should I sell my buy-to-let?"** | Tired landlords exiting (Renters' Rights Act, tax) | Landlords want certainty. **Tenanted homes are hard to sell** on the open market, so investors are natural buyers (**Bet 4**). The scouting code already tracks `landlord_selling_up` and `tenant_in_situ`. | **Does Kept buy tenanted homes?** Not found in code or site copy. Needs your answer. Check Renters' Rights Act details before writing copy. |

**My recommendation:** build **one calculator core** (sale proceeds vs keeping, open data, no verdict, no Kept figure). Aim it at **B first** (inherited homes). Add **A** as a second tool. Run **C2** only if Kept buys tenanted homes.

---

## 4. Do people have to install the plugin?

**Short answer: yes, one click. But it doesn't have to kill it.**

- **Before directory approval:** only developer-mode users (us) can use it. **Zero public reach.**
- **After approval**, people reach it four ways **[snippet]**:
  1. **Directory** — browse, click **Connect**.
  2. **In-conversation suggestion** — ChatGPT spots intent and offers a **one-click Connect** inline, then carries on the task. Improved at DevDay.
  3. **@mention** once connected.
  4. **Our own links** (site, emails, agents).
- **No account and no sign-up** if the tools are anonymous (`noauth`). Connect is one click plus an approval prompt.
- **Free and Go users** can find and use plugins. Only *extensions* (sidebar/panels) are missing for them.
- **What we can't control:** whether ChatGPT suggests us. Placement depends on usefulness and satisfaction. Submission guarantees nothing.
- **Not verified:** whether third-party plugins are live for UK users.

### The route that needs NO install

- ChatGPT already **searches the web and cites pages** when people ask property questions.
- A good public calculator page on wearekept.co.uk can be **cited by ChatGPT with no plugin at all**. Google sees it too.
- This is cheaper and testable this month.

**So the plan I'd suggest:**

1. Build the calculator core **once**, as a package.
2. Ship it first as a **web page** (noindex until one real user tries it, per the "ship dark" rule).
3. Wrap the **same core** as a ChatGPT plugin. Test it in developer mode.
4. Submit to the directory only once the page shows real demand.

If the plugin never gets suggested, we still have the page. Nothing is wasted.

---

## 5. Decisions needed

1. **Aim:** B (inherited homes) first? Or keep generic Option C?
2. **Does Kept buy tenanted homes?** (Decides C2.)
3. **Web page first, plugin second?**
