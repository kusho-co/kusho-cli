const spawn = require("cross-spawn");
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const https = require('https');
const http = require('http');
const WaitEnhancer = require('./wait-enhancer');

// Set KUSHO_API_URL env var to point at a different backend (e.g. localhost:8080 for dev)
const _apiUrl = process.env.KUSHO_API_URL || 'https://be.kusho.ai';
const _parsedUrl = new URL(_apiUrl);
const BASE_URL = _parsedUrl.hostname;
const PORT = parseInt(_parsedUrl.port) || (_parsedUrl.protocol === 'https:' ? 443 : 80);
const USE_HTTPS = _parsedUrl.protocol === 'https:';

class KushoRecorder {
  constructor() {
    this.testsDir = path.join(__dirname, 'kusho-tests');
    this.outputFile = path.join(this.testsDir, 'recordings', 'generated-test.js');
    this.recordingDir = path.join(this.testsDir, 'recordings');
    this.extendedDir = path.join(this.testsDir, 'extended-tests');
    this.codegenProcess = null;
    this.watcher = null;
    this.onCodeUpdate = null;
    this.currentCode = '';
    this.waitEnhancer = new WaitEnhancer();
    this.enableWaitEnhancement = true;
    this.credentialsFile = path.join(process.env.HOME || process.env.USERPROFILE, '.kusho-credentials');
  }

  async startRecording(url = '', options = {}) {
    // Ensure recordings directory exists
    if (!fs.existsSync(this.recordingDir)) {
      fs.mkdirSync(this.recordingDir, { recursive: true });
    }

    // Clear previous recording
    if (fs.existsSync(this.outputFile)) {
      fs.unlinkSync(this.outputFile);
    }

    console.log(chalk.blue('🎬 Starting KushoAI recorder...'));
    
    const args = [
      'playwright',
      'codegen',
      '--output', this.outputFile,
      '--target', options.target || 'javascript',
      '--viewport-size', options.viewport || '1280,720'
    ];

    // Add device emulation if specified
    if (options.device) {
      args.push('--device', options.device);
    }

    // Add URL if provided
    if (url) {
      args.push(url);
    }

    // Start codegen process
    this.codegenProcess = spawn('npx', args, {
      stdio: 'inherit',
      shell: true
    });

    // Handle process events
    this.codegenProcess.on('error', (error) => {
      console.error(chalk.red('❌ Failed to start recorder:'), error.message);
    });

    this.codegenProcess.on('close', (code) => {
      this.stopWatching();
      this.promptForFilename();
    });

    // Start watching for file changes
    this.watchForChanges();

    return new Promise((resolve) => {
      // Wait a bit for the process to start
      setTimeout(() => {
        console.log(chalk.green('✅ KushoAI recorder started! Interact with the browser to generate code.'));
        resolve();
      }, 2000);
    });
  }

  watchForChanges() {
    // Poll for file existence first
    const checkFile = () => {
      if (fs.existsSync(this.outputFile)) {
        this.startFileWatcher();
      } else {
        setTimeout(checkFile, 500);
      }
    };
    
    checkFile();
  }

  startFileWatcher() {
    
    this.watcher = fs.watch(this.outputFile, (eventType) => {
      if (eventType === 'change') {
        try {
          const newCode = fs.readFileSync(this.outputFile, 'utf8');
          
          // Only process if code actually changed
          if (newCode !== this.currentCode) {
            this.currentCode = newCode;
            this.handleCodeUpdate(newCode);
          }
        } catch (error) {
          // File might be temporarily locked, ignore
        }
      }
    });
  }

  handleCodeUpdate(code) {
    // Enhance code with intelligent waits if enabled
    let finalCode = code;
    if (this.enableWaitEnhancement) {
      finalCode = this.waitEnhancer.enhanceCode(code);
      
      // Show suggestions
      const suggestions = this.waitEnhancer.analyzeAndSuggestWaits(code);
      if (suggestions.length > 0) {
        console.log(chalk.yellow('💡 Suggestions:'));
        suggestions.forEach(s => console.log(chalk.yellow(`  • ${s}`)));
      }
    }
    
    // Wrap code in a test function
    finalCode = this.wrapInTestFunction(finalCode);
    
    console.log(chalk.gray('─'.repeat(50)));
    console.log(finalCode);
    console.log(chalk.gray('─'.repeat(50)));
    
    // Update current code with enhanced version
    this.currentCode = finalCode;
    
    // Call user-defined callback if provided
    if (this.onCodeUpdate) {
      this.onCodeUpdate(finalCode);
    }
  }

