# KushoAI CLI

CLI tool for recording UI interactions and generating comprehensive test suites with AI.

KushoAI CLI takes your recorded user flows and generates exhaustive test variations. Record your user flow once, and KushoAI creates multiple test cases with different inputs, edge cases, and scenarios to provide thorough test coverage.

## Prerequisites

### Node.js Installation (Node 18+)

Install Node.js using nvm (Node Version Manager):

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart your terminal or run:
source ~/.bashrc

# Install and use Node.js 18 or later
nvm install 18
nvm use 18

# Verify installation
node --version
npm --version
```

### Clone the Repository

```bash
git clone https://github.com/your-username/kusho-cli.git
cd kusho-cli
```

## Installation

```bash
npm install

# Link the package globally to use 'kusho' command
npm link
```

After linking, you can use the `kusho` command syntax throughout your terminal.

## Workflow

```html
┌─────────────────┐
│  Start Here     │
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ kusho record    │────▶│ Record UI       │
│ [URL]           │     │ interactions    │
│ [--output file] │     │ in browser      │
└─────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Save to         │     │ Generated       │
│ recordings/     │◀────│ Playwright code │
│ folder          │     │ (saved to file) │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ kusho extend    │
│ [test-file.js]  │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ AI enhances     │
│ test & saves to │
│ extended-tests/ │
└─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ kusho run       │     │ kusho run       │     │ kusho           │
│ [test-name]     │     │ [test-name]     │     │ run-recording   │
│                 │     │ --headed        │     │ [name]          │
│                 │     │ --record        │     │ (debug orig.)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Run tests       │     │ Run tests with  │     │ Run original    │
│ headlessly      │     │ browser visible │     │ recording for   │
│                 │     │ & record video  │     │ debugging       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Usage

### Basic Recording

Start recording UI interactions (opens browser + inspector):

```bash
kusho record
```

### Record from Specific URL

```bash
kusho record https://example.com
```

### Device Emulation

Record with mobile/tablet emulation:

```bash
kusho record --device "iPhone 13" https://example.com
```

### Demo

Try the recorder with Playwright's demo site:

```bash
kusho demo
```

### Extend Existing Test File

Extend an existing test file with KushoAI variations:

```bash
kusho extend path/to/your/test.js
```

### Update Credentials

Update your KushoAI credentials:

```bash
kusho credentials
```

### Run Extended Tests

Run an extended test from the extended-tests folder:

```bash
# Choose from interactive list
kusho run

# Run specific test
kusho run login-test

# Run latest test
kusho run latest

# Run with options
kusho run login-test --headed --record
```

### Run Recordings

Run a test from the recordings folder:

```bash
# Choose from interactive list
kusho run-recording

# Run specific recording
kusho run-recording login-test

# Run latest recording
kusho run-recording latest

# Run with options
kusho run-recording login-test --headed
```

## Command Options

- `-d, --device <device>` - Device to emulate (e.g., "iPhone 13")
- `-v, --viewport <size>` - Viewport size (e.g., "1280,720")
- `-t, --target <lang>` - Target language (javascript, python, etc.)
- `-o, --output <filename>` - Output filename for generated code
- `--no-wait-enhancement` - Disable intelligent wait enhancement

## Output

The recorder creates a `kusho-tests/` folder structure:
- `kusho-tests/recordings/` - Original recorded tests
- `kusho-tests/extended-tests/` - AI-enhanced test suites

Generated code is displayed in real-time in the terminal as you perform UI interactions.
