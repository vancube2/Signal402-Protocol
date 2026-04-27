# Signal402 Protocol

A verifiable sports betting prediction protocol on Solana with x402 payment integration, oracle staking, and Solana Blinks support.

## Quick Start with GitHub Codespaces

The easiest way to get started is using GitHub Codespaces (cloud development environment with all dependencies pre-installed):

### Option 1: Open in Codespaces (Recommended)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/your-username/signal402-protocol)

1. Click the button above or go to **Code → Codespaces → Create codespace on main**
2. Wait for the environment to initialize (2-3 minutes)
3. The setup script will automatically install:
   - Solana CLI v1.18.17
   - Anchor CLI v0.30.1
   - Node.js dependencies
4. Start building!

### Option 2: Local Development (Windows/Mac/Linux)

#### Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solanalabs.com/cli/install)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation)
- Node.js v18+

#### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/signal402-protocol.git
cd signal402-protocol

# Install dependencies
yarn install

# Build the smart contract
anchor build

# Run tests
anchor test
```

## Project Structure

```
signal402-protocol/
├── programs/
│   └── signal402_protocol/     # Rust smart contract
│       └── src/
│           └── lib.rs            # Main program logic
├── tests/
│   └── signal402_protocol.ts    # TypeScript test suite
├── blinks/                       # Solana Blinks integration
│   ├── actions.json
│   └── blink-api.ts
├── frontend/                     # React frontend app
│   └── signal402-app/
├── .devcontainer/                # GitHub Codespaces config
│   ├── devcontainer.json
│   ├── Dockerfile
│   └── setup.sh
└── Anchor.toml                  # Anchor configuration
```

## Features

### Core Smart Contract Features

- **Commit Prediction** - Hash predictions on-chain before matches
- **Reveal Prediction** - Reveal predictions after match expiry
- **Verify Prediction** - Verify prediction integrity
- **x402 Payment Vault** - Deposit/stream micropayments
- **Oracle Staking** - Reputation staking with accuracy tracking
- **Slashing Mechanism** - 10% slash for bad predictions (3 strikes = banned)
- **PDA-based Accounts** - Efficient account structure
- **Platform Fees** - 2.5% fee on streamed payments

### Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | Anchor 0.30.1 |
| Language | Rust (smart contract), TypeScript (tests/API) |
| Program ID | `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS` |
| Client | @coral-xyz/anchor |
| Blinks | Solana Actions API |

## Building

### Build the Smart Contract

```bash
anchor build
```

### Run Tests

```bash
anchor test
```

### Deploy to Devnet

```bash
# Set cluster to devnet
solana config set --url devnet

# Airdrop SOL for deployment
solana airdrop 2

# Deploy
anchor deploy
```

### Deploy to Mainnet

```bash
# Set cluster to mainnet
solana config set --url mainnet-beta

# Ensure you have SOL in your wallet
solana balance

# Deploy
anchor deploy
```

## Smart Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SIGNAL402 PROTOCOL                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Prediction  │  │ PaymentVault │  │ OracleStake  │    │
│  │   Account    │  │   Account    │  │   Account    │    │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤    │
│  │ - oracle     │  │ - oracle     │  │ - oracle     │    │
│  │ - match_id   │  │ - authority  │  │ - staked_amt │    │
│  │ - hash       │  │ - balance    │  │ - accuracy   │    │
│  │ - timestamp  │  │ - streamed   │  │ - slash_cnt  │    │
│  │ - is_revealed│  │ - is_active  │  │ - is_slashed │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                              │
│  Instructions:                                               │
│    • commit_prediction   • initialize_vault                │
│    • reveal_prediction   • deposit_to_vault                 │
│    • verify_prediction   • stream_payment                   │
│    • initialize_protocol • initialize_oracle_stake          │
│    • register_oracle     • add_stake / remove_stake        │
│                           • update_oracle_accuracy         │
│                           • slash_oracle                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Account Types

### Prediction
- Stores committed prediction hash and metadata
- PDA derived from oracle + match_id

### PaymentVault
- Manages x402 micropayment streams
- Tracks deposited and streamed amounts

### OracleStake
- Stores oracle staking information
- Tracks accuracy score and slashing history

## Instruction Reference

| Instruction | Description |
|-------------|-------------|
| `initialize_protocol` | Initialize protocol state |
| `register_oracle` | Register a new oracle |
| `commit_prediction` | Commit prediction hash |
| `reveal_prediction` | Reveal prediction after expiry |
| `verify_prediction` | Verify prediction integrity |
| `initialize_vault` | Create payment vault |
| `deposit_to_vault` | Deposit SOL to vault |
| `stream_payment` | Stream payment to oracle |
| `initialize_oracle_stake` | Initialize oracle staking |
| `add_stake` | Add stake to oracle |
| `remove_stake` | Remove stake from oracle |
| `update_oracle_accuracy` | Update oracle accuracy score |
| `slash_oracle` | Slash oracle for bad prediction |

## Solana Blinks Integration

The protocol includes Solana Blinks support for wallet-friendly interactions:

```typescript
// Example: Create a prediction commit Blink
const action = {
  type: "action",
  icon: "https://signal402.io/icon.png",
  title: "Commit Prediction",
  description: "Commit a prediction hash to the Signal402 Protocol",
  label: "Commit",
  links: {
    actions: [
      {
        type: "transaction",
        label: "Commit Prediction",
        href: "/api/actions/commit",
        parameters: [
          { name: "match_id", label: "Match ID", required: true },
          { name: "prediction_hash", label: "Prediction Hash", required: true }
        ]
      }
    ]
  }
};
```

See `blinks/` directory for full implementation.

## Frontend Development

The frontend is located in `frontend/signal402-app/`:

```bash
cd frontend/signal402-app
npm install
npm run dev
```

## Testing

### Unit Tests

```bash
anchor test
```

### Test Coverage

- Prediction commitment/reveal flow
- Oracle registration and staking
- Payment vault operations
- Slashing mechanism
- Authority validation
- Expiry validation
- Event emission

## Deployment Checklist

Before deploying to mainnet:

- [ ] Security audit completed
- [ ] Test on devnet
- [ ] Verify program ID
- [ ] Set correct authority
- [ ] Configure platform fees
- [ ] Test all instruction paths
- [ ] Verify oracle registration flow

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For questions or issues:
- Open a GitHub issue
- Join our Discord community
- Email: support@signal402.io

## Acknowledgments

- Built with [Anchor Framework](https://anchor-lang.com/)
- Powered by [Solana](https://solana.com/)
- x402 standard by [OpenRouter](https://openrouter.ai/)
