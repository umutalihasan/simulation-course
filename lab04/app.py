import random
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np



#  SECTION 1: Lehmer random number generator (MCG)
#  From lecture:
#    x_i* = (β · x_{i-1}*) mod M
#    x_i  = x_i* / M
#
#  Parameters (from lecture slide):
#    M  = 2^63     = 9,223,372,036,854,775,808
#    β  = 2^32 + 3 = 4,294,967,299
#    x₀*= β        = 4,294,967,299
#
#  For modulus M = 2^k, maximum period is M/4 = 2^(k-2)
#  when:
#    - β ≡ 3 or 5 (mod 8)
#    - seed is odd
#
#  Here:
#    β = 2^32 + 3 ≡ 3 (mod 8)
#    x₀* = β is odd
#  ⇒ period = 2^61



class MCG:
    M = 2**63
    BETA = 2**32 + 3

    def __init__(self, seed=None):
        if seed is None:
            seed = self.BETA
        if seed % 2 == 0:
            raise ValueError("Seed must be odd")
        self.x = seed

    def next(self):
        self.x = (self.BETA * self.x) % self.M
        return self.x / self.M

    def generate(self, n):
        return [self.next() for _ in range(n)]


def mean(data):
    return sum(data) / len(data)

def variance(data):
    m = mean(data)
    return sum((x - m) ** 2 for x in data) / len(data)


# theoretical values for U(0, 1)
THEORY_MEAN = 0.5
THEORY_VAR  = 1 / 12

N = 100_000

# generate samples
mcg = MCG()
mcg_samples = mcg.generate(N)

random.seed()
builtin_samples = [random.random() for _ in range(N)]

# compute stats
mcg_m = mean(mcg_samples)
mcg_v = variance(mcg_samples)
bi_m  = mean(builtin_samples)
bi_v  = variance(builtin_samples)

print(f"N = {N}\n")
print(f"{'':22} {'Mean':>10}   {'Variance':>10}")
print("-" * 48)
print(f"{'Theoretical':22} {THEORY_MEAN:>10.6f}   {THEORY_VAR:>10.6f}")
print(f"{'MCG':22} {mcg_m:>10.6f}   {mcg_v:>10.6f}")
print(f"{'Python built-in':22} {bi_m:>10.6f}   {bi_v:>10.6f}")

mcg_err_m = abs(mcg_m - THEORY_MEAN)
mcg_err_v = abs(mcg_v - THEORY_VAR)
bi_err_m  = abs(bi_m  - THEORY_MEAN)
bi_err_v  = abs(bi_v  - THEORY_VAR)

print(f"\nErrors vs theoretical:")
print(f"  MCG     mean: {mcg_err_m:.8f}   variance: {mcg_err_v:.8f}")
print(f"  builtin mean: {bi_err_m:.8f}   variance: {bi_err_v:.8f}")

print(f"\nMCG period = M/4 = 2^61 = {MCG.M // 4:,}")
print(f"Period >> N, no repetition in this run")


# series of experiments — see how errors shrink as N grows
sizes = [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 1_000_000]

mcg2   = MCG()
all_mcg = mcg2.generate(max(sizes))
all_bi  = [random.random() for _ in range(max(sizes))]

print(f"\n{'N':>10} | {'MCG mean err':>13} | {'MCG var err':>11} | {'BI mean err':>11} | {'BI var err':>10}")
print("-" * 66)

results = []
for n in sizes:
    s1 = all_mcg[:n]
    s2 = all_bi[:n]
    me1 = abs(mean(s1) - THEORY_MEAN)
    ve1 = abs(variance(s1) - THEORY_VAR)
    me2 = abs(mean(s2) - THEORY_MEAN)
    ve2 = abs(variance(s2) - THEORY_VAR)
    results.append((n, me1, ve1, me2, ve2))
    print(f"{n:>10,} | {me1:>13.8f} | {ve1:>11.8f} | {me2:>11.8f} | {ve2:>10.8f}")

print("\nAs N increases errors shrink — Law of Large Numbers")


# plots
fig = plt.figure(figsize=(16, 12))
fig.suptitle(
    "Lab 4 — MCG (beta=2^32+3, M=2^63) vs Python built-in | N=100,000",
    fontsize=13, fontweight='bold'
)
gs = gridspec.GridSpec(2, 3, figure=fig, hspace=0.4, wspace=0.35)

