# Kusho CLI

CLI tool for recording UI interactions as Playwright code and turning them into full-fledged test suites.

## Installation

```bash
npm install
```

## Usage

### Basic Recording

Start recording UI interactions (opens browser + inspector):

```bash
node index.js record
```

### Record from Specific URL

```bash
node index.js record https://example.com
```

### Device Emulation

Record with mobile/tablet emulation:

```bash
node index.js record --device "iPhone 13" https://example.com
```

### Custom Output File

Save generated code to a specific file:

```bash
node index.js record --output my-test.js
```

### Demo

Try the recorder with Playwright's demo site:

```bash
node index.js demo
```

### Extend Existing Test File

Extend an existing test file with KushoAI variations:

```bash
node index.js extend path/to/your/test.js
```

### Update Credentials

Update your KushoAI credentials:

```bash
node index.js credentials
```

### Run Extended Tests

Run an extended test from the extended-tests folder:

```bash
# Choose from interactive list
node index.js run

# Run specific test
node index.js run login-test

# Run latest test
node index.js run latest

# Run with options
node index.js run login-test --headed --record
```

### Run Recordings

Run a test from the recordings folder:

```bash
# Choose from interactive list
node index.js run-recording

# Run specific recording
node index.js run-recording login-test

# Run latest recording
node index.js run-recording latest

# Run with options
node index.js run-recording login-test --headed
```

## Command Options

- `-d, --device <device>` - Device to emulate (e.g., "iPhone 13")
- `-v, --viewport <size>` - Viewport size (e.g., "1280,720")
- `-t, --target <lang>` - Target language (javascript, python, etc.)
- `-o, --output <filename>` - Output filename for generated code
- `--no-wait-enhancement` - Disable intelligent wait enhancement

## How It Works

1. **Real-time code capture** - Shows generated Playwright code as you interact with the browser
2. **File watching** - Monitors the output file for changes and displays updates
3. **Device emulation** - Support for mobile/tablet recording scenarios
4. **Custom output** - Save recordings to specified files
5. **Graceful shutdown** - Press Ctrl+C to save final code and exit

## Output

The recorder creates a `kusho-tests/` folder structure:
- `kusho-tests/recordings/` - Original recorded tests
- `kusho-tests/extended-tests/` - AI-enhanced test suites

Generated code is displayed in real-time in the terminal as you perform UI interactions.

## Development

This tool is a wrapper around Playwright's built-in `codegen` command, providing programmatic access to the generated test code through file watching and process management.