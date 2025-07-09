const fs = require('fs');

class WaitEnhancer {
  constructor() {
    this.waitPatterns = {
      // Wait for navigation after clicks on links/buttons
      navigation: {
        pattern: /(page\.click\(['"`][^'"`]*['"`]\);)/g,
        replacement: (match, click) => `${click}\n  await page.waitForLoadState('networkidle');`
      },
      
      // Wait for API responses after form submissions
      formSubmission: {
        pattern: /(page\.click\(['"`][^'"`]*submit[^'"`]*['"`]\);)/gi,
        replacement: (match, click) => `${click}\n  await page.waitForLoadState('networkidle');`
      },
      
      // Add waitForSelector for dynamic content
      dynamicContent: {
        pattern: /(page\.locator\(['"`]([^'"`]*loading[^'"`]*|[^'"`]*spinner[^'"`]*|[^'"`]*progress[^'"`]*)['"`]\))/gi,
        replacement: (match, locator, selector) => 
          `await page.waitForSelector('${selector}', { state: 'hidden' });\n  ${locator}`
      },
      
      // Wait for responses after API calls
      apiWait: {
        pattern: /(page\.click\(['"`][^'"`]*['"`]\);)/g,
        replacement: (match, click) => {
          // Check if this might trigger an API call
          if (match.includes('search') || match.includes('filter') || match.includes('load')) {
            return `${click}\n  await page.waitForResponse(response => response.status() === 200);`;
          }
          return match;
        }
      }
    };
  }

  enhanceCode(code) {
    let enhancedCode = code;
    
    // Apply each enhancement pattern
    for (const [name, pattern] of Object.entries(this.waitPatterns)) {
      if (typeof pattern.replacement === 'function') {
        enhancedCode = enhancedCode.replace(pattern.pattern, pattern.replacement);
      } else {
        enhancedCode = enhancedCode.replace(pattern.pattern, pattern.replacement);
      }
    }
    
    // Add intelligent waits for common scenarios
    enhancedCode = this.addContextualWaits(enhancedCode);
    
    return enhancedCode;
  }

  addContextualWaits(code) {
    const lines = code.split('\n');
    const enhancedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      enhancedLines.push(line);
      
      // Add waits after specific actions
      if (line.includes('page.fill(') && lines[i + 1] && lines[i + 1].includes('page.click(')) {
        enhancedLines.push('  await page.waitForTimeout(100); // Allow for input validation');
      }
      
      if (line.includes('page.selectOption(')) {
        enhancedLines.push('  await page.waitForLoadState(\'domcontentloaded\');');
      }
      
      if (line.includes('page.goto(')) {
        enhancedLines.push('  await page.waitForLoadState(\'networkidle\');');
      }
    }
    
    return enhancedLines.join('\n');
  }

  // Add web-first assertions for better stability
  addWebFirstAssertions(code) {
    const assertions = [
      {
        pattern: /(page\.locator\(['"`]([^'"`]*)['"`]\))/g,
        replacement: (match, locator, selector) => {
          return `${locator}\n  await expect(page.locator('${selector}')).toBeVisible();`;
        }
      }
    ];
    
    let enhancedCode = code;
    assertions.forEach(assertion => {
      enhancedCode = enhancedCode.replace(assertion.pattern, assertion.replacement);
    });
    
    return enhancedCode;
  }

  // Analyze code patterns to suggest optimal waits
  analyzeAndSuggestWaits(code) {
    const suggestions = [];
    
    // Check for rapid successive clicks
    const clicks = code.match(/page\.click\(/g) || [];
    if (clicks.length > 3) {
      suggestions.push('Consider adding waitForResponse() between rapid clicks');
    }
    
    // Check for form interactions
    if (code.includes('page.fill(') && code.includes('page.click(')) {
      suggestions.push('Form detected: Consider adding validation waits');
    }
    
    // Check for navigation patterns
    if (code.includes('page.goto(') || code.includes('href')) {
      suggestions.push('Navigation detected: Consider waitForLoadState(\'networkidle\')');
    }
    
    return suggestions;
  }
}

module.exports = WaitEnhancer;