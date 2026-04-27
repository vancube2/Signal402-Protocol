#!/bin/bash
set -e

echo "🚀 Setting up Signal402 Protocol Development Environment..."

# PATH is already set in Dockerfile, but ensure it's available
export PATH="/root/.local/share/solana/install/active_release/bin:/root/.cargo/bin:$PATH"

# Verify installations
echo "✅ Verifying installations..."
solana --version
anchor --version
node --version

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
cd /workspace
if [ -f "yarn.lock" ]; then
    yarn install
else
    npm install
fi

# Generate Solana keypair for testing
mkdir -p ~/.config/solana
if [ ! -f ~/.config/solana/id.json ]; then
    echo "🔑 Generating Solana keypair..."
    solana-keygen new --no-passphrase --silent -o ~/.config/solana/id.json
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
