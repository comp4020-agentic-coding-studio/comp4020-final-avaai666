"""Next Year, No Fish: parameter check for the game. Run: python3 sim/game_sim.py
Allee-logistic lake; each throw catches c*S/K fish on average (catch per unit effort).
Throws every 2.5 s, 85% of opportunities taken; 6 years of 45 s fishing + 15 s meeting; K = 75 per family."""
# Game model: Allee-logistic lake, catch per throw proportional to density (CPUE, Schaefer-style).
import math, random
def run(nets, r, years=6, fish_s=45, meet_s=15, throw_s=2.5, p=0.85, Kper=75, quota=None, seed=0):
    n=len(nets); K=Kper*n; A=0.1*K
    g=lambda S: r*S*(S/A-1)*(1-S/K)
    rng=random.Random(seed); S=float(K); t=0; caught=[0]*n; hist=[]
    next_throw=[rng.random()*throw_s for _ in range(n)]
    dt=0.1
    for y in range(years):
        yc=[0]*n
        for phase,dur in (("fish",fish_s),("meet",meet_s)):
            steps=int(dur/dt)
            for k in range(steps):
                # RK-ish growth
                S=max(0.0,S+dt/60*g(S))
                if phase=="fish":
                    for i,c in enumerate(nets):
                        next_throw[i]-=dt
                        if next_throw[i]<=0:
                            next_throw[i]=throw_s
                            if rng.random()>p: continue
                            if quota and yc[i]>=quota: continue
                            exp=c*S/K
                            got=int(exp)+(1 if rng.random()<exp-int(exp) else 0)
                            got=min(got,int(S))
                            S-=got; caught[i]+=got; yc[i]+=got
                if S<1: return dict(dead_year=y+1, caught=caught, hist=hist+[0])
        hist.append(round(S))
    return dict(dead_year=None, caught=caught, hist=hist)

def table(r):
    print(f"\n=== r={r}/min, 4 families, K=300, A=30, throw every 2.5 s, 85% of throws, 6 years of 45 s fishing + 15 s meeting")
    for name,nets in [("4 small",[3,3,3,3]),("1 big",[8,3,3,3]),("2 big",[8,8,3,3]),("3 big",[8,8,8,3]),("4 big",[8,8,8,8])]:
        res=[run(nets,r,seed=s) for s in range(20)]
        dead=[x["dead_year"] for x in res if x["dead_year"]]
        tot=sum(sum(x["caught"]) for x in res)/20
        h=res[0]["hist"]
        print(f"  {name:8s}: died {len(dead)}/20" + (f" (median year {sorted(dead)[len(dead)//2]})" if dead else "") + f" | table total {tot:.0f} fish | stock by year (seed0) {h}")
    # 2 families (markers) 
    for name,nets in [("2 small",[3,3]),("1 big 1 small",[8,3]),("2 big",[8,8])]:
        res=[run(nets,r,seed=s) for s in range(20)]
        dead=[x["dead_year"] for x in res if x["dead_year"]]
        print(f"  2 fam {name:14s}: died {len(dead)}/20" + (f" (median year {sorted(dead)[len(dead)//2]})" if dead else "") + f" | stock {res[0]['hist']}")
for r in [0.45,0.55,0.65]: table(r)
