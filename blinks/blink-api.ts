import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Signal402Protocol } from '../target/types/signal402_protocol';

// Blink API for Signal402 Protocol
// Implements Solana Actions specification for wallet integration

const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');

export interface BlinkAction {
  title: string;
  description: string;
  label: string;
  links?: {
    actions: BlinkActionLink[];
  };
  icon?: string;
  disabled?: boolean;
  error?: string;
}

export interface BlinkActionLink {
  label: string;
  href: string;
  parameters?: {
    name: string;
    label?: string;
    required?: boolean;
  }[];
}

export interface BlinkTransactionRequest {
  account: string;
  data?: {
    matchId?: string;
    predictionData?: string;
    nonce?: number;
    amount?: number;
  };
}

export interface BlinkTransactionResponse {
  transaction: string;
  message?: string;
}

/**
 * GET /api/predictions
 * Returns available prediction actions
 */
export function getPredictionsAction(): BlinkAction {
  return {
    title: 'Signal402 - Verifiable Sports Predictions',
    description: 'Commit to a prediction hash before the match. Get paid if you\'re right.',
    label: 'Make Prediction',
    icon: 'https://signal402.io/icon.png',
    links: {
      actions: [
        {
          label: 'Commit Prediction',
          href: '/api/predictions/commit',
          parameters: [
            { name: 'matchId', label: 'Match ID', required: true },
            { name: 'predictionData', label: 'Your Prediction', required: true },
            { name: 'nonce', label: 'Secret Number', required: true },
          ],
        },
        {
          label: 'Reveal Prediction',
          href: '/api/predictions/reveal',
          parameters: [
            { name: 'matchId', label: 'Match ID', required: true },
            { name: 'predictionData', label: 'Original Prediction', required: true },
            { name: 'nonce', label: 'Secret Number', required: true },
          ],
        },
        {
          label: 'View Predictions',
          href: '/api/predictions/list',
        },
      ],
    },
  };
}

/**
 * GET /api/vault/:oracle
 * Returns vault deposit action for an oracle
 */
export function getVaultAction(oracle: string): BlinkAction {
  try {
    const oraclePubkey = new PublicKey(oracle);
    return {
      title: 'Fund Prediction Oracle',
      description: `Deposit funds into the payment vault for oracle ${oraclePubkey.toString().slice(0, 8)}...`,
      label: 'Deposit SOL',
      icon: 'https://signal402.io/vault-icon.png',
      links: {
        actions: [
          {
            label: 'Deposit 0.1 SOL',
            href: `/api/vault/${oracle}/deposit`,
            parameters: [
              { name: 'amount', label: 'Amount (SOL)', required: false },
            ],
          },
        ],
      },
    };
  } catch (error) {
    return {
      title: 'Invalid Oracle',
      description: 'The provided oracle address is invalid',
      label: 'Error',
      error: 'Invalid oracle public key',
      disabled: true,
    };
  }
}

/**
 * POST /api/predictions/commit
 * Creates a transaction to commit a prediction
 */
export async function createPredictionCommit(
  program: Program<Signal402Protocol>,
  request: BlinkTransactionRequest
): Promise<BlinkTransactionResponse> {
  const { account, data } = request;

  if (!data?.matchId || !data?.predictionData || data?.nonce === undefined) {
    throw new Error('Missing required parameters: matchId, predictionData, nonce');
  }

  const user = new PublicKey(account);
  const timestamp = Math.floor(Date.now() / 1000);

  // Create commitment hash
  const crypto = require('crypto');
  const hashInput = Buffer.concat([
    Buffer.from(data.predictionData),
    Buffer.from(data.nonce.toString()),
    Buffer.from(timestamp.toString()),
  ]);
  const commitmentHash = crypto.createHash('sha256').update(hashInput).digest();

  // Derive prediction PDA
  const [predictionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('prediction'),
      user.toBuffer(),
      Buffer.from(data.matchId),
      Buffer.from(timestamp.toString()),
    ],
    program.programId
  );

  const expiryTimestamp = timestamp + 48 * 60 * 60; // 48 hours

  // Create instruction
  const ix = await program.methods
    .commitPrediction(
      Array.from(commitmentHash),
      data.matchId,
      new anchor.BN(expiryTimestamp)
    )
    .accounts({
      prediction: predictionPda,
      oracle: user,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Create transaction
  const transaction = new Transaction().add(ix);
  transaction.feePayer = user;

  // Get latest blockhash
  const connection = program.provider.connection;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // Serialize transaction
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return {
    transaction: serialized.toString('base64'),
    message: `Commit prediction for match ${data.matchId}`,
  };
}

/**
 * POST /api/vault/:oracle/deposit
 * Creates a transaction to deposit to a vault
 */
export async function createVaultDeposit(
  program: Program<Signal402Protocol>,
  oracle: string,
  request: BlinkTransactionRequest
): Promise<BlinkTransactionResponse> {
  const { account, data } = request;

  const depositor = new PublicKey(account);
  const oraclePubkey = new PublicKey(oracle);

  // Derive vault PDA
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('payment_vault'),
      oraclePubkey.toBuffer(),
    ],
    program.programId
  );

  const amount = data?.amount
    ? Math.floor(data.amount * LAMPORTS_PER_SOL)
    : 0.1 * LAMPORTS_PER_SOL; // Default 0.1 SOL

  // Create instruction
  const ix = await program.methods
    .depositToVault(new anchor.BN(amount))
    .accounts({
      paymentVault: vaultPda,
      depositor: depositor,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Create transaction
  const transaction = new Transaction().add(ix);
  transaction.feePayer = depositor;

  // Get latest blockhash
  const connection = program.provider.connection;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // Serialize transaction
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  return {
    transaction: serialized.toString('base64'),
    message: `Deposit ${amount / LAMPORTS_PER_SOL} SOL to oracle vault`,
  };
}

/**
 * Example Express.js route handlers
 */
export function createBlinkRoutes(program: Program<Signal402Protocol>) {
  return {
    // GET handlers
    getPredictions: (_req: any, res: any) => {
      res.json(getPredictionsAction());
    },

    getVault: (req: any, res: any) => {
      const { oracle } = req.params;
      res.json(getVaultAction(oracle));
    },

    // POST handlers
    postCommit: async (req: any, res: any) => {
      try {
        const result = await createPredictionCommit(program, req.body);
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    },

    postVaultDeposit: async (req: any, res: any) => {
      try {
        const { oracle } = req.params;
        const result = await createVaultDeposit(program, oracle, req.body);
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    },
  };
}
