# Agreement is not justification: what a harness can establish about a repository's claims

Harness engineering offers a useful account of working well with a
coding agent: feedforward *guides* that steer the agent before it acts, and
feedback *sensors* that let it correct itself after (Böckeler, 2026). Böckeler
argues that a harness should direct human attention where it matters most,
rather than necessarily eliminate it. I agree, but this leaves a practical
question: which claims still need scrutiny after the checks pass? I distinguish
between **agreement** among a repository's artefacts and **justification** of
the claims those artefacts make. Checks that establish the first do not, by
themselves, establish the second. Treating them as equivalent can leave an
unsupported explanation looking verified.

Agreement is increasingly mechanised, and it is a mistake to say documentation
goes unchecked. The OpenAI team whose harness Böckeler cites uses linters and
CI to check its knowledge base, alongside an agent that proposes fixes for
documentation that no longer reflects code behaviour (Lopopolo, 2026). Small projects
can do a version of this cheaply: a test that fails when a README names a file
that does not exist, a script that fails when a cited commit does not resolve.
Böckeler's inferential sensors, including AI reviewers, can also examine
meaning. This is the strongest counter-case: automated review need not stop
at checking agreement.

But success at checking correspondence does not itself establish justification.
A README can match a measurement report exactly while both describe bot
results as evidence about people. An AI reviewer might catch this; passing a
freshness check cannot establish that it did. Lopopolo's account describes a
team's practice, not a measured error rate for its published explanations.
The distinction concerns what a check establishes, not whether a machine or a
person performs it.

The gap is concrete. Suppose a measurement report explains a result by arguing
that because the random seeds were identical before and after, the difference
cannot be sampling noise. Every agreement check passes: the figures match the
run that produced them, the file is current, no code behaviour contradicts it.
The sentence is still unsupported. Reusing seeds supports paired
comparison (Pearce et al., 2019) and can reduce variance, but it does not
remove uncertainty about performance across other seeds. That requires analysing
the differences and their uncertainty, not simply noting reproducibility.
A check of the reported figures and a check of this inference answer
different questions.

Some of this gap can be closed by better checks. A statistical check could
require an uncertainty estimate; a semantic reviewer could challenge an
unsupported explanation. Someone still has to decide whether those checks
answer the relevant question. Naur (1985) argues that program texts and
documentation do not fully convey the understanding needed to explain and
modify a program. I extend that argument to reviewing evidence: knowing what
a measurement was meant to establish matters alongside reading its output.
This supports keeping informed review, not claiming that automated judgment
is impossible.

Two sources help explain why this distinction matters, although neither
tests documentation review directly. Parasuraman and Riley (1997) describe
automation misuse as over-reliance that can produce monitoring failures and
decision biases. Their account suggests a risk: confidence in reliable code
checks may spill over into trust in unchecked explanations. METR's randomised
trial (Becker et al., 2025)
found sixteen experienced developers took 19% longer on 246 real issues with AI
assistance while believing afterwards that it had made them 20% faster. That
measures productivity and belief, not documentation. It shows that confidence
can diverge from measured outcomes in that setting; it does not establish
that green test logs cause misplaced trust.

The practice I would argue for follows from the distinction. Mechanise
repeatable agreement checks. For important published claims, record the
supporting evidence, applicable version and scope. Review explanations
separately: what was measured, what is inferred, and what remains unknown?
AI reviewers can assist, but I would assign a named person responsibility for
accepting those inferences. This is a practical accountability rule, not a
claim that people are infallible. A harness should make the limits of its
evidence visible, so passing checks does not become permission to overclaim.

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
- Pearce, M., Poloczek, M. & Branke, J. (2019). *Bayesian Optimization
  Allowing for Common Random Numbers*. arXiv:1910.09259.
  https://arxiv.org/abs/1910.09259
