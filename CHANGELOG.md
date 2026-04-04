# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.18] - 2026-03-09

### Fixed
- Python bindings packaging

### Changed
- Updated README and website copy

## [0.2.17] - 2026-03

### Added
- TON wallet upgraded to v5r1

### Fixed
- Clippy and formatting cleanup

## [0.2.16] - 2026-03

### Added
- TON chain support (Ed25519, raw/bounceable addresses)
- SDK documentation for Node.js and Python

### Fixed
- Wallet import bug
- CLI improvements

## [0.2.15] - 2026-02

### Changed
- Improved install script reliability
- Updated website and install instructions

## [0.2.14] - 2026-02

### Fixed
- Node.js publishing scripts
- Install script during release periods

## [0.2.10 - 0.2.12] - 2026-02

### Fixed
- Python package release process
- npm CI publishing
- Install script fixes

## [0.2.9] - 2026-01

### Changed
- Updated Python bindings and GitHub workflow

## [0.2.8] - 2026-01

### Fixed
- Release script fixes across all platforms

### Added
- Publish flows for Node.js and Python bindings

## [0.2.0] - 2025-12

### Added
- Universal wallet layer with multi-chain support
- Native Node.js bindings via NAPI-RS
- Native Python bindings via PyO3/Maturin
- Release workflow with cross-compiled CLI binaries
- Pre-signing policy engine
- Chain-agnostic addressing (CAIP-2/CAIP-10)
- Support for EVM, Solana, Bitcoin, Cosmos, and Tron

### Changed
- Replaced SDK clients with native FFI bindings
- Reorganized CLI command framework

## [0.1.0] - 2025-11

### Added
- Initial wallet specification
- CLI implementation
- HD key derivation and signing
- Vault storage format
- Website and documentation
