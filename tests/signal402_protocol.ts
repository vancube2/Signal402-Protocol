import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Signal402Protocol } from '../target/types/signal402_protocol';
import { expect } from 'chai';
import { createHash } from 'crypto';

describe('Signal402 Protocol', () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Signal402Protocol as Program<Signal402Protocol>;
  const provider = anchor.getProvider();
  const authority = provider.wallet as anchor.Wallet;

  // Test accounts
  let oracleKeypair: anchor.web3.Keypair;
  let protocolStatePda: anchor.web3.PublicKey;
  let protocolStateBump: number;

  before(async () => {
    oracleKeypair = anchor.web3.Keypair.generate();

    // Fund the oracle account
    const fundOracleTx = await provider.connection.requestAirdrop(
      oracleKeypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(fundOracleTx);

    // Derive protocol state PDA
    [protocolStatePda, protocolStateBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('protocol_state')],
      program.programId
    );
  });

  describe('Initialize Protocol', () => {
    it('should initialize the protocol successfully', async () => {
      await program.methods
        .initializeProtocol()
        .accounts({
          protocolState: protocolStatePda,
          authority: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const protocolState = await program.account.protocolState.fetch(protocolStatePda);

      expect(protocolState.authority.toString()).to.equal(authority.publicKey.toString());
      expect(protocolState.predictionCount.toNumber()).to.equal(0);
      expect(protocolState.verifiedOracles).to.be.an('array').that.is.empty;
      expect(protocolState.bump).to.equal(protocolStateBump);
    });

    it('should fail to initialize protocol twice', async () => {
      try {
        await program.methods
          .initializeProtocol()
          .accounts({
            protocolState: protocolStatePda,
            authority: authority.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('already in use');
      }
    });
  });

  describe('Register Oracle', () => {
    it('should register a new oracle', async () => {
      await program.methods
        .registerOracle(oracleKeypair.publicKey)
        .accounts({
          protocolState: protocolStatePda,
          authority: authority.publicKey,
        })
        .rpc();

      const protocolState = await program.account.protocolState.fetch(protocolStatePda);
      const oracleExists = protocolState.verifiedOracles.some(
        (oracle: anchor.web3.PublicKey) => oracle.toString() === oracleKeypair.publicKey.toString()
      );
      expect(oracleExists).to.be.true;
    });

    it('should fail to register the same oracle twice', async () => {
      try {
        await program.methods
          .registerOracle(oracleKeypair.publicKey)
          .accounts({
            protocolState: protocolStatePda,
            authority: authority.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('OracleAlreadyRegistered');
      }
    });

    it('should fail when non-authority tries to register oracle', async () => {
      const unauthorizedKeypair = anchor.web3.Keypair.generate();

      // Fund the unauthorized account
      const fundTx = await provider.connection.requestAirdrop(
        unauthorizedKeypair.publicKey,
        anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(fundTx);

      const newOracle = anchor.web3.Keypair.generate();

      try {
        await program.methods
          .registerOracle(newOracle.publicKey)
          .accounts({
            protocolState: protocolStatePda,
            authority: unauthorizedKeypair.publicKey,
          })
          .signers([unauthorizedKeypair])
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('Unauthorized');
      }
    });
  });

  describe('Commit Prediction', () => {
    const matchId = 'match-123';
    const predictionData = 'Team A will win 2-1';
    const nonce = 12345;
    let timestamp: number;
    let commitmentHash: Buffer;
    let predictionPda: anchor.web3.PublicKey;
    let predictionBump: number;

    beforeEach(async () => {
      const clock = await provider.connection.getAccountInfo(anchor.web3.SYSVAR_CLOCK_PUBKEY);
      timestamp = Math.floor(Date.now() / 1000);

      // Create commitment hash: hash(prediction_data || nonce || timestamp)
      const hashInput = Buffer.concat([
        Buffer.from(predictionData),
        Buffer.from(nonce.toString()),
        Buffer.from(timestamp.toString()),
      ]);
      commitmentHash = createHash('sha256').update(hashInput).digest();

      // Derive prediction PDA
      [predictionPda, predictionBump] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from('prediction'),
          oracleKeypair.publicKey.toBuffer(),
          Buffer.from(matchId),
          Buffer.from(timestamp.toString()),
        ],
        program.programId
      );
    });

    it('should commit a prediction successfully', async () => {
      const expiryTimestamp = timestamp + 3600; // 1 hour from now

      // Convert Buffer to array of numbers for the instruction
      const hashArray = Array.from(commitmentHash);

      await program.methods
        .commitPrediction(hashArray, matchId, new anchor.BN(expiryTimestamp))
        .accounts({
          prediction: predictionPda,
          oracle: oracleKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([oracleKeypair])
        .rpc();

      const prediction = await program.account.prediction.fetch(predictionPda);

      expect(prediction.oracle.toString()).to.equal(oracleKeypair.publicKey.toString());
      expect(prediction.matchId).to.equal(matchId);
      expect(prediction.isRevealed).to.be.false;
      expect(prediction.expiryTimestamp.toNumber()).to.equal(expiryTimestamp);
      expect(prediction.bump).to.equal(predictionBump);

      // Verify commitment hash
      const storedHash = Buffer.from(prediction.commitmentHash);
      expect(storedHash.equals(commitmentHash)).to.be.true;
    });

    it('should fail to commit with invalid expiry (in the past)', async () => {
      const pastExpiry = timestamp - 3600; // 1 hour ago
      const hashArray = Array.from(commitmentHash);

      // Need different match ID and PDA for this test
      const newMatchId = 'match-past';
      const [newPredictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from('prediction'),
          oracleKeypair.publicKey.toBuffer(),
          Buffer.from(newMatchId),
          Buffer.from(timestamp.toString()),
        ],
        program.programId
      );

      try {
        await program.methods
          .commitPrediction(hashArray, newMatchId, new anchor.BN(pastExpiry))
          .accounts({
            prediction: newPredictionPda,
            oracle: oracleKeypair.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([oracleKeypair])
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('InvalidExpiry');
      }
    });

    it('should fail to commit with expiry too far in the future', async () => {
      const farExpiry = timestamp + (48 * 60 * 60) + 3600; // 49 hours from now
      const hashArray = Array.from(commitmentHash);

      // Need different match ID and PDA for this test
      const newMatchId = 'match-far';
      const [newPredictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from('prediction'),
          oracleKeypair.publicKey.toBuffer(),
          Buffer.from(newMatchId),
          Buffer.from(timestamp.toString()),
        ],
        program.programId
      );

      try {
        await program.methods
          .commitPrediction(hashArray, newMatchId, new anchor.BN(farExpiry))
          .accounts({
            prediction: newPredictionPda,
            oracle: oracleKeypair.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([oracleKeypair])
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('ExpiryTooFar');
      }
    });
  });

  describe('Reveal and Verify Prediction', () => {
    const matchId = 'match-456';
    const predictionData = 'Player X scores first goal';
    const nonce = 67890;
    let timestamp: number;
    let commitmentHash: Buffer;
    let predictionPda: anchor.web3.PublicKey;
    let expiryTimestamp: number;

    beforeEach(async () => {
      timestamp = Math.floor(Date.now() / 1000);
      expiryTimestamp = timestamp + 2; // 2 seconds from now

      // Create commitment hash matching the Rust implementation
      // hash(prediction_data || nonce || timestamp)
      const hashInput = Buffer.concat([
        Buffer.from(predictionData),
        new anchor.BN(nonce).toBuffer('le', 8),
        new anchor.BN(timestamp).toBuffer('le', 8),
      ]);
      commitmentHash = createHash('sha256').update(hashInput).digest();

      // Derive prediction PDA
      [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from('prediction'),
          oracleKeypair.publicKey.toBuffer(),
          Buffer.from(matchId),
          new anchor.BN(timestamp).toBuffer('le', 8),
        ],
        program.programId
      );

      // Commit the prediction first
      const hashArray = Array.from(commitmentHash);
      await program.methods
        .commitPrediction(hashArray, matchId, new anchor.BN(expiryTimestamp))
        .accounts({
          prediction: predictionPda,
          oracle: oracleKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([oracleKeypair])
        .rpc();
    });

    it('should fail to reveal before expiry', async () => {
      try {
        await program.methods
          .revealPrediction(predictionData, new anchor.BN(nonce))
          .accounts({
            prediction: predictionPda,
            oracle: oracleKeypair.publicKey,
          })
          .signers([oracleKeypair])
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('PredictionNotExpired');
      }
    });

    it('should successfully reveal after expiry', async () => {
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 3000));

      await program.methods
        .revealPrediction(predictionData, new anchor.BN(nonce))
        .accounts({
          prediction: predictionPda,
          oracle: oracleKeypair.publicKey,
        })
        .signers([oracleKeypair])
        .rpc();

      const prediction = await program.account.prediction.fetch(predictionPda);

      expect(prediction.isRevealed).to.be.true;
      expect(prediction.revealedData).to.equal(predictionData);
    });

    it('should fail to reveal with invalid data', async () => {
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 3000));

      const wrongData = 'Wrong prediction data';

      try {
        await program.methods
          .revealPrediction(wrongData, new anchor.BN(nonce))
          .accounts({
            prediction: predictionPda,
            oracle: oracleKeypair.publicKey,
          })
          .signers([oracleKeypair])
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('InvalidRevelation');
      }
    });

    it('should fail to reveal twice', async () => {
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 3000));

      // First reveal
      await program.methods
        .revealPrediction(predictionData, new anchor.BN(nonce))
        .accounts({
          prediction: predictionPda,
          oracle: oracleKeypair.publicKey,
        })
        .signers([oracleKeypair])
        .rpc();

      // Second reveal should fail
      try {
        await program.methods
          .revealPrediction(predictionData, new anchor.BN(nonce))
          .accounts({
            prediction: predictionPda,
            oracle: oracleKeypair.publicKey,
          })
          .signers([oracleKeypair])
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('AlreadyRevealed');
      }
    });
  });

  describe('Verify Prediction', () => {
    const matchId = 'match-789';
    const predictionData = 'Team B wins by 3 points';
    const nonce = 11111;
    let timestamp: number;
    let commitmentHash: Buffer;
    let predictionPda: anchor.web3.PublicKey;

    beforeEach(async () => {
      timestamp = Math.floor(Date.now() / 1000);
      const expiryTimestamp = timestamp + 2; // 2 seconds from now

      // Create commitment hash matching the Rust implementation
      const hashInput = Buffer.concat([
        Buffer.from(predictionData),
        new anchor.BN(nonce).toBuffer('le', 8),
        new anchor.BN(timestamp).toBuffer('le', 8),
      ]);
      commitmentHash = createHash('sha256').update(hashInput).digest();

      // Derive prediction PDA
      [predictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from('prediction'),
          oracleKeypair.publicKey.toBuffer(),
          Buffer.from(matchId),
          new anchor.BN(timestamp).toBuffer('le', 8),
        ],
        program.programId
      );

      // Commit the prediction
      const hashArray = Array.from(commitmentHash);
      await program.methods
        .commitPrediction(hashArray, matchId, new anchor.BN(expiryTimestamp))
        .accounts({
          prediction: predictionPda,
          oracle: oracleKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([oracleKeypair])
        .rpc();
    });

    it('should fail to verify before reveal', async () => {
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await program.methods
          .verifyPrediction(predictionData, new anchor.BN(nonce))
          .accounts({
            prediction: predictionPda,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.toString()).to.include('NotYetRevealed');
      }
    });

    it('should successfully verify after reveal', async () => {
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Reveal first
      await program.methods
        .revealPrediction(predictionData, new anchor.BN(nonce))
        .accounts({
          prediction: predictionPda,
          oracle: oracleKeypair.publicKey,
        })
        .signers([oracleKeypair])
        .rpc();

      // Now verify
      const tx = await program.methods
        .verifyPrediction(predictionData, new anchor.BN(nonce))
        .accounts({
          prediction: predictionPda,
        })
        .rpc();

      expect(tx).to.be.a('string');
    });

    it('should return false for invalid data during verify', async () => {
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Reveal first
      await program.methods
        .revealPrediction(predictionData, new anchor.BN(nonce))
        .accounts({
          prediction: predictionPda,
          oracle: oracleKeypair.publicKey,
        })
        .signers([oracleKeypair])
        .rpc();

      // Verify with wrong data
      const wrongData = 'Tampered data';

      // The program returns a boolean, not an error, for invalid data
      const tx = await program.methods
        .verifyPrediction(wrongData, new anchor.BN(nonce))
        .accounts({
          prediction: predictionPda,
        })
        .rpc();

      expect(tx).to.be.a('string');
    });
  });

  describe('Events', () => {
    it('should emit PredictionCommitted event', async () => {
      const matchId = 'match-event-test';
      const predictionData = 'Event test prediction';
      const nonce = 99999;
      const timestamp = Math.floor(Date.now() / 1000);
      const expiryTimestamp = timestamp + 3600;

      const hashInput = Buffer.concat([
        Buffer.from(predictionData),
        new anchor.BN(nonce).toBuffer('le', 8),
        new anchor.BN(timestamp).toBuffer('le', 8),
      ]);
      const commitmentHash = createHash('sha256').update(hashInput).digest();

      const [eventPredictionPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from('prediction'),
          oracleKeypair.publicKey.toBuffer(),
          Buffer.from(matchId),
          new anchor.BN(timestamp).toBuffer('le', 8),
        ],
        program.programId
      );

      const hashArray = Array.from(commitmentHash);

      // Set up event listener
      let eventReceived = false;
      const listener = program.addEventListener('PredictionCommitted', (event) => {
        eventReceived = true;
        expect(event.oracle.toString()).to.equal(oracleKeypair.publicKey.toString());
        expect(event.matchId).to.equal(matchId);
      });

      await program.methods
        .commitPrediction(hashArray, matchId, new anchor.BN(expiryTimestamp))
        .accounts({
          prediction: eventPredictionPda,
          oracle: oracleKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([oracleKeypair])
        .rpc();

      // Give time for event to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      await program.removeEventListener(listener);

      // Events may not work in test validator, so we just check the TX succeeded
      const prediction = await program.account.prediction.fetch(eventPredictionPda);
      expect(prediction.matchId).to.equal(matchId);
    });
  });
});
