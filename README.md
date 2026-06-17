# [KushoAI CLI](https://github.com/kusho-co/kusho-cli/)

AI-powered CLI tool for recording UI interactions and generating comprehensive test suites.

KushoAI CLI takes your recorded user flows and generates exhaustive test variations. Record your user flow once, and KushoAI creates multiple test cases with different inputs, edge cases, and scenarios to provide thorough test coverage. The tool transforms manual testing into intelligent, automated test scenarios with minimal effort.

[![UI Testing](https://img.youtube.com/vi/E1yqiloZCNw/0.jpg)](https://youtu.be/u6yf9GpBANQ?si=aJlbbd1bRcaR8-tt)

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

After recording, Kusho saves the recorded Playwright script and opens it in your terminal editor for review before generation starts:

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

#### Describe What to Generate (Optional)

After you save the recorded Playwright script, KushoAI prompts for a natural-language generation request:

```
💬 What should Kusho generate from this recording? (Press Enter for default single-file generation):
```

This is your chance to tell Kusho what kind of suite to generate and how it should be organized:

```bash
# Examples of what you can enter:
"add error cases for empty fields"
"include tests for special characters in input"
"test with very long text strings"
"add negative test scenarios"
"create smoke and negative tests in separate files"
"group auth tests under auth/ and checkout tests under checkout/"
```

If you press Enter, Kusho uses the default single-file generation flow.

If you provide a request, Kusho first plans the output structure, shows you a preview, and lets you accept or refine it before generation starts.

### Step 4: Generate Exhaustive Test Script

Kusho combines your recording and reviewed test cases to create an executable Playwright output. This process:
- Merges your original recording with customized test scenarios
- Creates multiple test variations and edge cases
- Converts everything into optimized Playwright code
- Generates either a single output file or a grouped multi-file suite depending on your request

If you provide a structured request, Kusho shows a proposed output tree before generation:

```text
🧭 Proposed output:
  kusho-tests/extended-tests/checkout-suite/
    auth/login-negative.test.js
    checkout/checkout-smoke.test.js

Accept plan? [Y/refine/n]
```

Accepted multi-file generations are written as a bundle under `kusho-tests/extended-tests/<bundle-name>/`.

### Extend Existing Test File (Advanced)

For advanced users, extend an existing test file with KushoAI variations:

```bash
kusho extend path/to/your/test.js

kusho extend latest  # to extend the latest recording
```

`kusho extend` uses the same generation request flow as `kusho record`:
- Press Enter for default single-file generation
- Or describe the suite you want in natural language
- Review the proposed structure if Kusho plans multiple files

### Edit Generated Tests

After generating tests, you can iteratively refine them using natural language:

```bash
# Edit a specific test file
kusho edit your-test-name

# Edit the latest generated test
kusho edit latest

# Choose from interactive list
kusho edit
```

**Edit mode examples:**

```
✏️  Edit instruction: add assertions for page title
✏️  Edit instruction: add error case for empty password
✏️  Edit instruction: add timeout handling
✏️  Edit instruction: add screenshot on failure
```

Type `done` or leave blank to finish editing. Each edit applies your natural language instruction to modify the test file in place.

`kusho edit` currently works on one generated file at a time. If you generated a multi-file bundle, choose a file inside the bundle instead of the bundle directory itself.

### Step 5: Run Tests

Execute your generated test suite and get comprehensive reports:

```bash
# Interactive test selection (recommended)
kusho run

# Run latest test
kusho run latest

# Run specific test
kusho run your-test-name

# Run a generated bundle directory
kusho run checkout-suite

# Run a nested generated file
kusho run auth/login-negative.test.js

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

# Run a generated bundle directory
kusho run checkout-suite

# Run a nested generated file path
kusho run auth/login-negative.test.js

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

Single-file generation continues to save one file directly under `kusho-tests/extended-tests/`.

Structured multi-file generation saves a bundle directory under `kusho-tests/extended-tests/` and includes a manifest file:

```text
kusho-tests/
  extended-tests/
    checkout-suite/
      .kusho-bundle.json
      auth/
        login-negative.test.js
      checkout/
        checkout-smoke.test.js
```

Generated code is displayed in real-time in the terminal as you perform UI interactions.
