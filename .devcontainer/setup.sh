#!/bin/bash
set -e

echo "🚀 Setting up Signal402 Protocol Development Environment..."

# Install Solana CLI
echo "📦 Installing Solana CLI..."
curl -sSfL https://release.solana.com/v1.18.17/install | sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify Solana installation
solana --version

# Install Anchor CLI
echo "⚓ Installing Anchor CLI..."
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli

# Verify Anchor installation
anchor --version

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install -g yarn
yarn install

# Generate Solana keypair for testing
mkdir -p ~/.config/solana
if [ ! -f ~/.config/solana/id.json ]; then
    echo "🔑 Generating Solana keypair..."
    solana-keygen new --no-passphrase -o ~/.config/solana/id.json
fi

# Set Solana config to localnet
echo "⚙️ Configuring Solana CLI..."
solana config set --url localnet

# Install Rust components for Solana
echo "🦀 Installing Rust components..."
rustup component add rustfmt clippy

# Display welcome message
if [ -f .devcontainer/welcome.txt ]; then
    cat .devcontainer/welcome.txt
fi

echo ""
echo "✅ Setup complete!"
echo ""
