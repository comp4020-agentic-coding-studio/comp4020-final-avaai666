# Crit 10 reflection

## What was the breakthrough that moved the work forward?

Seeing that my problem was not the code. Every session ended green, and the
project still got worse to look at:
- three games stacked on one site;
- a lobby that only listed names;
- a plan that had quietly dropped three of the four games I asked for.

The tests were right about what they checked: the code matched the plan.
Nobody had checked whether the plan matched what I wanted, or whether a
stranger could tell what the site was for.

The fix was to make those two things checkable too. My scope is now a rule
in `CLAUDE.md` that the agent must stop at. A marker's route through the
site is now a test.

## What did this work change about who I want to be as a software developer?

I used to think the agent's job was to build and my job was to check its
code. Now I think my real job is to own the decisions that no test can make:
- what the product is;
- what is in scope;
- what a first-time visitor should understand.

Then I write each one down where it will be enforced.

When the agent stopped and asked me, three times in this stretch, it was
right every time. I want to be the developer who writes rules clear enough
that stopping is easy, and who answers the question instead of asking the
agent to guess.
