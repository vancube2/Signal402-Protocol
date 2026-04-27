#!/bin/bash
# Immediate fix for missing Solana/Anchor commands

echo "🔧 Applying immediate fix..."

# Install Solana CLI if not present
if ! command -v solana &> /dev/null; then
    echo "📦 Installing Solana CLI..."
    curl -sSfL https://release.solana.com/v1.18.17/install | sh
fi

# Install Anchor CLI if not present
if ! command -v anchor &> /dev/null; then
    echo "⚓ Installing Anchor CLI..."
    cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --force
fi

# Set PATH for current session
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

# Add to shell profile for persistence
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"' >> ~/.bashrc

# Verify installations
echo ""
echo "✅ Verifying installations..."
solana --version
anchor --version

echo ""
echo "✅ Fix applied! Solana and Anchor are now available."
echo ""
echo "💡 Note: If you open a new terminal, run: source ~/.bashrc"
