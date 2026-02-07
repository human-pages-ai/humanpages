# Burnable Escrow (Scorched Earth Payment Protection)

**Status:** Planned (Post-Launch)
**Target:** High-value jobs ($200+)
**Chain:** Base (low gas, native USDC)

---

## Overview

A trustless escrow mechanism where the Agent deposits funds into a smart contract. The Human can claim funds after a threshold period unless the Agent "burns" them (sends to dead address). This eliminates profit motive for disputes - an Agent can never get funds back unilaterally, only destroy them.

### Why "Burnable"?

The Agent's only options are:
1. **Do nothing** → Human claims after threshold (default)
2. **Burn** → Funds destroyed (costs Agent gas + entire deposit)

There is no "refund to self" option. This removes any financial incentive to dispute dishonestly.

---

## Game Theory

| Agent Action | Cost to Agent | Outcome |
|--------------|---------------|---------|
| Do nothing | $0 | Human claims at threshold |
| Burn | gas (~$0.02) + entire deposit | Funds destroyed, nobody wins |

**Key insight:** Burning costs the Agent money and gains them nothing. The only rational reason to burn is genuine grievance ("You didn't do the work, so I'll ensure you don't profit").

### Comparison to Other Models

| Model | Agent can profit from lying? | Platform liability? |
|-------|------------------------------|---------------------|
| P2P (current) | Yes (ghost after work) | None |
| Platform Escrow | No | Yes (custody risk) |
| Reality.eth Oracle | No | None (complex) |
| **Burnable Escrow** | No | None (simple) |

---

## Smart Contract Design

### BurnableEscrow.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BurnableEscrow {
    address public payer;       // Agent
    address public payee;       // Human
    IERC20 public token;        // USDC
    uint256 public amount;
    uint256 public claimableAt; // Timestamp when Human can claim
    bool public settled;

    constructor(
        address _payer,
        address _payee,
        address _token,
        uint256 _amount,
        uint256 _claimDelay
    ) {
        payer = _payer;
        payee = _payee;
        token = IERC20(_token);
        amount = _amount;
        claimableAt = block.timestamp + _claimDelay;
    }

    /// @notice Human claims funds after threshold passes
    function claim() external {
        require(msg.sender == payee, "Only payee");
        require(!settled, "Already settled");
        require(block.timestamp >= claimableAt, "Not yet claimable");
        settled = true;
        token.transfer(payee, amount);
    }

    /// @notice Agent burns funds (dispute - mutual destruction)
    function burn() external {
        require(msg.sender == payer, "Only payer");
        require(!settled, "Already settled");
        settled = true;
        token.transfer(0x000000000000000000000000000000000000dEaD, amount);
    }

    /// @notice Human refunds Agent (mutual cancel)
    function refund() external {
        require(msg.sender == payee, "Only payee");
        require(!settled, "Already settled");
        settled = true;
        token.transfer(payer, amount);
    }
}
```

### EscrowFactory.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BurnableEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EscrowFactory {
    event EscrowCreated(
        address indexed escrow,
        address indexed payer,
        address indexed payee,
        address token,
        uint256 amount,
        uint256 claimableAt
    );

    function createEscrow(
        address payee,
        address token,
        uint256 amount,
        uint256 claimDelay
    ) external returns (address) {
        BurnableEscrow escrow = new BurnableEscrow(
            msg.sender,  // payer
            payee,
            token,
            amount,
            claimDelay
        );

        // Transfer funds from payer to escrow
        IERC20(token).transferFrom(msg.sender, address(escrow), amount);

        emit EscrowCreated(
            address(escrow),
            msg.sender,
            payee,
            token,
            amount,
            block.timestamp + claimDelay
        );

        return address(escrow);
    }
}
```

---

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      ESCROW FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Agent creates job offer with escrow option              │
│     POST /api/jobs                                          │
│     { ..., useEscrow: true, claimDelayHours: 72 }          │
│                                                             │
│  2. Human accepts job                                       │
│     - Sees "Payment Protected" badge                        │
│     - Escrow contract address displayed                     │
│                                                             │
│  3. Agent deposits USDC to escrow                           │
│     - Calls factory.createEscrow() on-chain                 │
│     - Backend verifies deposit via event logs               │
│     - Job status → ESCROWED                                 │
│                                                             │
│  4. Human completes work                                    │
│     - Marks job complete in dashboard                       │
│                                                             │
│  5. Threshold passes (e.g., 72 hours)                       │
│     - Human calls escrow.claim() on-chain                   │
│     - Backend verifies claim via event logs                 │
│     - Job status → PAID                                     │
│                                                             │
│  DISPUTE PATH:                                              │
│  5b. Agent burns before threshold                           │
│      - Calls escrow.burn() on-chain                         │
│      - Funds sent to 0xdead                                 │
│      - Job status → DISPUTED                                │
│      - Agent flagged for "burn" behavior                    │
│                                                             │
│  CANCEL PATH:                                               │
│  5c. Human refunds (mutual cancel)                          │
│      - Calls escrow.refund() on-chain                       │
│      - Funds returned to Agent                              │
│      - Job status → CANCELLED                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Gas Costs (Base L2)

