const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const WaitEnhancer = require('./wait-enhancer');

class KushoRecorder {
  constructor() {
    this.outputFile = path.join(__dirname, 'recordings', 'generated-test.js');
    this.recordingDir = path.join(__dirname, 'recordings');
    this.codegenProcess = null;
    this.watcher = null;
    this.onCodeUpdate = null;
    this.currentCode = '';
    this.waitEnhancer = new WaitEnhancer();
    this.enableWaitEnhancement = true;
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
}

module.exports = KushoRecorder;