ax1 = fig.add_subplot(gs[0, 0])
ax1.hist(mcg_samples, bins=50, color='steelblue', edgecolor='white', density=True)
ax1.axhline(1.0, color='red', linestyle='--', linewidth=1.5, label='PDF = 1')
ax1.set_title("MCG histogram")
ax1.set_xlabel("Value")
ax1.set_ylabel("Density")
ax1.legend(fontsize=8)

ax2 = fig.add_subplot(gs[0, 1])
ax2.hist(builtin_samples, bins=50, color='darkorange', edgecolor='white', density=True)
ax2.axhline(1.0, color='red', linestyle='--', linewidth=1.5, label='PDF = 1')
ax2.set_title("Built-in histogram")
ax2.set_xlabel("Value")
ax2.set_ylabel("Density")
ax2.legend(fontsize=8)

ax3 = fig.add_subplot(gs[0, 2])
labels = ['Mean error', 'Variance error']
x = np.arange(len(labels))
w = 0.3
ax3.bar(x - w/2, [mcg_err_m, mcg_err_v], w, label='MCG', color='steelblue', alpha=0.8)
ax3.bar(x + w/2, [bi_err_m,  bi_err_v],  w, label='Built-in', color='darkorange', alpha=0.8)
ax3.set_title("Errors from theoretical")
ax3.set_xticks(x)
ax3.set_xticklabels(labels)
ax3.set_ylabel("Absolute error")
ax3.ticklabel_format(style='scientific', axis='y', scilimits=(0, 0))
ax3.legend(fontsize=8)

ns   = [r[0] for r in results]
me_m = [r[1] for r in results]
ve_m = [r[2] for r in results]
me_b = [r[3] for r in results]
ve_b = [r[4] for r in results]

ax4 = fig.add_subplot(gs[1, 0])
ax4.plot(ns, me_m, 'o-', color='steelblue',  label='MCG')
ax4.plot(ns, me_b, 's-', color='darkorange', label='Built-in')
ax4.set_xscale('log')
ax4.set_yscale('log')
ax4.set_title("Mean error vs N")
ax4.set_xlabel("N")
ax4.set_ylabel("Error")
ax4.legend(fontsize=8)
ax4.grid(True, alpha=0.3)

ax5 = fig.add_subplot(gs[1, 1])
ax5.plot(ns, ve_m, 'o-', color='steelblue',  label='MCG')
ax5.plot(ns, ve_b, 's-', color='darkorange', label='Built-in')
ax5.set_xscale('log')
ax5.set_yscale('log')
ax5.set_title("Variance error vs N")
ax5.set_xlabel("N")
ax5.set_ylabel("Error")
ax5.legend(fontsize=8)
ax5.grid(True, alpha=0.3)

ax6 = fig.add_subplot(gs[1, 2])
k = 2000
ax6.scatter(mcg_samples[:k], mcg_samples[1:k+1], s=1, alpha=0.4, color='steelblue')
ax6.set_title(f"Serial correlation ({k} pts)\nXn vs Xn+1")
ax6.set_xlabel("Xn")
ax6.set_ylabel("Xn+1")

plt.savefig("lab4_results.png", dpi=150, bbox_inches='tight')
print("\nChart saved → lab4_results.png")
plt.show()


# conclusion
print("\n--- CONCLUSION ---\n")
print(f"Theoretical:  mean = {THEORY_MEAN:.6f}   variance = {THEORY_VAR:.6f}")
print(f"MCG:          mean = {mcg_m:.6f}   variance = {mcg_v:.6f}   (errors: {mcg_err_m:.2e}, {mcg_err_v:.2e})")
print(f"Built-in:     mean = {bi_m:.6f}   variance = {bi_v:.6f}   (errors: {bi_err_m:.2e}, {bi_err_v:.2e})")
print(f"""
Both generators produce values close to theoretical U(0,1).
Errors shrink as N grows, which confirms the Law of Large Numbers.

MCG uses only one multiplication and one modulo per value — O(1) time,
O(1) memory. Despite its simplicity it performs comparably to Python's
built-in Mersenne Twister at N=100,000.

MCG is not suitable for cryptography (deterministic, reversible)
and has a shorter period (2^61 vs 2^19937-1), but for simulation
purposes it is fast, accurate, and easy to implement.
""")
