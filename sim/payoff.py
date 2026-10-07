"""Is the fine net a social dilemma? Payoff per family after paying for the net. Run: python3 sim/payoff.py"""
import os
src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"game_sim.py")).read().split("def table")[0]; exec(src)
COST=20
def avg(nets,r=0.45,n=40):
    tot=[0]*len(nets)
    for s in range(n):
        c=run(nets,r,seed=s)["caught"]
        for i in range(len(nets)): tot[i]+=c[i]
    return [round(x/n - (COST if nets[i]==8 else 0)) for i,x in enumerate(tot)]
print("net payoff per family after paying", COST, "fish for a big net (r=0.45, 4 families, 40 runs)")
for nets in [[3,3,3,3],[8,3,3,3],[8,8,3,3],[8,8,8,3],[8,8,8,8]]:
    print(f"  {['big' if x==8 else 'small' for x in nets]}: {avg(nets)}")
print("\nThe question each family faces: switch from small to big, given what the others do?")
for k in range(4):
    before=[8]*k+[3]*(4-k); after=[8]*(k+1)+[3]*(3-k)
    b=avg(before)[-1]; a=avg(after)[k]
    print(f"  {k} others already big: stay small -> {b}, switch to big -> {a}  ({'switching pays' if a>b else 'switching does not pay'})")
