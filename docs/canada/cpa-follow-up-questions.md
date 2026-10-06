# Follow-up questions for our CPA reviewer

Thank you for the notes on the retirement fields doc. They changed our thinking on MER, FX, US withholding, residency and the principal residence exemption. Below are our follow-up questions.

**How to answer:** most questions state the simplification we plan to make. A quick "fine", "not fine, because…" or "fine for v1, fix later" is all we need. Where we give a default, we will use it unless you tell us otherwise.

**Short on time?** The ★ questions decide our MVP scope. Please answer those first.

**Context:** the MVP is a deterministic, year by year retirement projection for **one Canadian tax resident outside Quebec**. It runs from today to age 95, with federal and provincial tax, CPP/OAS/GIS, RRIF minimums and one default withdrawal order. It is a **planning estimate, not a filing tool**. We need to know where approximations are acceptable and where they would mislead.

---

## Your questions to us (draft answers, to confirm)

- **Will a contribution plan ship with the MVP?** Draft: yes, in a simple form. You enter one yearly savings amount until retirement, and the app splits it across RRSP, TFSA and non registered (see Q24).
- **Helper icons?** Draft: yes. Each field gets a short explanation, plus an "Ask AI" link that opens the assistant with that field as context. We would love your review of the tax-related copy (Q34).
- **More detail on the Plan page:** draft to follow as a separate mockup. In short: one score, the 3 to 5 issues hurting the plan, and a "this year" list of actions. Each action shows an amount, the account and a deadline.

---

## A. Scope and accuracy bar

1. ★ **MVP simplifications.** Our planned v1 is single person, Canadian resident for the whole plan, outside Quebec, fixed annual return and annual time steps. Future brackets are today's brackets indexed at 2.5%. For a typical 55 to 65 year old with a few hundred thousand to a few million in savings, which of these would make the output **misleading**, as opposed to just imprecise?
2. ★ **Couples.** Most pre-retirees we expect are couples, and pension splitting and spousal rollover are big levers. Is a single-person plan for a married client misleading enough that we should not ship without couples? As a stopgap, could we model each spouse as an independent single person with no splitting and label the result as conservative?
3. ★ **Your additions, ranked.** You raised business owners and the LCGE, multiple-property PRE, RESP, non-residents and FX. For a pre-retiree audience, roughly what share of clients does each one affect? Which can wait for a later phase if v1 shows a clear "not modelled, talk to a professional" flag?
4. **Provinces.** The engine logic is shared, and each province is mostly data plus a few quirks (ON surtax and health premium, for example). Is federal plus Ontario a sensible first release, with other provinces added after review? Which provinces have quirks that are not just brackets and credits? Is deferring Quebec (QPP plus a separate return) the right call?
5. ★ **Accuracy benchmark.** One proposal is to match MayRetire within about 2% on lifetime tax. Is that the right benchmark? What tolerance would you sign off on, and what would you test against (your tax software, TaxTips.ca calculators, something else)?
6. ★ **Golden test cases.** Could you give us 3 to 5 anonymized or invented client profiles with the numbers you would expect for year 1? Expected numbers would be taxable income, federal and provincial tax, OAS clawback and RRIF minimum. These become automated tests the engine must pass before release. This may be the most valuable thing you could give us.

## B. Spending and withdrawals

7. ★ **5% drawdown vs spending target.** Your note says a typical strategy assumes a 5% NAV drawdown per year. The other doc instead takes an after-tax spending target and solves for the withdrawals needed.
   - Which should be the primary input?
   - Is 5% the right default when a user gives no spending number?
   - Is the 5% real or nominal?
   - How does it interact with RRIF minimums, which exceed 5% from age 71?
8. ★ **Default withdrawal order.** Our default is: non registered first, then RRSP/RRIF topped up to a target bracket ("meltdown"), then TFSA last.
   - Do you agree with this as the default for most people?
   - Which bracket do you usually fill to (top of the first federal bracket, below the OAS clawback threshold, something else)?
9. **When meltdown is wrong.** When would you tell a client **not** to draw down the RRSP early, for example because of low income, GIS eligibility or a large age gap with their spouse? We want the app to stay quiet in those cases.
10. **Withholding on RRSP/RRIF withdrawals.** Our understanding: no withholding on the RRIF minimum, and 10/20/30% lump-sum rates above it, reconciled on the T1. For a plan, is it enough to model this as a cash-flow timing effect, or can we ignore it and use only final tax?
11. **OAS clawback timing.** OAS payments from July to June are based on the prior year's income. Is it acceptable to model the clawback against same-year income for v1?

## C. Accounts and cost basis

12. ★ **Account types.** Which of these need their own tax treatment in v1, and which can share one?
    - TFSA, RRSP, spousal RRSP, RRIF, LIRA, LIF, FHSA, RESP, RDSP, non registered, corporate, cash.
    - Our guess: LIRA behaves like an RRSP until conversion, a spousal RRSP is an RRSP plus the 3-year attribution rule, and RESP and RDSP are excluded from retirement funds.
