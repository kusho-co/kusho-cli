#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const KushoRecorder = require('./recorder');

program
  .name('kusho')
  .description('CLI tool for recording UI interactions as Playwright code')
  .version('1.0.0');

program
  .command('record')
  .description('Start recording UI interactions')
  .argument('[url]', 'URL to start recording from')
  .option('-d, --device <device>', 'Device to emulate (e.g., "iPhone 13")')
  .option('-v, --viewport <size>', 'Viewport size (e.g., "1280,720")', '1280,720')
  .option('-t, --target <lang>', 'Target language (javascript, python, etc.)', 'javascript')
  .option('-o, --output <filename>', 'Output filename for generated code')
  .option('--no-wait-enhancement', 'Disable intelligent wait enhancement')
  .action(async (url, options) => {
    const recorder = new KushoRecorder();
    
    // Configure wait enhancement
    if (!options.waitEnhancement) {
      recorder.enableWaitEnhancement = false;
    }
    
    // Set up code update handler
    recorder.onUpdate((code) => {
      // Save to custom file if specified
      if (options.output) {
        recorder.saveCodeToFile(options.output);
      }
    });

    try {
      await recorder.startRecording(url, options);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Received interrupt signal...'));
        const finalCode = recorder.stopRecording();
        
        if (finalCode && options.output) {
          recorder.saveCodeToFile(options.output);
        }
        
        console.log(chalk.green('✅ Recording session completed!'));
        process.exit(0);
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('Demo the recorder with a sample URL')
  .action(async () => {
    console.log(chalk.blue('🚀 Starting demo with KushoAI...'));
    
    const recorder = new KushoRecorder();
    await recorder.startRecording('https://demo.playwright.dev/todomvc');
  });

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();