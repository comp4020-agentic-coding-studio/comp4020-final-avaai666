# Quick Catch: the rules (boat-sim 0.1, experimental)

The question every trip asks: **fish a little more, or go home now?**

**Who and how long.** Two to four boats on one lake, two minutes. People take
the first boats; the room may fill empty boats with bots (they are labelled
BOT). Anyone in the room can start; everyone sees a three-second countdown.

**How you win, said before you start.** The most fish *unloaded at your own
dock* when the horn sounds. Fish still aboard at the horn count for nothing.
Nothing else is scored, and nothing is added at the end.

**Sail.** Tap or drag on the water (or WASD): your boat heads there. A full
hold makes it up to 35% slower.

**Cast** (Space, or CAST). Your net lands 40 units ahead of your bow and
closes 0.6 s later. Grown fish inside go into your hold; fry slip through the
mesh. The hold carries 10. When it is full, a cast catches nothing and says
so. You can cast again after 0.9 s.

**Home.** Sail into your own dock (the ring in your colour) and the hold
unloads, one fish every 0.12 s. Each unloaded fish is yours for good; your
house grows at 10, 25, 45, 70 and 100.

**Dash** (Shift, or DASH). 0.4 s at 2.6 times your speed, then 4 s to recover.
Dash into a boat and **at most 3 fish** spill from its hold (the golden carp
first) and float for 8 s; anyone can scoop them by sailing over them. A boat
that was hit is stunned 0.6 s and **shielded for 3 s**. **No ram counts within
95 units of any dock**, so nobody can guard a port. A ram never touches fish
already unloaded. Boats otherwise pass through each other.

**The golden carp** appears now and then for 10 s, swimming away from boats.
Net it and it is worth 5, once it is home.

**The lake is shared, and nothing refills it.** Fish school, and two grown
fish that meet sometimes spawn two fry, less often the fuller the lake. Fry
grow up after 20 s. Fish you catch are gone; spilled fish that nobody scoops
swim back into the lake. With four busy boats, a lake of 220 fish falls to
about 100 in two minutes (seeded bot runs). No storm, no hidden penalty, no
fish added to keep a game exciting.

**Who decides.** The server runs the lake 20 times a second and decides every
catch, ram, pick-up and score. A browser only sends wishes (steer here, cast,
dash) and draws what it is sent ten times a second. A match is its seed plus
the inputs it applied, stored in that order; replaying them gives the same
match (spec/unit/boat-sim.test.ts).

**Two nets on the same fish** close in the order they were cast, and the
first takes the fish (docs/decisions/0003-two-nets-one-fish.md).

**A server restart** ends a running match as "interrupted" and returns the room
to its lobby; players keep their seats. A two-minute race is not resumed.

All numbers are starting points for playtests, not findings.
