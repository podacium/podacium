# ADR-008: Dual-Instrument Wallet and Capability Gating

## Status

Proposed — 2026-10-21. Requires sign-off before any `prisma/schema.prisma` change.

## Context

Podacium's wallet is deliberately non-custodial. `FINANCIAL_MODE` defaults to `NON_CUSTODIAL`
(`services/api/app/core/config.py`) and the custodial surface hard-fails: `POST /wallets/deposit`
and `POST /wallets/transfer` return 403, and `payouts.router` is only mounted when the mode is
`LICENSED_PSP` (`app/routes.py`). `Payout` and `EscrowHold` exist in the schema and are annotated
as reserved for future licensed operations under Bank of Algeria Regulation 25-02.

The product requirement is to grow this into a wallet that feels like a real one — stable wallet
identifiers, transparent point balances, statements, peer gifting, and eventually DZD balances —
while launching immediately without performing a regulated activity. The current design cannot
express that end state for three reasons:

1. **`FINANCIAL_MODE` is a single global enum.** It is binary, so it cannot represent the state we
   actually want at launch: points fully live _and_ fiat available through a licensed partner.
2. **It carries no operating entity.** Which legal person performs an activity is a regulatory
   fact (own PSP agrément vs. acting as a technical service provider for a licensed PSP vs. no
   regulated activity at all). A boolean cannot record it, and therefore cannot be audited.
3. **Instrument and custody are conflated.** `Wallet.podaPoints` is a single mutable integer with
   `currency = "PODAPOINT"`. Any future DZD balance would either overload that field or require a
   parallel wallet object, both of which invite an implicit points-to-cash conversion path — the
   exact line that turns a loyalty programme into unlicensed e-money.

Separately, the wallet audit (`W-01`…`W-18`) established that balances are trusted without a
derived ledger, that expiry is not attributable to individual grants, and that idempotency is
implemented per endpoint rather than as a wallet-level invariant.

Regulation 25-02 (14 April 2025), issued under Law 23-09, sets the authorisation and accreditation
conditions for payment service providers in Algeria, including a reported minimum paid-up capital
of DZD 160,000,000 and safeguarding/KYC obligations (completed by Instruction 06-2025 and related
instructions). Holding client balances in DZD is a licensed activity; a closed-loop loyalty credit
redeemable only for the issuer's own services generally is not, provided it cannot be cashed out.

## Decision

Adopt a **dual-instrument wallet with capability gating per operating entity**.

One wallet identity owns one or more _accounts_, each carrying exactly one instrument. Capabilities
(what the platform may do, and for which entity) are granted as data, not compiled as a global
mode. Points are live from day one; fiat capabilities remain disabled until an entity holds either
a partner arrangement or its own licence.

Crypto assets, stablecoins, and tokenised deposits are explicitly out of scope: they would
introduce a third regulatory regime and are not needed for any capability above.

### 1. Identity, accounts, instruments

```
Wallet (identity: accountNumber, handle, owner)
  ├── WalletAccount[POINTS, "PODAPOINT"]   live today, closed-loop
  └── WalletAccount[FIAT,   "DZD"]         exists, disabled until granted
```

`Wallet.accountNumber` is a stable, checksummed public identifier (`PODA-XXXX-XXXX-CC`). It is a
label, not keyspace, and must not be derived from `Wallet.id`.

### 2. Capabilities per operating entity

```prisma
enum CustodyStatus { NONE PARTNER LICENSED }
enum Instrument    { POINTS FIAT }
enum LotOrigin     { EARNED PURCHASED BONUS REFUND }

model OperatingEntity {
  id               Int           @id @default(autoincrement())
  code             String        @unique   // DZ-PODACIUM | DZ-PSP-PARTNER
  country          String
  custodyStatus    CustodyStatus @default(NONE)
  licenceRef       String?                 // Bank of Algeria agrément, when one exists
  safeguardingAcct String?                 // segregated client-funds account
  createdAt        DateTime      @default(now())
}

model CapabilityGrant {
  id         Int     @id @default(autoincrement())
  entityId   Int
  capability String                       // "points.spend", "fiat.deposit", …
  enabled    Boolean @default(false)
  entity     OperatingEntity @relation(fields: [entityId], references: [id])
  @@unique([entityId, capability])
}
```

