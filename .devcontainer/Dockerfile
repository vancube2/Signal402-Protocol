FROM mcr.microsoft.com/devcontainers/rust:1-1-bookworm

# Install dependencies
RUN apt-get update && apt-get install -y \
    libudev-dev \
    pkg-config \
    libssl-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Solana CLI v1.18.17
RUN curl -sSfL https://release.solana.com/v1.18.17/install | sh

# Add Solana to PATH
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install Anchor CLI v0.30.1
RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli

# Add Cargo bin to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install global npm packages
RUN npm install -g yarn ts-node typescript

# Verify installations
RUN solana --version && anchor --version && node --version

# Set working directory
WORKDIR /workspace

# Expose common ports
EXPOSE 8899 8900 3000 3001

CMD ["bash"]
