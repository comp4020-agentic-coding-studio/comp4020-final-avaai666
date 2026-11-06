# Agreement is not justification: what a harness can establish about a repository's claims

Harness engineering is the strongest current account of working well with a
coding agent: feedforward *guides* that steer the agent before it acts, and
feedback *sensors* that let it correct itself after (Böckeler, 2026). Böckeler
is explicit that the point is not autonomy. A harness "should not necessarily
aim to fully eliminate human input", but "to direct it to where our input is
most important". I take that principle as settled and argue about its
unanswered half: *to what*. My answer is that the division worth drawing is
between **agreement** among a repository's artefacts and **justification** of
the claims those artefacts make. Harnesses are getting good at the first. The
second is not a weaker version of it, and treating them as one thing is how a
well-harnessed project still publishes things that are not true.

Agreement is increasingly mechanised, and it is a mistake to say documentation
goes unchecked. The OpenAI team whose harness Böckeler cites reports that
"dedicated linters and CI jobs validate that the knowledge base is up to date,
cross-linked, and structured correctly", and that "a recurring 'doc-gardening'
agent scans for stale or obsolete documentation", opening fix-up pull requests
where docs no longer reflect code behaviour (Lopopolo, 2026). Small projects
can do a version of this cheaply: a test that fails when a README names a file
that does not exist, a script that fails when a cited commit does not resolve.
Böckeler's *inferential* sensors — "semantic analysis, AI code review, 'LLM as
judge'" — push the same machinery onto ground that is not purely structural.

What all of these establish is correspondence: this path exists, this commit
resolves, this paragraph matches what the code now does. None of them
establishes that a published number is the right number for the question it
claims to answer, or that an explanation offered for why a number moved is
supported by what was measured. Those are claims about evidence, not about two
artefacts matching.

The gap is concrete. Suppose a measurement report explains a result by arguing
that because the random seeds were identical before and after, the difference
cannot be sampling noise. Every agreement check passes: the figures match the
run that produced them, the file is current, no code behaviour contradicts it.
The sentence is still unsupported. Identical seeds make the comparison paired,
not certain; shared randomness is a variance-reduction technique, not a
guarantee, and deciding what the difference means requires analysing the
per-seed differences, which the report never did. Reproducibility is not
justification, and a freshness check and a justification check are looking at
different objects.

This is not merely a linter nobody has written yet, though some of it is. A
checker encodes a standard that someone has already articulated; the question
of whether that standard is adequate for a particular claim is not inside it.
Naur (1985) argued that a program's text cannot carry the theory that lets
someone judge a modification — the theory being "the ability to do certain
things", held by a person. He was not writing about automated reviewers, and I
am extending rather than applying him: the same recursion appears one level up,
in deciding whether a check is the right check for the claim. That recursion
has to terminate in a reviewer who knows what the measurement was for.

Two findings make the risk more than theoretical, and I should be clear that
neither tested this mechanism directly. Parasuraman and Riley (1997) separate
*misuse* of automation, meaning over-reliance born of complacency, from disuse,
and find monitoring decays when automation is usually right; a true, detailed,
green test log is evidence about something else, and I infer that it suppresses
checking of the claims around it. METR's randomised trial (Becker et al., 2025)
found sixteen experienced developers took 19% longer on 246 real issues with AI
assistance while believing afterwards that it had made them 20% faster. That
measures productivity and belief, not documentation; what it establishes is
that confidence and measured outcome come apart precisely where work looks
finished.

The practice I would argue for follows from the distinction. Mechanise
agreement wholesale, because it is cheap and it is most of the volume. Then
attach to every published claim the evidence it rests on, the version it holds
for, and its scope — and route the explanatory claims, the sentences that say
why a result came out as it did, to a named human reviewer. The useful measure
of a harness is not how much supervision it removes, but whether what remains
is pointed at justification rather than at freshness.

## References

- Becker, J., Rush, N., Barnes, B. & Rein, D. (2025). *Measuring the Impact of
  Early-2025 AI on Experienced Open-Source Developer Productivity*. METR.
  https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- Böckeler, B. (2026). *Harness engineering for coding agent users*.
  martinfowler.com, 2 April 2026.
  https://martinfowler.com/articles/harness-engineering.html
- Lopopolo, R. (2026). *Harness engineering: leveraging Codex in an agent-first
  world*. OpenAI, 11 February 2026.
  https://openai.com/index/harness-engineering/
- Naur, P. (1985). Programming as theory building. *Microprocessing and
  Microprogramming*, 15(5).
- Parasuraman, R. & Riley, V. (1997). Humans and automation: use, misuse,
  disuse, abuse. *Human Factors*, 39(2).
