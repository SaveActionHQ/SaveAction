# Changelog

All notable changes to SaveAction Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- ✅ **`validate` Command** - Validate recording structure without execution
  - Check file existence and extension (.json)
  - Enforce file size limits (warning > 10MB, hard limit 50MB)
  - Validate JSON syntax with detailed error messages
  - Schema compliance using Zod validation from RecordingParser
  - Verify required fields (id, testName, url, version, actions)
  - Check field types and formats
  - Semantic validation (empty actions, large recordings, version compatibility)
  - Console output with ✅/❌ emojis and detailed field information
  - JSON output format with `--json` flag
  - Verbose mode with `--verbose` flag shows validated fields
  - User-friendly error messages for Zod, SyntaxError, and general errors
  - Cross-platform path resolution (Windows, Linux, macOS)
  - Exit code 0 for valid files, 1 for errors
  - 89.35% test coverage with 25 unit tests

- 📊 **`info` Command** - Analyze recordings without execution
  - Display recording metadata (test name, ID, schema version, start URL)
  - View action statistics (total count, breakdown by type, breakdown by page)
  - Analyze timing (recording duration, action span, gaps between actions with min/max/avg/median)
  - Detect navigation patterns (SPA vs MPA, unique pages, transition count)
  - Console output with emojis, progress bars, and formatted durations
  - JSON output format with `--json` flag for programmatic use
  - Cross-platform support (Windows, Linux, macOS)

- 🔍 **RecordingAnalyzer Class** - Core analysis engine (`@saveaction/core`)
  - Viewport categorization (Mobile ≤768px, Tablet ≤1024px, Desktop >1024px)
  - URL normalization (removes trailing slashes, hash fragments, preserves query params)
  - Action percentage calculations
  - Comprehensive error handling for invalid/missing fields
  - 99.14% test coverage with 46 unit tests

### Changed

- Updated test count from 81 to 148 tests (67 new tests for analyzer + info command)
- Enhanced exports in `@saveaction/core` to include analyzer types
- Improved CLI help text to show both `run` and `info` commands

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