  stopRecording() {
    
    if (this.codegenProcess) {
      this.codegenProcess.kill();
      this.codegenProcess = null;
    }
    
    this.stopWatching();
    
    // Return final code
    if (fs.existsSync(this.outputFile)) {
      return fs.readFileSync(this.outputFile, 'utf8');
    }
    
    return this.currentCode;
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  getCurrentCode() {
    return this.currentCode;
  }

  saveCodeToFile(filename) {
    const fullPath = path.join(this.recordingDir, filename);
    fs.writeFileSync(fullPath, this.currentCode);
    console.log(chalk.green(`💾 Code saved to: ${fullPath}`));
    return fullPath;
  }

  // Set callback for code updates
  onUpdate(callback) {
    this.onCodeUpdate = callback;
  }

  promptForFilename() {
    if (!this.currentCode || this.currentCode.trim() === '') {
      console.log(chalk.yellow('⚠️  No code to save'));
      return;
    }

    console.log(chalk.green('✅ Recording completed!'));
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(chalk.cyan('💾 Enter filename for your test (without extension): '), (filename) => {
      rl.close();
      
      if (!filename || filename.trim() === '') {
        // Generate default filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `kusho-test-${timestamp}`;
      }

      // Ensure .test.js extension for Playwright
      if (!filename.endsWith('.test.js')) {
        if (filename.endsWith('.js')) {
          filename = filename.replace('.js', '.test.js');
        } else {
          filename += '.test.js';
        }
      }

      // Save to unique file
      const finalPath = this.saveCodeToUniqueFile(filename);
      console.log(chalk.green(`🎉 Test saved successfully!`));
      console.log(chalk.blue(`📁 File location: ${finalPath}`));
      
      // Open editor for user to edit the file
      this.openEditorInTerminal(finalPath);
    });
  }

  saveCodeToUniqueFile(filename) {
    let counter = 1;
    let baseName = filename.replace('.test.js', '');
    let finalFilename = filename;
    let fullPath = path.join(this.recordingDir, finalFilename);

    // Check if file exists and create unique name
    while (fs.existsSync(fullPath)) {
      finalFilename = `${baseName}-${counter}.test.js`;
      fullPath = path.join(this.recordingDir, finalFilename);
      counter++;
    }

    fs.writeFileSync(fullPath, this.currentCode);
    
    // Track recording step completion
    this.trackUserStep('record');
    
    return fullPath;
  }

  openEditorInTerminal(filePath) {
    console.log(chalk.blue('📝 Opening editor...'));
    console.log(chalk.gray('Press Ctrl+X to exit nano, or :wq to exit vim'));
    
    // Try terminal-based editors in order of preference
    const terminalEditors = ['vim', 'nano', 'vi'];
    
    this.tryTerminalEditor(filePath, terminalEditors, 0);
  }

  tryTerminalEditor(filePath, editors, index) {
    if (index >= editors.length) {
      console.log(chalk.yellow('⚠️  No terminal editor found'));
      console.log(chalk.cyan(`📁 You can manually edit: ${filePath}`));
      return;
    }

    const editor = editors[index];
    const editorProcess = spawn(editor, [filePath], { 
      stdio: 'inherit'  // This allows the editor to take control of the terminal
    });

    editorProcess.on('error', (error) => {
      // Try next editor if current one fails
      this.tryTerminalEditor(filePath, editors, index + 1);
    });

    editorProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ File edited successfully!'));

        // Prompt for generation request before generation starts
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(chalk.cyan('\n💬 What should Kusho generate from this recording? (Press Enter for default single-file generation): '), (answer) => {
          rl.close();
          const instructions = answer.trim();
          if (instructions) console.log(chalk.cyan(`📋 Request noted: ${instructions}`));
          this.extendScriptWithAPI(filePath, instructions);
        });
      } else {
        console.log(chalk.yellow('⚠️  Editor exited with errors while saving recording'));
      }
    });
  }

  async getCredentials() {
    try {
      if (fs.existsSync(this.credentialsFile)) {
        const data = fs.readFileSync(this.credentialsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Error reading credentials file'));
    }
    
    return await this.promptForCredentials();
  }

  async promptForCredentials() {
    console.log(chalk.blue('🔐 KushoAI credentials required for script extension'));
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.cyan('📧 Enter your email: '), (email) => {
        rl.question(chalk.cyan('🔑 Enter your auth token: '), (token) => {
          rl.close();
          
          const credentials = { email, token };
          
          // Save credentials to file
          try {
            fs.writeFileSync(this.credentialsFile, JSON.stringify(credentials, null, 2));
            console.log(chalk.green('✅ Credentials saved successfully!'));
            
            // Track credentials step completion
            this.trackUserStep('credentials', credentials);
          } catch (error) {
            console.log(chalk.yellow('⚠️  Warning: Could not save credentials'));
          }
          
          resolve(credentials);
        });
      });
    });
  }

  async promptForNewFilename(currentFilename) {
    console.log(chalk.blue('📝 Please provide a new filename for the extended test'));
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.cyan(`💾 Enter new filename (current: ${currentFilename}): `), (newFilename) => {
        rl.close();
        
        if (!newFilename || newFilename.trim() === '') {
          resolve(null); // User wants to cancel
          return;
        }
        
        let finalFilename = newFilename.trim();
        
        // Ensure .test.js extension if the original had it
        if (currentFilename.endsWith('.test.js') && !finalFilename.endsWith('.test.js')) {
          if (finalFilename.endsWith('.js')) {
            finalFilename = finalFilename.replace('.js', '.test.js');
          } else {
            finalFilename += '.test.js';
          }
        } else if (currentFilename.endsWith('.js') && !finalFilename.endsWith('.js')) {
          finalFilename += '.js';
        }
        
        // Check if the new filename also exists
        const newPath = path.join(this.extendedDir, finalFilename);
        if (fs.existsSync(newPath)) {
          console.log(chalk.red(`❌ File ${finalFilename} also exists. Please choose a different name.`));
          resolve(null);
        } else {
          resolve(finalFilename);
        }
      });
    });
  }

  async promptForGenerationRequest() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.cyan('\n💬 What should Kusho generate from this recording? (Press Enter for default single-file generation): '), (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  shouldUseBundleDirectory(plan) {
    if (!plan || !Array.isArray(plan.files)) {
      return false;
    }

    return plan.files.length > 1 || plan.files.some(file => (file.path || '').includes('/'));
  }

  getSuitePreviewLines(plan) {
    const useBundleDirectory = this.shouldUseBundleDirectory(plan);
    const rootName = useBundleDirectory ? (plan.bundle_name || 'generated-suite') : '';
    const lines = [];

    if (useBundleDirectory) {
      lines.push(path.join('kusho-tests', 'extended-tests', rootName) + '/');
      plan.files.forEach(file => {
        lines.push(`  ${file.path}`);
      });
      return lines;
    }

    plan.files.forEach(file => {
      lines.push(path.join('kusho-tests', 'extended-tests', file.path));
    });
    return lines;
  }

  displaySuitePlan(plan) {
    console.log(chalk.blue('\n🧭 Proposed output:'));
    this.getSuitePreviewLines(plan).forEach(line => {
      console.log(chalk.cyan(`  ${line}`));
    });
    if (plan.summary) {
      console.log(chalk.gray(`Summary: ${plan.summary}`));
    }
  }

  async promptForPlanDecision() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.yellow('Accept plan? [Y/refine/n]: '), (answer) => {
        const trimmed = answer.trim().toLowerCase();

        if (!trimmed || trimmed === 'y' || trimmed === 'yes') {
          rl.close();
          resolve({ action: 'accept' });
          return;
        }

        if (trimmed === 'n' || trimmed === 'no' || trimmed === 'cancel') {
          rl.close();
          resolve({ action: 'cancel' });
          return;
        }

        if (trimmed === 'r' || trimmed === 'refine') {
          rl.question(chalk.cyan('Refine the plan: '), (refinement) => {
            rl.close();
            resolve({ action: 'refine', refinement: refinement.trim() });
          });
          return;
        }

        rl.close();
        resolve({ action: 'accept' });
      });
    });
  }

  async planStructuredSuite(originalScript, credentials, initialInstructions) {
    let instructions = (initialInstructions || '').trim();

    if (!instructions) {
      return { instructions: '', suitePlan: null };
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      console.log(chalk.blue('🧭 Planning test suite structure...'));
      const loadingInterval = this.showLoadingIndicator('Planning file layout...');

      try {
        const response = await this.callPlanTestSuiteAPI(originalScript, credentials, instructions);
        clearInterval(loadingInterval);
        process.stdout.write('\n');

        const suitePlan = response.suite_plan;
        this.displaySuitePlan(suitePlan);

        const decision = await this.promptForPlanDecision();
        if (decision.action === 'accept') {
          return { instructions, suitePlan };
        }

        if (decision.action === 'cancel') {
          return null;
        }

        if (decision.action === 'refine' && decision.refinement) {
          instructions = `${instructions}\nAdditional refinement: ${decision.refinement}`;
          continue;
        }

        return { instructions, suitePlan };
      } catch (error) {
        clearInterval(loadingInterval);
        process.stdout.write('\n');
        throw error;
      }
    }

    throw new Error('Too many planning refinements requested');
  }

  async extendScriptWithAPI(filePath, instructions) {
    console.log(chalk.blue('🚀 Extending script with KushoAI variations...'));
    
    try {
      // Get credentials
      const credentials = await this.getCredentials();
      
      // Read current file content
      const currentContent = fs.readFileSync(filePath, 'utf8');

      let generationRequest = instructions;
      if (generationRequest === undefined) {
        generationRequest = await this.promptForGenerationRequest();
      }

      let suitePlan = null;
      let structuredGenerationRequested = false;
      generationRequest = (generationRequest || '').trim();

      if (generationRequest) {
        console.log(chalk.cyan(`📋 Request noted: ${generationRequest}`));
        structuredGenerationRequested = true;
        try {
          const planningResult = await this.planStructuredSuite(currentContent, credentials, generationRequest);
          if (!planningResult) {
            console.log(chalk.red('❌ Extension cancelled'));
            return;
          }
          generationRequest = planningResult.instructions;
          suitePlan = planningResult.suitePlan;
        } catch (error) {
          structuredGenerationRequested = false;
          suitePlan = null;
          console.log(chalk.yellow(`⚠️  Structured planning unavailable, falling back to single-file generation: ${error.message}`));
        }
      }
      
      // Step 1: Generate test cases
      const testCases = await this.generateTestCases(currentContent, credentials, generationRequest);
      
      // Step 2: Let user edit test cases
      const editedTestCases = await this.editTestCases(testCases);

      let saveResult;
      let remaining;

      if (suitePlan) {
        try {
          const structuredSuite = await this.generateStructuredTestSuite(currentContent, editedTestCases, suitePlan, credentials, generationRequest);
          remaining = structuredSuite.remaining;
          saveResult = this.saveStructuredSuite(filePath, structuredSuite.suite, generationRequest);
        } catch (error) {
          if (!structuredGenerationRequested) {
            throw error;
          }

          console.log(chalk.yellow(`⚠️  Structured generation failed, falling back to single-file output: ${error.message}`));
          suitePlan = null;
        }
      }

      if (!suitePlan) {
        const {extendedScript, remaining: singleFileRemaining} = await this.generateExtendedScript(currentContent, editedTestCases, credentials, generationRequest);
        remaining = singleFileRemaining;

        let extendedFilePath = this.createExtendedFilePath(filePath);

        if (fs.existsSync(extendedFilePath)) {
          const currentFilename = path.basename(extendedFilePath);
          console.log(chalk.yellow(`⚠️  File already exists: ${currentFilename}`));

          const newFilename = await this.promptForNewFilename(currentFilename);
          if (newFilename) {
            extendedFilePath = path.join(this.extendedDir, newFilename);
          } else {
            console.log(chalk.red('❌ Extension cancelled'));
            return;
          }
        }

        fs.writeFileSync(extendedFilePath, extendedScript);
        saveResult = { outputPath: extendedFilePath, manifestPath: null, filesWritten: [extendedFilePath] };
      }

      console.log(chalk.green('🎉 Script extended successfully!'));
      console.log(chalk.blue(`📁 Original file preserved: ${filePath}`));
      console.log(chalk.blue(`📁 Generated output saved: ${saveResult.outputPath}`));
      if (saveResult.manifestPath) {
        console.log(chalk.blue(`📄 Bundle manifest: ${saveResult.manifestPath}`));
      }
      console.log(chalk.cyan(`📦 Files written: ${saveResult.filesWritten.length}`));
      console.log(chalk.yellow(`# No. of generations remaining: ${remaining}`));
      console.log(chalk.gray('💡 Tip: Use `kusho edit` to make further changes to generated files.'));
      
      // Track generation step completion
      this.trackUserStep('generation');
      
    } catch (error) {
      console.log(chalk.red('❌ Error extending script:'), error.message);
      console.log(chalk.blue(`📁 Original file preserved: ${filePath}`));
    }
  }

  async generateTestCases(scriptContent, credentials, instructions = '') {
    console.log(chalk.blue('🎯 Generating test cases...'));
    
    // Start loading indicator
    const loadingInterval = this.showLoadingIndicator('Analyzing script and generating test cases...');
    
    try {
      const testCases = await this.callTestCasesAPI(scriptContent, credentials, instructions);
      
      // Stop loading indicator
      clearInterval(loadingInterval);
      process.stdout.write('\n');
      
      console.log(chalk.green('✅ Test cases generated successfully!'));
      return testCases;
      
    } catch (error) {
      clearInterval(loadingInterval);
      process.stdout.write('\n');
      throw error;
    }
  }

  async editTestCases(testCases) {
    console.log(chalk.blue('📝 Opening test cases for review...'));
    
    // Create temporary file for test cases
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempFile = path.join(tempDir, `test-cases-${timestamp}.txt`);
    
    // Write test cases to temp file
    fs.writeFileSync(tempFile, testCases);
    
    console.log(chalk.yellow('💡 Review and edit the test cases. Save and exit when done.'));
    console.log(chalk.gray('Each line represents a test case to be generated.'));
    
    // Open editor for test cases
    await this.openEditorForFile(tempFile);
    
    // Read edited test cases
    const editedTestCases = fs.readFileSync(tempFile, 'utf8');
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log(chalk.green('✅ Test cases reviewed and saved!'));
    
    // Track tests step completion
    this.trackUserStep('tests');
    
    return editedTestCases;
  }

  async generateExtendedScript(originalScript, testCases, credentials, instructions = '') {
    console.log(chalk.blue('🔨 Generating extended test script...'));
    
    // Start loading indicator
    const loadingInterval = this.showLoadingIndicator('Creating test variations...');
    
    try {
      const {extended_script: extendedScript, remaining_generations: remaining} = await this.callGenerateScriptAPI(originalScript, testCases, credentials, instructions);
      
      // Stop loading indicator
      clearInterval(loadingInterval);
      process.stdout.write('\n');
      
      console.log(chalk.green('✅ Extended script generated successfully!'));
      return {extendedScript, remaining};
      
    } catch (error) {
      clearInterval(loadingInterval);
      process.stdout.write('\n');
      throw error;
    }
  }

  async generateStructuredTestSuite(originalScript, testCases, suitePlan, credentials, instructions = '') {
    console.log(chalk.blue('🧱 Generating structured test suite...'));

    const loadingInterval = this.showLoadingIndicator('Creating grouped test files...');

    try {
      const response = await this.callGenerateStructuredSuiteAPI(originalScript, testCases, suitePlan, credentials, instructions);
      clearInterval(loadingInterval);
      process.stdout.write('\n');

      if (!response.success || !Array.isArray(response.files) || response.files.length === 0) {
        throw new Error(response.error || 'Invalid structured suite response');
      }

      console.log(chalk.green('✅ Structured test suite generated successfully!'));
      return {
        suite: {
          bundle_name: response.bundle_name,
          summary: response.summary,
          files: response.files,
        },
        remaining: response.remaining_generations,
      };
    } catch (error) {
      clearInterval(loadingInterval);
      process.stdout.write('\n');
      throw error;
    }
  }

  showLoadingIndicator(message = 'Kusho is thinking...') {
    const emojiFrames = ['🤖', '🧠', '💡', '🧪', '💨', '🔪', '🌀', '🔍'];
    const classicFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const frames = [...emojiFrames, ...classicFrames];
    const spinnerWidth = 4;
    let frameIndex = 0;
  
    return setInterval(() => {
      const frame = frames[frameIndex % frames.length];
      const paddedFrame = frame.padEnd(spinnerWidth, ' ');
      process.stdout.write(`\r${paddedFrame}${chalk.green(message)}`);
      frameIndex++;
    }, 120);
  }

  async openEditorForFile(filePath) {
    console.log(chalk.blue('📝 Opening editor...'));
    console.log(chalk.gray('Press Ctrl+X to exit nano, or :wq to exit vim'));
    
    // Try terminal-based editors in order of preference
    const terminalEditors = ['vim', 'nano', 'vi'];
    
    return new Promise((resolve, reject) => {
      this.tryTerminalEditorForFile(filePath, terminalEditors, 0, resolve, reject);
    });
  }

  tryTerminalEditorForFile(filePath, editors, index, resolve, reject) {
    if (index >= editors.length) {
      reject(new Error('No terminal editor found'));
      return;
    }

    const editor = editors[index];
    const editorProcess = spawn(editor, [filePath], { 
      stdio: 'inherit'  // This allows the editor to take control of the terminal
    });

    editorProcess.on('error', (error) => {
      // Try next editor if current one fails
      this.tryTerminalEditorForFile(filePath, editors, index + 1, resolve, reject);
    });

    editorProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ File edited successfully!'));
        resolve();
      } else {
        reject(new Error('Editor exited with errors while saving tests'));
      }
    });
  }

  async callTestCasesAPI(scriptContent, credentials, instructions = '') {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        script: scriptContent,
        ...(instructions && { instructions })
      });

      const options = {
        hostname: BASE_URL,
        port: PORT,
        path: '/ui-testing-v2/generate-test-cases',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Email': credentials.email,
          'X-Auth-Token': credentials.token
        },
        rejectUnauthorized: false
      };

      const req = (USE_HTTPS ? https : http).request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              if (response.success && response.test_cases) {
                resolve(response.test_cases);
              } else {
                reject(new Error('Invalid response format from test cases API'));
              }
            } catch (error) {
              reject(new Error('Failed to parse test cases response'));
            }
          } else {
            reject(new Error(`Test cases API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async callPlanTestSuiteAPI(scriptContent, credentials, instructions = '') {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        script: scriptContent,
        ...(instructions && { instructions })
      });

      const options = {
        hostname: BASE_URL,
        port: PORT,
        path: '/ui-testing-v2/plan-test-suite',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Email': credentials.email,
          'X-Auth-Token': credentials.token
        },
        rejectUnauthorized: false
      };

      const req = (USE_HTTPS ? https : http).request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              if (response.success && response.suite_plan) {
                resolve(response);
              } else {
                reject(new Error(response.error || 'Invalid response format from suite planning API'));
              }
            } catch (error) {
              reject(new Error('Failed to parse suite planning response'));
            }
          } else {
            reject(new Error(`Suite planning API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async callGenerateScriptAPI(originalScript, testCases, credentials, instructions = '') {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        script: originalScript,
        test_cases: testCases,
        ...(instructions && { instructions })
      });

      const options = {
        hostname: BASE_URL,
        port: PORT,
        path: '/ui-testing-v2/generate-test-scripts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Email': credentials.email,
          'X-Auth-Token': credentials.token
        },
        rejectUnauthorized: false
      };

      const req = (USE_HTTPS ? https : http).request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (error) {
              resolve(data); // Return raw data if not JSON, maybe fail here
            }
          } else {
            reject(new Error(`Generate script API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async callGenerateStructuredSuiteAPI(originalScript, testCases, suitePlan, credentials, instructions = '') {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        script: originalScript,
        test_cases: testCases,
        suite_plan: suitePlan,
        ...(instructions && { instructions })
      });

      const options = {
        hostname: BASE_URL,
        port: PORT,
        path: '/ui-testing-v2/generate-structured-test-suite',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Email': credentials.email,
          'X-Auth-Token': credentials.token
        },
        rejectUnauthorized: false
      };

      const req = (USE_HTTPS ? https : http).request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error('Failed to parse structured suite response'));
            }
          } else {
            reject(new Error(`Structured suite API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async callEditScriptAPI(script, instruction, credentials) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        script,
        instruction
      });

      const options = {
        hostname: BASE_URL,
        port: PORT,
        path: '/ui-testing-v2/edit-test-script',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Email': credentials.email,
          'X-Auth-Token': credentials.token
        },
        rejectUnauthorized: false
      };

      const req = (USE_HTTPS ? https : http).request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              if (response.success && response.edited_script) {
                resolve(response);
              } else {
                reject(new Error(response.error || 'Invalid response from edit API'));
              }
            } catch (error) {
              reject(new Error('Failed to parse edit script response'));
            }
          } else {
            reject(new Error(`Edit script API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async postGenerationEditLoop(filePath, credentials) {
    console.log(chalk.blue('\n✏️  Edit mode'));
    console.log(chalk.gray('Request changes to the generated tests in plain English.'));
    console.log(chalk.gray('Examples: "add assertions for the page title", "add error case for empty password"'));
    console.log(chalk.gray('Type "done" or leave blank to finish.\n'));

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = () => new Promise((res) => rl.question(chalk.cyan('✏️  Edit instruction (or "done" to exit): '), res));

    while (true) {
      const instruction = (await ask()).trim();

      if (!instruction || instruction.toLowerCase() === 'done' || instruction.toLowerCase() === 'exit') {
        rl.close();
        console.log(chalk.green('\n✅ Finished! Your tests are ready.'));
        console.log(chalk.blue(`📁 Final file: ${filePath}`));
        break;
      }

      console.log(chalk.blue(`\n🔧 Applying: "${instruction}"...`));
      const loadingInterval = this.showLoadingIndicator('Applying edits...');

      try {
        const currentScript = fs.readFileSync(filePath, 'utf8');
        const result = await this.callEditScriptAPI(currentScript, instruction, credentials);
        clearInterval(loadingInterval);
        process.stdout.write('\n');
        fs.writeFileSync(filePath, result.edited_script);
        console.log(chalk.green('✅ Edit applied successfully!'));
        if (result.remaining_generations !== null && result.remaining_generations !== undefined) {
          console.log(chalk.yellow(`# No. of generations remaining: ${result.remaining_generations}`));
        }
      } catch (error) {
        clearInterval(loadingInterval);
        process.stdout.write('\n');
        console.log(chalk.red(`❌ Edit failed: ${error.message}`));
        console.log(chalk.gray('File was not modified. Try a different instruction.'));
      }
    }
  }

  async editExtendedScript(filePath) {
    console.log(chalk.blue(`\n✏️  Editing extended script: ${filePath}`));
    try {
      if (fs.statSync(filePath).isDirectory()) {
        console.log(chalk.yellow('⚠️  Selected path is a generated bundle directory. Choose a file inside the bundle to edit.'));
        return;
      }

      const credentials = await this.getCredentials();
      await this.postGenerationEditLoop(filePath, credentials);
    } catch (error) {
      console.log(chalk.red('❌ Error editing script:'), error.message);
    }
  }

  async updateCredentials() {
    console.log(chalk.blue('🔐 Update KushoAI credentials'));
    const credentials = await this.promptForCredentials();
    return credentials;
  }

  wrapInTestFunction(code) {
    // Check if code is already wrapped in a test function
    if (code.includes('test(') || code.includes('describe(')) {
      return code;
    }

    // Extract the main functionality (skip imports and setup)
    const lines = code.split('\n');
    let testStartIndex = 0;
    let imports = '';
    let setup = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('const ') || line.startsWith('require(')) {
        imports += lines[i] + '\n';
        testStartIndex = i + 1;
      } else if (line.includes('test =') || line.includes('browser =') || line.includes('context =')) {
        setup += lines[i] + '\n';
        testStartIndex = i + 1;
      } else if (line.length > 0) {
        break;
      }
    }

    let testCode = lines.slice(testStartIndex).join('\n');

    // Playwright codegen often emits an async IIFE. Await it so the outer test
    // does not finish early and trigger worker teardown mid-recording.
    testCode = testCode.replace(/^(\s*)\(async\s*\(\)\s*=>\s*\{/gm, '$1await (async () => {');
    
    // Create wrapped test function
    const wrappedCode = `${imports}
const { test, expect } = require('@playwright/test');

test('KushoAI Generated Test', async ({ page }) => {
${testCode.split('\n').map(line => line.trim() ? '  ' + line : line).join('\n')}
});`;

    return wrappedCode;
  }

  createExtendedFilePath(originalPath) {
    // Ensure extended-tests directory exists
    if (!fs.existsSync(this.extendedDir)) {
      fs.mkdirSync(this.extendedDir, { recursive: true });
    }
    
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    
    // Handle both .js and .test.js extensions, preserve original filename
    if (originalPath.endsWith('.test.js')) {
      const nameWithoutTestExt = baseName.replace(/\.test$/, '');
      return path.join(this.extendedDir, `${nameWithoutTestExt}.test.js`);
    } else {
      return path.join(this.extendedDir, `${baseName}${ext}`);
    }
  }

  sanitizeGeneratedRelativePath(relativePath, index = 0) {
    const rawPath = (relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
    const fallback = `generated-${index + 1}.test.js`;
    const sourcePath = rawPath || fallback;
    const segments = sourcePath.split('/').filter(Boolean).map((segment) => {
      if (segment === '.' || segment === '..') {
        throw new Error('Invalid generated file path');
      }

      const safeSegment = segment.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '');
      if (!safeSegment) {
        throw new Error('Invalid generated file path');
      }

      return safeSegment;
    });

    if (segments.length === 0) {
      return fallback;
    }

    return path.join(...segments);
  }

  splitGeneratedFilename(filename) {
    if (filename.endsWith('.test.js')) {
      return {
        name: filename.slice(0, -8),
        extension: '.test.js'
      };
    }

    const extension = path.extname(filename) || '.js';
    return {
      name: filename.slice(0, -extension.length) || filename,
      extension
    };
  }

  resolveSafeOutputPath(baseDir, relativePath) {
    const resolvedBaseDir = path.resolve(baseDir);
    const resolvedPath = path.resolve(baseDir, relativePath);

    if (resolvedPath !== resolvedBaseDir && !resolvedPath.startsWith(`${resolvedBaseDir}${path.sep}`)) {
      throw new Error('Generated file path escapes output directory');
    }

    return resolvedPath;
  }

  createUniqueOutputFilePath(baseDir, relativePath) {
    const safeRelativePath = this.sanitizeGeneratedRelativePath(relativePath);
    const targetPath = this.resolveSafeOutputPath(baseDir, safeRelativePath);
    if (!fs.existsSync(targetPath)) {
      return targetPath;
    }

    const directory = path.dirname(targetPath);
    const { name, extension } = this.splitGeneratedFilename(path.basename(targetPath));
    let counter = 1;

    while (true) {
      const candidatePath = path.join(directory, `${name}-${counter}${extension}`);
      if (!fs.existsSync(candidatePath)) {
        return candidatePath;
      }
      counter++;
    }
  }

  createUniqueBundleDirectory(bundleName) {
    if (!fs.existsSync(this.extendedDir)) {
      fs.mkdirSync(this.extendedDir, { recursive: true });
    }

    const safeBundleName = (bundleName || 'generated-suite').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '') || 'generated-suite';
    let bundlePath = path.join(this.extendedDir, safeBundleName);
    let counter = 1;

    while (fs.existsSync(bundlePath)) {
      bundlePath = path.join(this.extendedDir, `${safeBundleName}-${counter}`);
      counter++;
    }

    fs.mkdirSync(bundlePath, { recursive: true });
    return bundlePath;
  }

  saveStructuredSuite(originalPath, suite, instructions = '') {
    const files = Array.isArray(suite.files) ? suite.files : [];
    if (files.length === 0) {
      throw new Error('Structured suite did not contain any files');
    }

    const useBundleDirectory = this.shouldUseBundleDirectory(suite);
    const filesWritten = [];

    if (useBundleDirectory) {
      const bundleRoot = this.createUniqueBundleDirectory(suite.bundle_name);

      files.forEach((file, index) => {
        const safeRelativePath = this.sanitizeGeneratedRelativePath(file.path, index);
        const fullPath = this.resolveSafeOutputPath(bundleRoot, safeRelativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.content, 'utf8');
        filesWritten.push(fullPath);
      });

      const manifestPath = path.join(bundleRoot, '.kusho-bundle.json');
      const manifest = {
        bundle_name: path.basename(bundleRoot),
        summary: suite.summary || '',
        source_recording: path.relative(__dirname, originalPath),
        instructions,
        files: filesWritten.map(filePath => path.relative(bundleRoot, filePath)),
        generated_at: new Date().toISOString()
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      return {
        outputPath: bundleRoot,
        manifestPath,
        filesWritten
      };
    }

    const file = files[0];
    const safeRelativePath = this.sanitizeGeneratedRelativePath(file.path, 0);
    const fullPath = this.createUniqueOutputFilePath(this.extendedDir, safeRelativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, 'utf8');
    filesWritten.push(fullPath);

    return {
      outputPath: fullPath,
      manifestPath: null,
      filesWritten
    };
  }

  getExtendedEntries(currentDir = this.extendedDir, prefix = '') {
    if (!fs.existsSync(currentDir)) {
      return [];
    }

    const entries = [];

    fs.readdirSync(currentDir, { withFileTypes: true }).forEach((entry) => {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;

      if (entry.isDirectory()) {
        entries.push(...this.getExtendedEntries(absolutePath, relativePath));
        return;
      }

      if (!entry.isFile()) {
        return;
      }

      if (!entry.name.endsWith('.test.js') && !entry.name.endsWith('.js')) {
        return;
      }

      const stats = fs.statSync(absolutePath);
      entries.push({
        name: relativePath,
        path: absolutePath,
        mtime: stats.mtime
      });
    });

    return entries.sort((a, b) => b.mtime - a.mtime);
  }

  isRunnableExtendedEntry(filePath) {
    if (filePath.endsWith('.test.js')) {
      return true;
    }

    if (!filePath.endsWith('.js')) {
      return false;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.includes('test(') || content.includes('describe(');
    } catch (error) {
      return false;
    }
  }

  getRunnableExtendedEntries() {
    return this.getExtendedEntries().filter(entry => this.isRunnableExtendedEntry(entry.path));
  }

  getLatestRecording() {
    try {
      if (!fs.existsSync(this.recordingDir)) {
        return null;
      }

      const files = fs.readdirSync(this.recordingDir)
        .filter(file => file.endsWith('.test.js') || file.endsWith('.js'))
        .map(file => {
          const filePath = path.join(this.recordingDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            mtime: stats.mtime
          };
        })
        .sort((a, b) => b.mtime - a.mtime);

      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      return null;
    }
  }

  async runTest(filePath, options = {}) {
    console.log(chalk.blue('🧪 Running Playwright test...'));
    console.log(chalk.gray(`📁 Path: ${filePath}`));
    // Track run step completion
    this.trackUserStep('run');

    const stats = fs.statSync(filePath);
    const isDirectory = stats.isDirectory();
    
    // Check if file needs to be wrapped in test function
    if (!isDirectory) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.includes('test(') && !content.includes('describe(')) {
        console.log(chalk.yellow('⚠️  File is not in test format, converting...'));
        const wrappedContent = this.wrapInTestFunction(content);
        fs.writeFileSync(filePath, wrappedContent);
        console.log(chalk.green('✅ File converted to test format'));
      }
    }
    
    // Determine which project to use based on file path and options
    const project = this.getProjectName(filePath, options);
    
    // Use relative path to file within the project directory
    const relativePath = this.getRelativePathForProject(filePath, project);
    const args = ['playwright', 'test', `--project=${project}`];
    if (relativePath) {
      args.push(relativePath);
    }
    
    // Add headed/headless option
    if (options.headed) {
      args.push('--headed');
      console.log(chalk.cyan('👁️  Running in headed mode (browser visible)'));
    } else {
      console.log(chalk.cyan('🔍 Running in headless mode'));
    }

    // Show recording info if enabled
    if (options.record) {
      console.log(chalk.magenta('🎥 Recording test run (video + trace)'));
      const testResultsDir = path.join(process.cwd(), 'test-results');
      console.log(chalk.gray(`📁 Results will be saved to: ${testResultsDir}`));
    }

    // Use the configured HTML reporter from playwright.config.js
    // (removing --reporter=line override to allow HTML report generation)

    console.log(chalk.gray(`🚀 Using project: ${project}`));

    return new Promise((resolve, reject) => {
      const testProcess = spawn('npx', args, {
        stdio: 'inherit',
        cwd: process.cwd() // Ensure we're in the right directory
      });

      testProcess.on('error', (error) => {
        reject(new Error(`Failed to run test: ${error.message}`));
      });

      testProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('✅ Test completed successfully!'));
          if (options.record) {
            this.showRecordingResults();
          }
          resolve();
        } else {
          console.log(chalk.yellow(`⚠️  Test finished with exit code: ${code}`));
          if (options.record) {
            this.showRecordingResults();
          }
          resolve(); // Don't reject, as test failures are normal
        }
      });
    });
  }

  getProjectName(filePath, options) {
    const isRecording = filePath.includes(path.join('kusho-tests', 'recordings'));
    const isExtended = filePath.includes(path.join('kusho-tests', 'extended-tests'));
    
    if (isRecording) {
      return options.record ? 'recordings-record' : 'recordings';
    } else if (isExtended) {
      return options.record ? 'extended-record' : 'extended';
    } else {
      // Fallback for files outside standard directories
      return options.record ? 'recordings-record' : 'recordings';
    }
  }

  getRelativePathForProject(filePath, project) {
    const projectRoot = project.startsWith('extended') ? this.extendedDir : this.recordingDir;
    const relativePath = path.relative(projectRoot, filePath);
    return relativePath || null;
  }

  showRecordingResults() {
    const testResultsDir = path.join(process.cwd(), 'test-results');
    
    if (fs.existsSync(testResultsDir)) {
      console.log(chalk.green('📹 Test recording completed!'));
      console.log(chalk.blue('🔍 View results:'));
      
      // Find trace files
      const traceFiles = fs.readdirSync(testResultsDir, { recursive: true })
        .filter(file => file.toString().endsWith('.zip'))
        .slice(0, 3); // Show only latest 3
      
      traceFiles.forEach(file => {
        console.log(chalk.cyan(`  • npx playwright show-trace test-results/${file}`));
      });
      
      // Find video files
      const videoFiles = fs.readdirSync(testResultsDir, { recursive: true })
        .filter(file => file.toString().endsWith('.webm'))
        .slice(0, 3); // Show only latest 3
      
      if (videoFiles.length > 0) {
        console.log(chalk.blue('🎬 Video recordings:'));
        videoFiles.forEach(file => {
          console.log(chalk.cyan(`  • test-results/${file}`));
        });
      }
    }
  }

  getRecordingPath(filename) {
    // Handle different filename formats
    if (filename.endsWith('.test.js')) {
      return path.join(this.recordingDir, filename);
    } else if (filename.endsWith('.js')) {
      return path.join(this.recordingDir, filename);
    } else {
      // Try .test.js first, then .js
      const testPath = path.join(this.recordingDir, `${filename}.test.js`);
      if (fs.existsSync(testPath)) {
        return testPath;
      }
      return path.join(this.recordingDir, `${filename}.js`);
    }
  }

  getExtendedPath(filename) {
    const normalizedFilename = filename.replace(/\\/g, path.sep).replace(/^\.[/\\]/, '');
    const directPath = path.join(this.extendedDir, normalizedFilename);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    if (!normalizedFilename.endsWith('.test.js') && !normalizedFilename.endsWith('.js')) {
      const testPath = path.join(this.extendedDir, `${normalizedFilename}.test.js`);
      if (fs.existsSync(testPath)) {
        return testPath;
      }

      const jsPath = path.join(this.extendedDir, `${normalizedFilename}.js`);
      if (fs.existsSync(jsPath)) {
        return jsPath;
      }
    }

    const normalizedUnix = normalizedFilename.replace(/\\/g, '/');
    const entries = this.getExtendedEntries();
    const exactMatch = entries.find(entry => entry.name.replace(/\\/g, '/') === normalizedUnix);
    if (exactMatch) {
      return exactMatch.path;
    }

    const matchingEntries = entries.filter(entry => {
      const baseName = path.basename(entry.name);
      return baseName === normalizedFilename || baseName === `${normalizedFilename}.test.js` || baseName === `${normalizedFilename}.js`;
    });

    if (matchingEntries.length === 1) {
      return matchingEntries[0].path;
    }

    return path.join(this.extendedDir, normalizedFilename);
  }

  listRecordings() {
    if (!fs.existsSync(this.recordingDir)) {
      console.log(chalk.gray('  No recordings folder found'));
      return;
    }

    const files = fs.readdirSync(this.recordingDir)
      .filter(file => file.endsWith('.test.js') || file.endsWith('.js'))
      .map(file => {
        const filePath = path.join(this.recordingDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          mtime: stats.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime) // Sort by creation time (newest first)
      .map(item => item.name);

    if (files.length === 0) {
      console.log(chalk.gray('  No recordings found'));
    } else {
      files.forEach(file => {
        console.log(chalk.cyan(`  • ${file}`));
      });
    }
  }

  listExtendedTests() {
    if (!fs.existsSync(this.extendedDir)) {
      console.log(chalk.gray('  No extended-tests folder found'));
      return;
    }

    const files = this.getRunnableExtendedEntries().map(item => item.name);

    if (files.length === 0) {
      console.log(chalk.gray('  No extended tests found'));
    } else {
      files.forEach(file => {
        console.log(chalk.cyan(`  • ${file}`));
      });
    }
  }

  async chooseExtendedTest() {
    if (!fs.existsSync(this.extendedDir)) {
      console.log(chalk.red('❌ No extended-tests folder found'));
      return null;
    }

    const files = this.getRunnableExtendedEntries().map(item => item.name);

    if (files.length === 0) {
      console.log(chalk.red('❌ No extended tests found'));
      return null;
    }

    console.log(chalk.blue('📋 Available extended tests:'));
    files.forEach((file, index) => {
      console.log(chalk.cyan(`  ${index + 1}. ${file}`));
    });
    console.log(chalk.cyan(`  ${files.length + 1}. latest`));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.yellow('Select a test (number or name): '), (answer) => {
        rl.close();
        
        const trimmed = answer.trim();
        
        // Check if it's a number
        const num = parseInt(trimmed);
        if (!isNaN(num)) {
          if (num >= 1 && num <= files.length) {
            resolve(files[num - 1]);
            return;
          } else if (num === files.length + 1) {
            resolve('latest');
            return;
          }
        }
        
        // Check if it's a filename
        if (trimmed === 'latest') {
          resolve('latest');
          return;
        }
        
        const matchingFile = files.find(file => 
          file === trimmed || 
          file === `${trimmed}.test.js` || 
          file === `${trimmed}.js`
        );
        
        if (matchingFile) {
          resolve(matchingFile);
        } else {
          console.log(chalk.red('❌ Invalid selection'));
          resolve(null);
        }
      });
    });
  }

  async chooseRecording() {
    if (!fs.existsSync(this.recordingDir)) {
      console.log(chalk.red('❌ No recordings folder found'));
      return null;
    }

    const files = fs.readdirSync(this.recordingDir)
      .filter(file => file.endsWith('.test.js') || file.endsWith('.js'))
      .map(file => {
        const filePath = path.join(this.recordingDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          mtime: stats.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime) // Sort by creation time (newest first)
      .map(item => item.name);

    if (files.length === 0) {
      console.log(chalk.red('❌ No recordings found'));
      return null;
    }

    console.log(chalk.blue('📋 Available recordings:'));
    files.forEach((file, index) => {
      console.log(chalk.cyan(`  ${index + 1}. ${file}`));
    });
    console.log(chalk.cyan(`  ${files.length + 1}. latest`));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(chalk.yellow('Select a recording (number or name): '), (answer) => {
        rl.close();
        
        const trimmed = answer.trim();
        
        // Check if it's a number
        const num = parseInt(trimmed);
        if (!isNaN(num)) {
          if (num >= 1 && num <= files.length) {
            resolve(files[num - 1]);
            return;
          } else if (num === files.length + 1) {
            resolve('latest');
            return;
          }
        }
        
        // Check if it's a filename
        if (trimmed === 'latest') {
          resolve('latest');
          return;
        }
        
        const matchingFile = files.find(file => 
          file === trimmed || 
          file === `${trimmed}.test.js` || 
          file === `${trimmed}.js`
        );
        
        if (matchingFile) {
          resolve(matchingFile);
        } else {
          console.log(chalk.red('❌ Invalid selection'));
          resolve(null);
        }
      });
    });
  }

  getLatestExtendedTest() {
    try {
      const files = this.getRunnableExtendedEntries();

      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      return null;
    }
  }

  async trackUserStep(step, credentials = null) {
    try {
      // Get credentials if not provided
      if (!credentials) {
        credentials = await this.getCredentials();
      }

      const postData = JSON.stringify({
        step: step
      });

      const options = {
        hostname: BASE_URL,
        port: PORT,
        path: '/ui-testing-v2/user/status',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-User-Email': credentials.email,
          'X-Auth-Token': credentials.token
        },
        rejectUnauthorized: false
      };

      return new Promise((resolve, reject) => {
        const req = (USE_HTTPS ? https : http).request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              // console.log(chalk.gray(`📊 Step tracked: ${step}`));
              resolve(data);
            } else {
              // Don't throw error for tracking failures, just log
              console.log(chalk.gray(`⚠️  Failed to track step: ${step}`));
              resolve(null);
            }
          });
        });

        req.on('error', (error) => {
          // Don't throw error for tracking failures, just log
          console.log(chalk.gray(`⚠️  Error tracking step: ${step}`));
          resolve(null);
        });

        req.write(postData);
        req.end();
      });
    } catch (error) {
      // Don't throw error for tracking failures, just log
      console.log(chalk.gray(`⚠️  Error tracking step: ${step}`));
      return null;
    }
  }
}

module.exports = KushoRecorder;