`FINANCIAL_MODE` is retained for backward compatibility but becomes a **derived default**: it
seeds `CapabilityGrant` rows and is no longer consulted by feature code. Deprecated in a follow-up
once the grants are seeded in every environment.

### 3. Two invariants that make the split real

Both are enforced in the service layer, not only in routers, and both are covered by tests:

- **INV-1 — no implicit conversion.** A movement between instruments is rejected unless an enabled
  `ConversionRule` with a non-empty `legalBasis` exists. Points can never become DZD by default,
  whatever endpoint is called.
- **INV-2 — no fiat without an entity.** A `FIAT` account may not be created or credited unless its
  `OperatingEntity.custodyStatus` is `PARTNER` or `LICENSED`. A user wallet alone can never hold
  DZD.

### 4. Points lots carry provenance (transparency _is_ the firewall)

```prisma
model PointsLot {
  id           Int       @id @default(autoincrement())
  walletId     Int
  sourceTxId   Int?
  granted      Int
  remaining    Int
  origin       LotOrigin
  expiresAt    DateTime?
  transferable Boolean   @default(false)   // EARNED → true, PURCHASED → false
  @@index([walletId, expiresAt])
}
```

Consumption is FIFO across lots. Expiry decrements `remaining` on the specific lot rather than
subtracting an arbitrary amount from the wallet balance, which makes every expiry attributable and
displayable.

Only `EARNED` (and `BONUS`/`REFUND`, per policy) lots are transferable. Purchased points are
spendable on Podacium services and nothing else. This keeps peer gifting a loyalty feature rather
than a remittance-like service, and it is the same field that powers the user-facing statement
("120 earned points, expiring 12 Mar").

Redemption is restricted to a server-side catalogue of SKUs. "Points buy Podacium things" is then
provable from configuration, not only asserted in the terms of service.

### 5. Ledger

The audit work established that `Wallet.podaPoints` is currently the source of truth. This ADR
promotes the journal to primary and demotes balances to caches:

- `LedgerAccount` — `USER:<id>`, `PLATFORM_REVENUE`, `ESCROW`, `EXPIRED`, `FEES`, `SAFEGUARDING:<entity>`.
- `LedgerEntry` — `batchId`, `accountId`, `debit`, `credit`, `currency`, `refType`, `refId`.
- `WalletAccount.balanceMinor` is a cache; a nightly reconciliation job asserts
  `SUM(entries) == balance` per account and alerts on drift.
- Corrections are appended (`WalletTransaction.reversalOfId`), never applied as edits.
- Idempotency is a wallet-level unique key, checked inside the same transaction as the mutation
  (the pattern already used by `POST /wallets/admin/{id}/adjust`).
- An `OutboxEvent` row is written in the same transaction as any ledger movement, so notifications
  and downstream effects cannot diverge from the commit.

Amounts are integers in the smallest unit (`DZD` in centimes, points as whole units) and every
amount carries an explicit `currency`. No floats, ever.

### 6. Partner mode as the legal bridge to DZD

The fastest path to a DZD experience without Podacium holding funds is a licensed PSP/EMI partner:

```prisma
model ExternalAccount {
  id          Int    @id @default(autoincrement())
  walletId    Int
  provider    String            // partner PSP code
  externalRef String @unique
  currency    String
  // The partner is authoritative; Podacium mirrors and reconciles.
}
```

The partner holds the float and performs KYC; Podacium is a technical service provider. The wallet
displays the mirrored balance, records its own side of every movement, and reconciles against the
partner's settlement files. Podacium is not in custody.

