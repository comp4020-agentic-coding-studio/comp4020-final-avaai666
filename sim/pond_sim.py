"""Common Pool parameter check (design v0.2). Run: python3 pond_sim.py
Model: logistic growth with a strong Allee threshold A.
  dS/dt = r * S * (S/A - 1) * (1 - S/K)
One tap = 1 fish, at most one tap per second per net (60 fish/min).
Simulated players tap with probability p each second. Real people tap in bursts,
so these are tested scenarios, not guarantees. Replace p with tap rates measured
in playtests (from the ledger) and run again."""
import math, random
K, A, R, MAX_PER_MIN = 300.0, 30.0, 0.2377, 60

def f(S): return R*S*(S/A-1)*(1-S/K)
def rk4(S, dt):
    k1=f(S);k2=f(S+dt*k1/2);k3=f(S+dt*k2/2);k4=f(S+dt*k3)
    return max(0.0, S+dt*(k1+2*k2+2*k3+k4)/6)
def peak(): return max(f(A+i*(K-A)/4000) for i in range(4001))
def run(n, p, minutes=30, seed=0, S0=K):
    rng=random.Random(seed); S=S0
    for sec in range(minutes*60):
        S=rk4(S,1/60)
        for _ in range(n):
            if rng.random()<p and math.floor(S)>=1: S-=1
        if S<1: return (sec+1)/60
    return None
def line(label,t,minutes): return f"  {label}: " + (f"alive after {minutes} min" if t is None else f"collapse at {t:.1f} min")
def batch(n,p,minutes=60):
    d=sorted(t for t in (run(n,p,minutes,seed=s) for s in range(30)) if t)
    return f"  {n} nets at {int(round(p*100))}% of max ({n*p*60:.0f}/min in total): collapsed in {len(d)}/30 seeded runs within {minutes} min" + (f", median {d[len(d)//2]:.1f} min" if d else "")

G=peak()
print(f"K={K:.0f}  A={A:.0f}  r={R}/min  peak regrowth G={G:.1f}/min  one net at max={MAX_PER_MIN}/min")
print(f"Parameter check: one net at max < G < two nets at max?  {MAX_PER_MIN} < {G:.0f} < {2*MAX_PER_MIN}: {MAX_PER_MIN < G < 2*MAX_PER_MIN}")
print("\nFrom a full pond, every net at max:")
for n in range(1,5): print(line(f"{n} net(s)", run(n,1.0), 30))
print("\nFrom a partly drained pond, ONE net at max (a single person CAN finish off a weakened pond):")
for frac in [0.5,0.25]: print(line(f"start at {int(frac*100)}% full", run(1,1.0,60,S0=K*frac), 60))
print("\nMixed intensity (30 seeded runs each, 60 min):")
for n,ps in [(2,[0.7,0.75,0.8,0.9]),(4,[0.35,0.4,0.5]),(12,[0.1,0.12,0.15])]:
    for p in ps: print(batch(n,p))
S=0.95*A
for m in range(24*60):
    S=rk4(S,1)
    if S<1: print(f"\nFrom 0.95A with nobody fishing: stock falls below 1 after {m+1} min"); break
S=1.05*A
for m in range(24*60): S=rk4(S,1)
print(f"From 1.05A with nobody fishing: {S:.0f} fish after 24 h")
S=1.5*A; t=0
while S<0.9*K: S=rk4(S,1/60); t+=1/60
print(f"Recovery from 1.5A to 0.9K with nobody fishing: {t:.1f} min")