13. **RESP.** You suggested adding it. Should it count toward the retirement plan at all (the contributions portion only?), or should it be shown as a household asset outside the projection?
14. **Joint non registered accounts.** How should income and gains be split between spouses: 50/50 by default, or by who contributed (attribution)? What do you see in practice?
15. ★ **ACB across accounts.** We track cost basis per holding, per account. Our understanding is that Canadian ACB is averaged across identical properties held by the same person in all non registered accounts. Is per-account cost basis close enough for a **planning** estimate, or should we merge identical securities across a person's non registered accounts from day one?
16. ★ **Unknown ACB.** If a user doesn't know their ACB, which default is least harmful: ACB = market value (no embedded gain), a fixed ratio, or blocking the plan? Which broker-reported book value errors do you see most often (return of capital, reinvested or phantom distributions, transfers in kind)?
17. **Capital gains inclusion.** We plan to use 50% inclusion for all gains. Our understanding is that the 2024 proposal for two-thirds inclusion above $250K was cancelled in 2025. Is anything pending that we should design for?
18. **What to ask from CRA documents.** What is the minimum set of numbers you would want a user to copy from their Notice of Assessment and CRA My Account? Our guess: RRSP deduction limit, TFSA room, unused capital losses and unused RRSP contributions. Anything else?

## D. Investment income, FX and foreign holdings

19. ★ **US dividend withholding by account.** Our understanding:
    - The 15% US withholding is waived in RRSP/RRIF for **US-listed** securities only. A Canadian-listed ETF holding US stocks still loses it inside the fund.
    - It is a permanent loss in a TFSA (and RESP/FHSA).
    - It is recoverable as a foreign tax credit in a non registered account.

    Is that right? For v1, is a flat "15% drag on US dividends outside RRSP/RRIF" good enough?

20. **Distribution types.** Can we infer eligible dividends from the security (Canadian public company means eligible)? ETF distributions mix interest, foreign income, capital gains and return of capital. What approximation would you accept for a plan (one yield with a fixed mix, a per-ETF mix, something else)?
21. **FX in projections.** You suggested holding CAD/USD constant. We already value USD holdings in CAD daily. Is constant FX for the base case, plus an optional "CAD ±X%" scenario, enough? For realized gains on USD securities, we would convert both cost and proceeds at historical rates. Correct?
22. **Cross-border flags.** Should we flag these without modelling them in v1?
    - T1135 foreign property reporting (above $100K cost)
    - US estate tax exposure from US-situs assets
    - Departure tax for people planning to retire abroad

## E. Income before retirement

23. **Merit increase.** You suggested 3% a year until retirement. Is that 3% nominal or on top of inflation? Is it a default you see clients accept, or should users enter their own?
24. **Where to save.** For yearly savings until retirement, what is your rule of thumb for the order across RRSP, TFSA, FHSA and non registered at different income levels? We would turn it into the default split (and RRSP room = 18% of earned income up to the yearly limit).

## F. Government benefits

25. **CPP default.** If the user doesn't paste their My Service Canada estimate, is "average CPP" a reasonable default or does it mislead badly? Would a rough estimate from their current income and years worked be better? Does the statement already include the post-2019 CPP enhancement?
26. **GIS.** Our expected users have meaningful savings, so GIS will rarely apply. Can v1 skip GIS and show a flag only when projected income gets near the cutoff?
27. **Credits that matter.** Which credits change the result materially for this audience: basic personal, age amount, pension income credit (RRIF income at 65+), dividend tax credit, donation credit? Can any be left out of v1?
28. **Immigrants and OAS/CPP.** Many of our current users are Italian, and Canada has a social security agreement with Italy. For OAS residency and totalization, is "years lived in Canada after 18" enough for v1, with a flag for anyone who lived abroad?

## G. Residency

29. ★ **Residency gate.** For v1 we plan to require "Canadian tax resident today and for the whole plan" and show a flag otherwise. What 2 or 3 simple questions would catch the cases that break this assumption (snowbirds, recent immigrants, people planning to retire abroad)?

## H. Home, estate and business owners

30. **Principal residence.** For planning (not filing), is it enough for the user to choose one designated property, with any other property taxed on its gain when sold? Can pre-1982 or pre-1994 elections be ignored?
31. **Estate at death.** We plan to model RRSP/RRIF income inclusion, deemed disposition of non registered gains and a tax-free TFSA. Should v1 also include probate fees (provincial), and the spousal rollover once couples ship?
32. **Business owners and LCGE.** How many of your retirement clients are incorporated? Can v1 detect "incorporated" and say "this plan ignores your corporation, talk to a CPA" without modelling it? Is the business owner path, with LCGE on QSBC shares and salary vs dividends, really a separate product?

## I. Tax tables and your involvement

33. ★ **Tax tables.** You leaned toward licensing. Do you know specific vendors or data feeds? Foliofox is open source, so another option is publishing the tables (brackets, credits, OAS threshold, RRIF %, TFSA and RRSP limits) as plain data files that anyone can review. Each January update would come with sources such as CRA T4127, provincial budgets and the CRA indexation notices. Would you trust that approach, and which sources would you insist on?
34. **Review role.** Would you be willing to review the yearly table update and the tax-related help text? Roughly how much time could you give? Would you be comfortable being credited publicly as a reviewer of the tax logic, or would you prefer not to be named?
35. **What not to automate.** In the other doc's list of levers (CPP/OAS timing, meltdown amount, TFSA refill, withdrawal order, donating in kind, pension splitting), which would you be uncomfortable seeing an app suggest **without** a professional reviewing it first?
36. **Common mistakes.** What do clients most often get wrong when they report their own numbers (contribution room, ACB, CPP estimate, pension details)? We will add a "check this" flag for each.
