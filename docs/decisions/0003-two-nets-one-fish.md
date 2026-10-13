# 3. Two nets on the same fish: the net thrown first takes it

Date: 2026-10-13
Status: accepted for crit 9

## Context

Several people fish one lake at once, and they aim at the same schools. A net
lands where it is thrown and closes 0.6 seconds later; every fish inside its
ring at that moment is caught. Two families often throw at the same school
within a second of each other, so their rings overlap and both close on some
of the same fish.

What good means here (`README.md`) puts two things at stake. The dilemma has
to be felt: other people's fishing has to change what you can catch, and you
have to be able to see that it did. And the record has to be honest: one fish
is caught once, by one family, and anyone can check it afterwards by replaying
the season from its ledger.

The server runs the lake in steps of 0.1 s. A throw is applied at the next
step the lake runs, in the order the server accepted it (`DESIGN.md`, Nets).

## Options

1. **The net thrown first takes the shared fish.** The other net closes on
   what is left, and its family is told who got there first.
2. **Split the shared fish** between the nets, rounding by some rule.
3. **The net whose centre is nearest takes each fish.** Skill decides, not
   speed.
4. **Both nets catch it.** A fish is counted twice.
5. **A random draw** decides each shared fish.

## Decision

Option 1. Nets that close in the same step take fish in the order they were
thrown, which is the order of their ledger rows. The haul row of the net that
came second records the seat of the family that took fish under it first
(`rival`), and that family's name is what the player sees on an empty or thin
net: "Jin got there first".

## Why

- It is what the people at the table see: the first net hits the water first.
  The explanation on the second net turns a confusing empty net into the
  point of the game: someone else took those fish.
- It never counts a fish twice (option 4 breaks the honest record and the
  simulations that the dilemma rests on).
- It replays exactly: the ledger order is the order. Option 5 would need a
  draw for every shared fish; option 2 needs a rounding rule people cannot
  see; option 3 needs every fish's distance to two centres, explained on
  screen, for a difference nobody can aim that precisely.

## What it costs

- Speed counts. A family on a slow connection reaches the server later and
  loses ties it would have won at the table. Over a phone on a good network
  the difference is tens of milliseconds, against a 0.6 s sink time; on a bad
  connection it can be a lost school. We accept it and do not hide it: the
  empty net says who got there first.
- The second family can feel cheated even when the rule is fair. Telling them
  why is part of the decision, not an extra.
- A family that throws first gets no skill reward for aiming better; option 3
  would have given one.

## How it is checked

`spec/unit/lake-runner.test.ts`, "two nets on the same fish: the one thrown
first takes it, the other is told who got there first". Reversing the order
in which a step's throws are applied turns it red (shown in session 10).