The same model supports owning the licence later: create `DZ-PODACIUM` with
`custodyStatus = LICENSED`, attach a `SAFEGUARDING` ledger account, and enable
`fiat.*` grants. No wallet, ledger, or API redesign is required — only the grant, the compliance
workload, and the operating entity's licence reference.

## Capability matrix

| Capability                       | Launch | Partner PSP |    Own licence     |
| -------------------------------- | :----: | :---------: | :----------------: |
| `points.earn` / `points.spend`   |   ✅   |     ✅      |         ✅         |
| `points.transfer` (EARNED only)  |   ✅   |     ✅      |         ✅         |
| `fiat.deposit` / `fiat.withdraw` |   ❌   |     ✅      |         ✅         |
| `fiat.p2p`                       |   ❌   |     ✅      |         ✅         |
| `fiat.merchant_accept`           |   ❌   |     ✅      |         ✅         |
| `card.issue`                     |   ❌   |     ❌      | ❌ (BIN + PCI DSS) |

`card.issue` stays disabled in all three columns: cards require a licensed BIN sponsor, scheme
certification, and PCI DSS v4.0.1 scope control. A co-branded card with an existing issuer is the
only realistic entry point and is tracked outside this ADR.

## API surface

- `GET /wallets/me` — unchanged top-level `poda_points` (backwards compatible) plus an `accounts[]`
  array and `account_number`.
- `GET /wallets/me/capabilities` — what the caller may do, and why not:
  `{"fiat": {"enabled": false, "reason": "requires_partner_or_licence"}}`.
- `POST /wallets/points/transfer` — gated by `points.transfer`; rejects non-transferable lots;
  requires `idempotency_key`; enforces per-user daily limits.
- `GET /wallets/me/lots` — per-lot `granted`/`remaining`/`origin`/`expires_at`.
- `GET /wallets/me/statement?from&to&format=csv|pdf` — running balance, reason codes, receipts.
- `POST /wallets/fiat/*` — returns `409 CAPABILITY_NOT_ENABLED` with a machine-readable body
  (`capability`, `required_entity_status`, `reason`) instead of a bare 403. The existing 403
  behaviour is preserved behind this code for current clients.

The frontend renders wallet features from `/capabilities` rather than hardcoding which mode the
deployment is in.

## Consequences

**Positive**

- Launch needs no licence: points are closed-loop, non-redeemable for cash, and non-transferable
  when purchased.
- Adding DZD later is a configuration and compliance exercise, not a migration of every wallet row.
- The legal boundary is encoded and testable (INV-1, INV-2) rather than a comment in a config file.
- Points transparency (lots, provenance, FIFO expiry) and the transferability firewall share one
  data model, so the feature users ask for is the control compliance needs.
- Balances become derived, which is what makes audit, dispute handling, and reconciliation possible.

**Negative / costs**

- Two concepts (`Wallet` identity vs. `WalletAccount`) instead of one row; more joins and a
  backfill migration.
- `podaPoints` must remain synchronised as a cache during the transition, with a reconciliation
  job as the safety net.
- Capability checks add a dependency and a cache to every money-touching request.
- Running partner mode means two systems of record; reconciliation is mandatory and on-call.

**Risks**

- A future developer enabling `fiat.deposit` "just for a demo" in a `NONE` entity. Mitigated by
  INV-2 failing closed and by a CI test that asserts no fiat grant exists for a `NONE` entity.
- Regulatory characterisation of purchased, transferable points. Mitigated by making purchased
  points non-transferable and redemption catalogue-bound; requires counsel confirmation.
- `FINANCIAL_MODE` drifting out of sync with grants during the transition. Mitigated by deriving
  the enum from grants and a startup consistency check.

## Alternatives considered

