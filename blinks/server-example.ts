import express from 'express';
import cors from 'cors';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Signal402Protocol } from '../target/types/signal402_protocol';
import { createBlinkRoutes } from './blink-api';

/**
 * Example Express server for Signal402 Blink API
 *
 * This server exposes Solana Actions endpoints that allow
 * wallet applications to interact with Signal402 directly
 * via Blinks (Blockchain Links).
 *
 * Usage:
 *   npm install express cors @solana/web3.js @coral-xyz/anchor
 *   ts-node blinks/server-example.ts
 */

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS for wallet applications
app.use(cors({
  origin: ['https://solana.com', 'https://phantom.app', 'https://solflare.com', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Initialize Solana connection and program
const connection = new Connection(
  process.env.SOLANA_RPC || 'https://api.devnet.solana.com',
  'confirmed'
);

// Mock wallet for read-only operations
const mockWallet = {
  publicKey: PublicKey.default,
  signTransaction: async (tx: any) => tx,
  signAllTransactions: async (txs: any[]) => txs,
};

const provider = new AnchorProvider(connection, mockWallet, {
  commitment: 'confirmed',
});

// Load program
const programId = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
// Note: In production, load the IDL from target/idl/signal402_protocol.json
const program = new Program(null as any, programId, provider);

// Create Blink routes
const blinkRoutes = createBlinkRoutes(program);

// GET endpoints for Blink discovery
app.get('/api/predictions', blinkRoutes.getPredictions);
app.get('/api/vault/:oracle', blinkRoutes.getVault);

// POST endpoints for transaction creation
app.post('/api/predictions/commit', blinkRoutes.postCommit);
app.post('/api/vault/:oracle/deposit', blinkRoutes.postVaultDeposit);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Signal402 Blink API',
    version: '0.1.0',
    network: connection.rpcEndpoint,
  });
});

// Root endpoint with documentation
app.get('/', (_req, res) => {
  res.json({
    name: 'Signal402 Protocol Blink API',
    description: 'Verifiable sports betting predictions on Solana via Blinks',
    endpoints: {
      predictions: {
        method: 'GET',
        path: '/api/predictions',
        description: 'Get available prediction actions',
      },
      commit: {
        method: 'POST',
        path: '/api/predictions/commit',
        description: 'Create a prediction commitment transaction',
      },
      vault: {
        method: 'GET',
        path: '/api/vault/:oracle',
        description: 'Get vault deposit action for an oracle',
      },
      vaultDeposit: {
        method: 'POST',
        path: '/api/vault/:oracle/deposit',
        description: 'Create a vault deposit transaction',
      },
    },
    documentation: 'https://github.com/signal402/protocol#blinks',
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Signal402 Blink API Server                       ║
╠════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║  RPC:  ${connection.rpcEndpoint.padEnd(45)}║
╠════════════════════════════════════════════════════════════╣
║  Available Endpoints:                                        ║
║    GET  /api/predictions        - List predictions          ║
║    POST /api/predictions/commit - Commit prediction         ║
║    GET  /api/vault/:oracle      - Vault info                ║
║    POST /api/vault/:oracle      - Deposit to vault          ║
╚════════════════════════════════════════════════════════════╝
  `);
});
