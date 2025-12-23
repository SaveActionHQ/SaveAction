# Changelog

All notable changes to SaveAction Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-12-03

### Added

- 🎠 **Carousel/Swiper Support (Beta)** - Intelligent detection and handling of carousel navigation buttons
  - Supports Swiper.js (`.swiper-button-next/prev`, `aria-label="Next slide"`)
  - Supports Bootstrap Carousel (`.carousel-control-next/prev`)
  - Supports Slick Carousel (`.slick-next/prev`)
  - Timing-based duplicate detection (>500ms = intentional, <200ms = skip)
  - Safety limit of 5 consecutive clicks to prevent infinite loops
  - Enhanced console logging with 🎠 emoji for carousel actions

- 📍 **Enhanced Action Logging** - Better visibility during test execution
  - Shows current page URL for each action
  - Displays recording time vs actual elapsed time
  - Explains wait times: "⏱️ Waiting 12.8s (recorded browsing/reading time)"

- 🧪 **Expanded Test Coverage** - Added 8 new carousel detection tests
  - Tests for Swiper.js, Bootstrap, and Slick carousel detection
  - Timing-based intentional vs duplicate click identification
  - Null selector handling
  - Total test count: 81 (up from 73)

### Fixed

- **Action Order Correction** - Fixed issue where input actions were recorded after submit buttons
  - Parser now detects and swaps illogical sequences (submit before input)
  - Ensures forms are filled before submission
  - Handles recorder bug where input blur timestamp was after button click

- **Human-Realistic Navigation** - Browser back/forward now includes natural delays
  - Variable delays (577-747ms) with triangular distribution
  - Simulates human thinking + mouse movement + click
  - Respects timing mode (instant/fast/realistic)

### Changed

- Updated test count from 73 to 81 tests
- Improved duplicate detection logic with carousel-aware rules
- Enhanced error handling with try-catch for carousel detection

## [0.1.0] - 2024-01-XX

### Added

- Initial release with core engine and CLI
- JSON recording parser with Zod validation
- Multi-browser test runner (Chromium, Firefox, WebKit)
- Element locator with multi-strategy fallback
- Console reporter with color-coded output
- Timing accuracy (completedAt support)
- 73 unit tests with 53.8% coverage

[0.2.0]: https://github.com/SaveActionHQ/SaveAction/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SaveActionHQ/SaveAction/releases/tag/v0.1.0