| Alternative                                      | Why rejected                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Keep `FINANCIAL_MODE` as the only switch         | Cannot run points-live + fiat-via-partner, and records no legal entity, so it cannot be audited or defended. |
| One `Wallet` row with `points` and `dzd` columns | Invites implicit conversion, makes per-instrument reconciliation and expiry attribution impossible.          |
| Separate PointsWallet and FiatWallet services    | Duplicated transport, auth, idempotency, and statements; two divergent ledger implementations.               |
| Issue DZD balances now and "fix licensing later" | Performs a regulated activity without authorisation; the risk is existential, not a code defect.             |
| Stablecoin / tokenised deposit rails             | Explicitly out of scope per product direction; adds a third regulatory regime.                               |
| Issue cards directly                             | Requires BIN sponsorship, scheme certification, and PCI DSS v4.0.1 scope; disproportionate at this stage.    |

## Implementation phases

| Phase | Work                                                                                                                      | Effort       | Gate                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------ |
| 0     | `OperatingEntity`, `CapabilityGrant`, `require_capability`, `GET /wallets/me/capabilities`, `CAPABILITY_NOT_ENABLED`      | ~1 week      | schema approval          |
| 1     | `Wallet.accountNumber`/`handle`, `WalletAccount` split, `PointsLot` with `origin`, FIFO expiry, `/lots`, statement export | 2–3 weeks    | schema approval          |
| 2     | `LedgerAccount`/`LedgerEntry`, reversals, nightly reconciliation, outbox, wallet-level idempotency                        | 2–3 weeks    | schema approval          |
| 3     | Partner-PSP adapter (read-through balance, webhooks, settlement reconciliation)                                           | 4–6 weeks    | partner agreement        |
| 4     | Own licence: `custodyStatus = LICENSED`, KYC/AML cases, safeguarding operations                                           | business-led | Bank of Algeria agrément |

Each phase is independently shippable. Phase 0 keeps options open; Phase 1 delivers the user-visible
value (wallet number, transparent points, gifting, statements) without any licensing exposure.

## References

- Bank of Algeria, Règlement n° 25-02 du 14 avril 2025 (conditions d'autorisation, d'agrément et
  d'exercice des prestataires de services de paiement) — <https://www.bank-of-algeria.dz/stoodroa/2025/05/REG.N%C2%B025-02.FR_.pdf>
- Journal Officiel n° 28/2025 — <https://www.joradp.dz/FTP/jo-francais/2025/F2025028.pdf>
- Modern Treasury, "Enforcing Immutability in your Double-Entry Ledger" —
  <https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger>
- Modern Treasury, "Closed-Loop Payment Systems vs. Digital Wallets" —
  <https://www.moderntreasury.com/journal/the-difference-between-closed-loop-payment-systems-and-digital-wallets>
- PracHub, "Payment Systems: Ledgers, Idempotency, and Reconciliation" —
  <https://prachub.com/concepts/payment-systems-ledgers-idempotency-and-reconciliation>
- Juniper Research, "Closed, semi-closed and open wallets" —
  <https://www.juniperresearch.com/resources/infographics/understanding-the-three-types-of-digital-wallets-closed-semi-closed-and-open/>
- CFPB, Consumer Financial Protection Circular 2024-07 (rewards programme transparency) —
  <https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2024-07-design-marketing-and-administration-of-credit-card-rewards-programs/>
- CGAP, "Deposit Insurance: The Last Line of Defense for E-Money?" —
  <https://www.cgap.org/blog/deposit-insurance-last-line-of-defense-for-e-money>
- Blindpay, "BIN sponsor vs. issuer-processor vs. program manager" (PCI DSS v4.0.1) —
  <https://blindpay.com/resources/more/bin-sponsor-vs-issuer-processor-vs-program-manager>

## Related records

- ADR-005 (middleware modularisation) — where capability dependencies plug into the request stack.
- Wallet audit findings `W-01`…`W-18` and their tests (`tests/test_wallet.py`,
  `tests/test_poda_points.py`, `tests/test_admin_wallet_adjust.py`,
  `tests/integration/test_wallet_invariants.py`) — the correctness baseline this ADR builds on.
