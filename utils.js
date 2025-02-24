// Language Detection Function
function detectLanguage(code) {
    const languagePatterns = {
        'python': /def\s+\w+\s*\(/,
        'java': /public\s+class\s+|void\s+main\s*\(/,
        'cpp': /#include\s+<.*>|int\s+main\s*\(/,
        'javascript': /function\s+\w+\s*\(|const\s+\w+\s*=\s*\(\)\s*=>/,
        'csharp': /using\s+System;|class\s+\w+\s*{|static\s+void\s+Main\s*\(/,
        'ruby': /def\s+\w+|class\s+\w+|module\s+\w+/, 
        'php': /<\?php|function\s+\w+\s*\(/, 
        'swift': /import\s+Foundation|func\s+\w+\s*\(/, 
        'go': /package\s+main|func\s+main\s*\(/, 
        'rust': /fn\s+main\s*\(/
    };
    
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
        if (pattern.test(code)) {
            return lang;
        }
    }
    return 'unknown';
}