"""Funnel maths behind the written answers (Parts 1, 2 and 4).

Every number quoted in docs/answers.md comes from this script.
Run:  python analysis/funnel_analysis.py
No dependencies beyond the standard library.
"""

from math import erf, sqrt

# --- Data given in the brief (last 30 days) -------------------------------
FUNNEL = [
    ("Profiles shared", 1000),
    ("Profiles accepted", 310),
    ("Contact details shared", 210),
    ("Conversations started", 150),
    ("Meetings fixed", 75),
    ("Meetings completed", 42),
]
ACCEPT_RATE_A = 0.44
ACCEPT_RATE_B = 0.21
AVOIDABLE_SHARE_OF_REJECTIONS = 0.35
SEARCH_HOURS_PER_CLIENT_PER_WEEK = 2

# --- Assumptions (not in the brief; stated in the write-up) ---------------
ASSUMED_ACTIVE_CLIENTS = 100  # client count is not given
WEEKS_PER_MONTH = 30 / 7


def pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def section(title: str) -> None:
    print(f"\n{title}\n{'-' * len(title)}")


def funnel_table() -> None:
    section("1. Funnel conversion")
    top = FUNNEL[0][1]
    print(f"{'Stage':<24}{'Count':>7}{'Step conv.':>12}{'Of shared':>11}{'Lost':>7}")
    prev = None
    for stage, n in FUNNEL:
        step = pct(n / prev) if prev else "-"
        lost = str(prev - n) if prev else "-"
        print(f"{stage:<24}{n:>7}{step:>12}{pct(n / top):>11}{lost:>7}")
        prev = n


def avoidable_rejections() -> dict:
    section("2. Avoidable rejections (rejected for a reason already in stated preferences)")
    shared, accepted = FUNNEL[0][1], FUNNEL[1][1]
    rejected = shared - accepted
    avoidable = AVOIDABLE_SHARE_OF_REJECTIONS * rejected
    clean_shared = shared - avoidable
    clean_accept_rate = accepted / clean_shared
    print(f"Rejected profiles:                     {rejected}")
    print(f"Avoidable rejections (35%):            {avoidable:.1f}  (~{round(avoidable)})")
    print(f"Avoidable as % of ALL profiles shared: {pct(avoidable / shared)}")
    print(f"Acceptance rate excluding avoidable:   {accepted}/{clean_shared:.0f} = {pct(clean_accept_rate)}")
    return {"avoidable": avoidable, "clean_accept_rate": clean_accept_rate}


def matchmaker_mix() -> None:
    section("3. Matchmaker A vs B (assumes A and B share all 1,000 profiles)")
    shared, accepted = FUNNEL[0][1], FUNNEL[1][1]
    overall = accepted / shared
    share_a = (overall - ACCEPT_RATE_B) / (ACCEPT_RATE_A - ACCEPT_RATE_B)
    sent_a, sent_b = share_a * shared, (1 - share_a) * shared
    print(f"Implied share of profiles sent by A:   {pct(share_a)}  (~{sent_a:.0f} profiles)")
    print(f"Implied share of profiles sent by B:   {pct(1 - share_a)}  (~{sent_b:.0f} profiles)")
    print(f"Accepted: A ~{sent_a * ACCEPT_RATE_A:.0f}, B ~{sent_b * ACCEPT_RATE_B:.0f}")
    b_at_a_rate = sent_a * ACCEPT_RATE_A + sent_b * ACCEPT_RATE_A
    print(f"If B accepted at A's rate:             {b_at_a_rate:.0f} accepted (+{b_at_a_rate - accepted:.0f})")
    print("=> The lower-performing matchmaker sends MORE profiles, not fewer.")


def projected_impact(clean_accept_rate: float, avoidable: float) -> None:
    section("4. Projected impact of removing avoidable rejections")
    shared, accepted, completed = FUNNEL[0][1], FUNNEL[1][1], FUNNEL[-1][1]
    completed_per_accept = completed / accepted
    print(f"Meetings completed per accepted profile today: {pct(completed_per_accept)}")
    scenarios = [
        ("Replacements accept like today's non-avoidable profiles", clean_accept_rate),
        ("Conservative: replacements accept at today's average", accepted / shared),
    ]
    for label, rate in scenarios:
        new_accepted = (shared - avoidable) * clean_accept_rate + avoidable * rate
        new_completed = new_accepted * completed_per_accept
        print(f"{label}:")
        print(f"   accepted {accepted} -> {new_accepted:.0f} ({pct(new_accepted / shared)} acceptance), "
              f"meetings completed {completed} -> {new_completed:.0f} (+{new_completed - completed:.0f}/month)")


def matchmaker_time(avoidable: float) -> None:
    section(f"5. Matchmaker time (ASSUMES {ASSUMED_ACTIVE_CLIENTS} active clients)")
    shared, completed = FUNNEL[0][1], FUNNEL[-1][1]
    hours = SEARCH_HOURS_PER_CLIENT_PER_WEEK * ASSUMED_ACTIVE_CLIENTS * WEEKS_PER_MONTH
    per_profile_min = hours * 60 / shared
    print(f"Search hours per month:                {hours:.0f}")
    print(f"Search minutes per profile shared:     {per_profile_min:.0f}")
    print(f"Search hours per completed meeting:    {hours / completed:.1f}")
    print(f"Meetings completed per search-hour:    {completed / hours:.3f}")
    print(f"Search hours spent on avoidable sends: {avoidable * per_profile_min / 60:.0f}")


def two_week_power() -> None:
    section("6. Can two weeks of data detect a change? (Part 4)")
    shared, accepted, completed = FUNNEL[0][1], FUNNEL[1][1], FUNNEL[-1][1]
    n_base, p_base = shared, accepted / shared
    n_two_weeks = round(shared * 14 / 30)
    p_new = p_base + 0.05
    se = sqrt(p_base * (1 - p_base) / n_base + p_new * (1 - p_new) / n_two_weeks)
    z = (p_new - p_base) / se
    p_value = 2 * (1 - 0.5 * (1 + erf(z / sqrt(2))))
    print(f"Profiles shared in two weeks:          ~{n_two_weeks}")
    print(f"Acceptance +5pp ({pct(p_base)} -> {pct(p_new)}): z = {z:.2f}, two-sided p = {p_value:.3f}")
    meetings_2w = completed * 14 / 30
    print(f"Meetings completed in two weeks:       ~{meetings_2w:.0f} (Poisson noise +/- {sqrt(meetings_2w):.1f})")
    avoid_base = AVOIDABLE_SHARE_OF_REJECTIONS * (shared - accepted) / shared
    target = 0.05
    se_av = sqrt(avoid_base * (1 - avoid_base) / n_base + target * (1 - target) / n_two_weeks)
    print(f"Avoidable rate {pct(avoid_base)} -> {pct(target)}: z = {(avoid_base - target) / se_av:.1f} "
          f"(detectable within two weeks)")


if __name__ == "__main__":
    funnel_table()
    result = avoidable_rejections()
    matchmaker_mix()
    projected_impact(result["clean_accept_rate"], result["avoidable"])
    matchmaker_time(result["avoidable"])
    two_week_power()
