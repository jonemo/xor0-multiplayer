# Xor0 — Gameplay Instructions for an AI Agent

A precise, machine-oriented specification for an autonomous agent playing Xor0.
Where the human rules rely on perception ("spot the pattern," "spatial thinking"),
this document replaces them with the single exact rule that defines a valid play.

---

## 1. Objective

Collect more cards than any other player. When the deck runs out, the player holding
the **most cards** wins. Ties are broken by the **most dots** collected.

The entire game reduces to one repeated action: scan the face-up cards, find a subset
whose dots fully cancel, and claim it before anyone else does.

---

## 2. The deck and how to encode a card

There are six dot colors, each permanently mapped to a power of two:

| Color  | Value |
|--------|-------|
| orange | 1     |
| blue   | 2     |
| green  | 4     |
| yellow | 8     |
| teal   | 16    |
| red    | 32    |

Each card carries a **subset** of these six dots — every dot at most once. Therefore a
card is exactly a 6-bit integer in the range 1–63, where bit *k* is set if the card
shows that color. The card's printed number (the sum of its dot values) **is** that
integer.

> Example: a card with orange + blue + teal = `1 + 2 + 16 = 19` → binary `010011`.

The full deck is every non-empty subset of the six colors, so 2⁶ − 1 = **63 cards, all
distinct**. There are no duplicates and no blank card. This single fact has a
consequence the agent must internalize (see §4).

**Perception requirement:** the agent must convert each face-up card into its integer
value. Read the dots (or the printed sum) and OR the corresponding bits together.

---

## 3. The one rule that defines a valid group

A set of face-up cards is a **Xor0 group** if and only if the bitwise XOR of their
values equals zero:

```
value(c1) XOR value(c2) XOR ... XOR value(cn) == 0
```

The three "methods" on the box are all the same test stated three ways:

- **Count dots** — every color appears an even number of times across the group.
- **Cancel in pairs** — overlay the cards; every dot pairs off with a same-color dot.
- **Arithmetic** — XOR the card numbers; result is 0.

These are mathematically identical. XOR equals zero on a given bit exactly when that
color's dot count is even. The agent should use the **XOR test** as its source of
truth; it is exact, O(n), and never ambiguous.

---

## 4. Minimum and maximum group size

- **Minimum group size is 3.** A one-card group is impossible (no empty card exists). A
  two-card group would require two identical cards, but the deck has none. So never
  announce a pair — it can never be valid.
- **Maximum group size is the number of cards on the table** (4–7 depending on
  difficulty), if they happen to XOR to zero.

---

## 5. Game state the agent maintains

```
table          : list of integer card values currently face up
deck_remaining : count of cards still in the draw pile (may be hidden/estimated)
my_cards       : list of card values I have collected
my_dots        : running count of dots I have collected (popcount of my_cards)
opponents      : per-player card counts (for live standings, if observable)
status         : ACTIVE or PAUSED   (see §7 penalty)
```

Update `table` after every claim and every replenishment.

---

## 6. Decision procedure (each scan)

The table holds at most 7 cards, so an exhaustive search is trivial and optimal — there
is no need for heuristics.

1. Enumerate all subsets of `table` of size ≥ 3.
2. Keep those whose XOR == 0. These are the valid groups currently on the table.
3. If none exist, take no action; wait for the table to change, then rescan.
4. If one or more exist, **select the group with the most cards**; break ties by the
   **most total dots** (popcount). This maximizes both your primary score (card count)
   and your tiebreaker (dots), and removes the most cards from opponents' reach.
5. Announce and claim (see §7).

### Reference pseudocode

```python
from itertools import combinations

def popcount(x): return bin(x).count("1")

def best_group(table):
    best = None  # (num_cards, total_dots, group)
    for r in range(3, len(table) + 1):
        for combo in combinations(table, r):
            x = 0
            for v in combo: x ^= v
            if x == 0:
                key = (len(combo), sum(popcount(v) for v in combo))
                if best is None or key > best[:2]:
                    best = (key[0], key[1], combo)
    return best[2] if best else None   # None => no valid group right now
```

