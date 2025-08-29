# [KushoAI CLI](https://github.com/kusho-co/kusho-cli/)

AI-powered CLI tool for recording UI interactions and generating comprehensive test suites.

KushoAI CLI takes your recorded user flows and generates exhaustive test variations. Record your user flow once, and KushoAI creates multiple test cases with different inputs, edge cases, and scenarios to provide thorough test coverage. The tool transforms manual testing into intelligent, automated test scenarios with minimal effort.

[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/E1yqiloZCNw/0.jpg)](https://youtu.be/E1yqiloZCNw?si=2JC9XgEYGvSvEF5K)

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

Please note that these instructions are for bash. The setup might differ a little bit for other terminals. 

You can alternatively download the binaries from [here](https://nodejs.org/en/download/) and install it.

### Git (Required)

Make sure Git is installed on your system. Git is essential for version control and helps in managing your project setup seamlessly. You can download it for free from the official Git [website](https://git-scm.com/downloads).

### Terminal Editor (Required)

A terminal editor is essential for editing test scripts during generation. Install one of the following:

#### Windows (PowerShell as Administrator)
```bash
# Install Vim
winget install vim.vim

# might need adding the vim program files to path and terminal restart before it starts working
```

#### macOS (Homebrew)
```bash
# Install Vim
brew install vim

# Check if nano is available (often pre-installed)
which nano
```

#### Linux (Ubuntu/Debian)
```bash
# Install Vim
sudo apt-get install vim

# Or install Nano
sudo apt-get install nano
```

#### Alternative Downloads
- [Vim for Windows](https://www.vim.org/download.php)
- [Nano for Windows](https://www.nano-editor.org/download.php)
- [Git for Windows](https://git-scm.com/download/win)

#### Test Your Installation
```bash
vim --version
# Or try: nano --version, vi --version
```

### Clone the Repository

```bash
git clone https://github.com/kusho-co/kusho-cli.git
cd kusho-cli
```

## Installation

```bash
npm install

npx playwright install  # this will install the browser binaries

# Link the package globally to use 'kusho' command
npm link
```

After linking, you can use the `kusho` command syntax throughout your terminal.

## Getting Started

### Step 1: Setup Credentials

Before recording, configure your authentication:

```bash
kusho credentials
```

You'll be prompted to enter:
- Your email address
- Authentication token (get this from the Kusho webapp UI Testing section)

This step is required for CLI authentication and must be completed before recording.

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

### Step 2: Record UI Interactions

**What happens during recording:**
1. **Browser Opens**: The command launches a browser window for interaction
2. **Record Your Flow**: Navigate, click, fill forms, and perform any actions you want to test
3. **Close Browser**: Simply close the browser when finished to complete recording
4. **View Script**: You'll see the generated Playwright script that captured your actions
5. **Edit Script**: The script opens in your terminal editor for review and modifications
6. **Save to Continue**: Save the file to proceed to the next step

Start recording UI interactions:

```bash
kusho record
```

#### Recording Options

```bash
# Record from specific URL
kusho record https://example.com

# Record with device emulation
kusho record --device "iPhone 13" https://example.com

# Record with custom viewport
kusho record --viewport "1280,720" https://example.com
```

### Demo

Try the recorder with Playwright's demo site:

```bash
kusho demo
```

### Step 3: Review & Edit Tests

After recording, Kusho AI generates comprehensive test scenarios that open in your terminal editor:

**What you can do:**
- **Review Generated Tests**: See all test variations created from your recording
- **Edit Existing Tests**: Modify selectors, assertions, or test logic as needed
- **Add New Tests**: Create additional test scenarios for edge cases
- **Remove Unwanted Tests**: Delete any test scenarios you don't need

**Editor Quick Commands:**
- **Vim**: Press `i` to edit, `Esc` then `:wq` to save and exit
- **Nano**: Edit normally, `Ctrl+X` then `Y` then `Enter` to save
- **Vi**: Press `i` to edit, `Esc` then `:wq` to save and exit

**Save the file to proceed to test generation.**

### Step 4: Generate Exhaustive Test Script

Kusho combines your recording and customized tests to create a comprehensive, executable test script. This process:
- Merges your original recording with customized test scenarios
- Creates multiple test variations and edge cases
- Converts everything into optimized Playwright code
- Generates a comprehensive test script ready for execution

### Extend Existing Test File (Advanced)

For advanced users, extend an existing test file with KushoAI variations:

```bash
kusho extend path/to/your/test.js

kusho extend latest  # to extend the latest recording
```

### Step 5: Run Tests

Execute your generated test suite and get comprehensive reports:

```bash
# Interactive test selection (recommended)
kusho run

# Run latest test
kusho run latest

# Run specific test
kusho run your-test-name

# Run with additional options
kusho run your-test-name --headed --record
```

**Run Options:**
- `--headed`: Run tests in visible browser (great for debugging)
- `--record`: Record videos and screenshots during test execution
- `--device`: Test on specific device emulations

**Test Reports:**
After running tests, you'll get comprehensive reports with:
- Detailed test execution results and pass/fail status
- Screenshots and videos of test runs (if `--record` flag used)
- Performance metrics and timing information
- Error details and debugging information
- HTML report accessible via browser

### Update Credentials

Update your KushoAI credentials anytime:

```bash
kusho credentials
```

### Run Extended Tests

Run tests from the extended-tests folder:

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