| Action | Gas Used | Cost (USD) |
|--------|----------|------------|
| Create escrow (factory) | ~150,000 | $0.10 - $0.30 |
| claim() | ~60,000 | $0.01 - $0.05 |
| burn() | ~60,000 | $0.01 - $0.05 |
| refund() | ~60,000 | $0.01 - $0.05 |

**Total per job:** ~$0.15 - $0.35

**Optimization:** Use CREATE2 clones to reduce deployment to ~$0.05.

---

## Database Schema Changes

```prisma
model Escrow {
  id              String   @id @default(cuid())
  jobId           String   @unique
  contractAddress String   @unique
  factoryAddress  String

  payer           String   // Agent wallet
  payee           String   // Human wallet
  token           String   // USDC address
  amount          Decimal  @db.Decimal(18, 6)

  claimableAt     DateTime

  status          EscrowStatus @default(PENDING)
  settledAt       DateTime?
  settlementTx    String?      // claim/burn/refund tx hash

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  job             Job      @relation(fields: [jobId], references: [id])

  @@index([status])
  @@index([claimableAt])
}

enum EscrowStatus {
  PENDING     // Created, waiting for deposit
  FUNDED      // Agent deposited funds
  CLAIMED     // Human claimed after threshold
  BURNED      // Agent burned (dispute)
  REFUNDED    // Human refunded (mutual cancel)
}
```

Add to Job model:
```prisma
model Job {
  // ... existing fields

  useEscrow       Boolean  @default(false)
  escrow          Escrow?
}
```

---

## API Endpoints

### Create Job with Escrow Option
```
POST /api/jobs
{
  "humanId": "...",
  "agentId": "...",
  "title": "...",
  "priceUsdc": 500,
  "useEscrow": true,
  "claimDelayHours": 72
}

Response:
{
  "id": "job_123",
  "status": "PENDING",
  "escrow": {
    "factoryAddress": "0x...",
    "payee": "0x...",       // Human's wallet
    "amount": "500000000",  // 500 USDC (6 decimals)
    "claimDelaySeconds": 259200
  }
}
```

### Verify Escrow Deposit
```
POST /api/jobs/:id/escrow/verify
{
  "txHash": "0x..."
}

Response:
{
  "status": "FUNDED",
  "contractAddress": "0x...",
  "claimableAt": "2024-01-15T12:00:00Z"
}
```

### Get Escrow Status
```
GET /api/jobs/:id/escrow

Response:
{
  "contractAddress": "0x...",
  "status": "FUNDED",
  "amount": 500,
  "claimableAt": "2024-01-15T12:00:00Z",
  "timeRemaining": 172800  // seconds
}
```

---

## Frontend Changes

### Job Offer (Agent View)
- [ ] "Use Escrow Protection" toggle for jobs > $200
- [ ] Claim delay selector: 24h / 72h / 7 days / 14 days
- [ ] Display estimated gas cost

### Job Card (Human View)
- [ ] "Payment Protected" badge when escrow is funded
- [ ] Escrow contract address (link to BaseScan)
- [ ] Countdown timer to claimable
- [ ] "Claim Payment" button (after threshold)

### Dashboard
- [ ] Escrow status indicators
- [ ] "Funds Secured" vs "Awaiting Deposit" states
- [ ] Dispute/burn notifications

---

## Reputation Impact

When an Agent burns funds:
1. Increment `agent.burnCount`
2. If `burnCount >= 3`: Flag as "High Risk"
3. Display warning to Humans: "This agent has disputed X jobs"

This discourages frivolous burns while allowing legitimate disputes.

---

## Security Considerations

1. **Contract Auditing:** Get the escrow contract audited before mainnet deployment
2. **Reentrancy:** Use OpenZeppelin's ReentrancyGuard
3. **Token Whitelist:** Only allow verified USDC/USDT/DAI addresses
4. **Frontend Verification:** Always verify escrow state on-chain, don't trust backend alone

---

## Implementation Phases

### Phase 1: Contract Deployment
- [ ] Write and test BurnableEscrow.sol
- [ ] Write and test EscrowFactory.sol
- [ ] Deploy factory to Base testnet
- [ ] Deploy factory to Base mainnet

### Phase 2: Backend Integration
- [ ] Add Escrow model to Prisma
- [ ] Add escrow verification endpoints
- [ ] Monitor factory events for deposit/claim/burn
- [ ] Update job status based on escrow state

### Phase 3: Frontend Integration
- [ ] Escrow toggle on job creation
- [ ] Escrow status display
- [ ] Claim button with wallet connection
- [ ] Transaction confirmations

### Phase 4: Polish
- [ ] Gas estimation display
- [ ] Email/Telegram notifications for escrow events
- [ ] Burn reputation tracking
- [ ] Admin dashboard for escrow monitoring

---

## Open Questions

1. **Minimum escrow amount?** Probably $100+ to justify gas costs
2. **Maximum claim delay?** Cap at 30 days?
3. **Partial burns?** Allow Agent to burn X% and release rest?
4. **Multiple payees?** Split payment to multiple Human wallets?

---

## References

- [EIP-20: Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [Base USDC Address](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Mutual Destruction Game Theory](https://en.wikipedia.org/wiki/Mutual_assured_destruction)
