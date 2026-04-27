FROM mcr.microsoft.com/devcontainers/rust:1-1-bookworm

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install dependencies
RUN apt-get update && apt-get install -y \
    libudev-dev \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Solana CLI
RUN curl -sSfL https://release.solana.com/v1.18.17/install | bash

# Add Solana to PATH
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install Anchor CLI
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli

# Install global npm packages
RUN npm install -g yarn ts-node typescript

# Set working directory
WORKDIR /workspace

# Verify installations
RUN solana --version && anchor --version && node --version

# Expose common ports
EXPOSE 8899 8900 3000 3001

CMD ["bash"]