For larger tables (not needed here, but if a variant scales up), a Xor-zero subset
exists iff the card vectors are **linearly dependent over GF(2)**; Gaussian elimination
finds one in O(n·bits) instead of enumerating subsets.

---

## 7. Action protocol and the penalty rule

- **Verify before announcing.** Only announce a group that your XOR test has confirmed
  equals zero. Never announce a guess.
- To claim, announce **"XORO!"** and take the group's cards.
- If a claim is correct: move those cards into `my_cards`, then the table is replenished
  from the deck back up to its starting count.
- **Penalty for a wrong claim:** the player pauses and sits out until some other valid
  group is found and claimed; they rejoin for the next group. Because step §6 only ever
  selects a verified zero-XOR group, a correctly implemented agent never incurs this
  penalty. The penalty exists to punish reckless speed, so do not trade correctness for
  reaction time.
- In multiplayer, **speed is the only competitive axis** — every agent that searches
  exhaustively will agree on which groups are valid, so whoever announces a verified
  group first wins it. Find the group, confirm it, claim immediately.

---

## 8. Difficulty configurations

Difficulty is set by removing the highest-value dots from the deck (equivalently,
removing high color bits) and adjusting how many cards start face up:

| Level  | Dots removed (values) | Active colors / bits | Deck size | Cards on table |
|--------|-----------------------|----------------------|-----------|----------------|
| Easy   | 32, 16, 8             | 1, 2, 4              | 7         | 4              |
| Medium | 32, 16                | 1, 2, 4, 8           | 15        | 5              |
| Normal | 32                    | 1, 2, 4, 8, 16       | 31        | 6              |
| Master | none (full deck)      | 1, 2, 4, 8, 16, 32   | 63        | 7              |

The XOR rule and the decision procedure are identical across all levels; only the bit
width and table size change.

---

## 9. Turn loop

```
1. Set up the table to the configured count of face-up cards.
2. Loop:
     a. Read table → integer values.
     b. group = best_group(table)
     c. If group is not None and status == ACTIVE:
          announce "XORO!"; collect group; update my_cards, my_dots.
          Replenish table from deck to the starting count.
     d. If the deck is empty when the last card is drawn, the game ends immediately.
3. Compare card counts. Most cards wins; ties broken by most dots.
```

A scan that yields no group is normal — the table changes only when cards are claimed
and replenished, so rescan after every table change, not in a busy loop.

---

## 10. Worked examples

Colors → values: orange 1, blue 2, green 4, yellow 8, teal 16, red 32.

**Valid (XORO):**

| Card | Dots               | Value | Binary  |
|------|--------------------|-------|---------|
| A    | orange + blue      | 3     | 000011  |
| B    | blue + green       | 6     | 000110  |
| C    | orange + green     | 5     | 000101  |

XOR: `3 ⊕ 6 ⊕ 5 = 0`. Check by color: orange in {A,C} = 2×, blue in {A,B} = 2×, green
in {B,C} = 2×. All even → valid 3-card group.

**Invalid (not a group):**

| Card | Dots          | Value |
|------|---------------|-------|
| A    | orange + blue | 3     |
| B    | blue + green  | 6     |
| D    | teal          | 16    |

XOR: `3 ⊕ 6 ⊕ 16 = 21 ≠ 0`. Orange appears once and teal appears once (both odd) → not a
group. Do not announce.

**Multiple groups on the table:** if both a 3-card group and a 5-card group are valid,
claim the 5-card group — more cards scored, more dots banked, fewer cards left for
opponents.

---

## 11. One-paragraph summary

Encode each card as a 6-bit integer (its dot-sum). A valid play is any set of three or
more face-up cards whose values XOR to zero — equivalently, every color appears an even
number of times. Search all subsets of the (≤7-card) table, pick the verified zero-XOR
group with the most cards, break ties by most dots, announce "XORO!", collect, and let
the table replenish. Never announce an unverified group. When the deck empties, the most
cards wins; ties go to the most dots.
