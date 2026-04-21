# Signal402 Solana Blinks Integration

This directory contains the **Solana Actions/Blinks** integration for Signal402 Protocol, enabling one-click prediction commitments and vault deposits directly from wallets.

## What are Blinks?

Blinks (Blockchain Links) are a Solana standard that allows dApps to expose "Actions" - interactive blockchain operations that can be embedded in URLs and executed with a single click in compatible wallets.

## Files

- `actions.json` - Solana Actions routing configuration
- `blink-api.ts` - Core API handlers and transaction builders
- `server-example.ts` - Example Express.js server implementation
- `README.md` - This file

## Quick Start

### 1. Install Dependencies

```bash
npm install express cors @solana/web3.js @coral-xyz/anchor
```

### 2. Start the Server

```bash
ts-node blinks/server-example.ts
```

### 3. Test with a Wallet

Open any Solana wallet that supports Blinks (Phantom, Solflare, etc.) and paste:

```
https://your-api.com/api/predictions
```

## Available Actions

### Commit Prediction

**GET** `/api/predictions`

Returns available prediction actions with parameters.

**POST** `/api/predictions/commit`

Creates a transaction to commit a prediction hash.

**Parameters:**
- `matchId` (string) - Unique identifier for the match
- `predictionData` (string) - Your prediction text
- `nonce` (number) - Secret number for commitment

### Vault Deposit

**GET** `/api/vault/:oracle`

Returns deposit action for a specific oracle's payment vault.

**POST** `/api/vault/:oracle/deposit`

Creates a transaction to deposit SOL into an oracle's vault.

**Parameters:**
- `amount` (number, optional) - Amount in SOL (default: 0.1)

## x402 Integration

The vault system implements a micropayment streaming protocol compatible with x402:

1. Users deposit SOL into an oracle's vault
2. Oracles receive streaming payments when their predictions are verified
3. Platform takes a 2.5% fee on all streamed payments

## Action Links Format

```typescript
{
  title: "Signal402 - Verifiable Sports Predictions",
  description: "Commit to a prediction hash before the match",
  label: "Make Prediction",
  links: {
    actions: [
      {
        label: "Commit Prediction",
        href: "/api/predictions/commit",
        parameters: [
          { name: "matchId", label: "Match ID", required: true },
          { name: "predictionData", label: "Your Prediction", required: true },
          { name: "nonce", label: "Secret Number", required: true }
        ]
      }
    ]
  }
}
```

## Wallet Compatibility

- ✅ Phantom
- ✅ Solflare
- ✅ Backpack
- ✅ Glow

## Security Considerations

1. **Nonce Generation**: Always use a random nonce for commitments
2. **HTTPS Only**: Never run Blink APIs over HTTP in production
3. **Rate Limiting**: Implement rate limiting on transaction endpoints
4. **Input Validation**: Validate all parameters before creating transactions

## Example Flow

```
1. User clicks Blink in wallet
   └─ GET /api/predictions
   └─ Shows: "Make Prediction" button

2. User fills form (matchId, prediction, nonce)
   └─ POST /api/predictions/commit
   └─ Returns: base64-encoded transaction

3. Wallet signs transaction
   └─ Prediction committed on-chain
   └─ User sees confirmation

4. After match, user reveals
   └─ Prediction verified
   └─ Oracle receives streaming payment
```

## Production Deployment

1. Set environment variables:
   ```bash
   SOLANA_RPC=https://api.mainnet-beta.solana.com
   PORT=3000
   ```

2. Deploy behind a reverse proxy (nginx, etc.)

3. Configure CORS for your wallet domains

4. Set up monitoring and logging

## Resources

- [Solana Actions Specification](https://solana.com/actions)
- [x402 Protocol](https://x402.org)
- [Signal402 Documentation](../README.md)

---

Built with ❤️ for the Signal402 Trust Layer
