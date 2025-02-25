import * as vscode from "vscode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as prettier from "prettier";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

console.log("✅ Loaded ENV File: ", process.env.GEMINI_API_KEY ? "Success" : "Failed");

// Retrieve the API key from environment variables
const API_KEY: string | undefined = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ API key not found! Check your .env file.");
    throw new Error("API key not found. Set GEMINI_API_KEY in your .env file.");
} else {
    console.log("✅ API key loaded successfully!");
}

// Initialize Google Generative AI model
const genAI = new GoogleGenerativeAI(API_KEY);
console.log("🚀 GoogleGenerativeAI Model Initialized");

// Supported programming languages for validation
const SUPPORTED_LANGUAGES = new Set([
    'python', 'java', 'cpp', 'javascript', 'typescript',
    'csharp', 'ruby', 'php', 'swift', 'go', 'rust'
]);

// Interface for syntax issues
interface SyntaxIssue {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

// Interface for validation results
interface ValidationResult {
    isValid: boolean;
    issues: SyntaxIssue[];
    rawResponse?: string;
}

/**
 * Detects the programming language of the given code snippet using Gemini AI.
 * @param code The code snippet to analyze.
 * @returns The detected programming language or 'unknown' if unsupported.
 */
async function detectLanguage(code: string): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Determine the programming language of the following code snippet. 
            Respond ONLY with the language name in lowercase, nothing else.
            
            Code:\n${code}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();
        
        // Sanitize and validate Gemini's response
        const detectedLang = text.replace(/[^a-z#+]/g, '') // Remove special characters
                               .replace(/(sharp)/g, 'csharp') // Fix C# variations
                               .replace(/(js|typescript)/g, m => 
                                   m === 'js' ? 'javascript' : 'typescript');

        console.log(`🔍 Gemini Detected Language: ${detectedLang}`);

        // Validate against supported languages
        if (SUPPORTED_LANGUAGES.has(detectedLang)) {
            return detectedLang;
        }
        
        console.warn(`⚠️ Unsupported language detected: ${detectedLang}`);
        return 'unknown';

    } catch (error) {
        console.error("❌ Language detection failed:", error);
        return 'unknown';
    }
}

/**
 * Generates an explanation for the optimizations made to the code.
 * @param originalCode The original code snippet.
 * @param optimizedCode The optimized code snippet.
 * @param language The programming language of the code.
 * @returns A string explaining the optimizations.
 */
async function generateOptimizationExplanation(
    originalCode: string,
    optimizedCode: string,
    language: string
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Explain the optimizations made to the following ${language} code. Focus on the changes made and why they improve the code.

        Original Code:
        ${originalCode}

        Optimized Code:
        ${optimizedCode}

        Explanation of Optimizations:`;

        const result = await model.generateContent(prompt);
        const explanation = result.response.text().trim();
        return explanation;
    } catch (error) {
        console.error("Failed to generate optimization explanation:", error);
        return "Optimizations were made to improve the code's performance and readability."; // Fallback explanation
    }
}

/**
 * Optimizes the given code snippet and provides an explanation.
 * @param userCode The code snippet to optimize.
 * @param retries The number of retry attempts in case of failure.
 * @returns An object containing the optimized code and its explanation.
 */
async function getOptimizedCode(
    userCode: string,
    retries: number = 3
): Promise<{ code: string; explanation: string }> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < retries) {
        try {
            // Notify the user that optimization has started
            vscode.window.showInformationMessage("Optimization process started...");

            // Detect the language of the user code
            const language = await detectLanguage(userCode);
            vscode.window.showInformationMessage(`Detected Language: ${language}`);

            // Validate the syntax of the user code
            const validation = await validateSyntax(userCode, language);
            if (!validation.isValid) {
                const issues = validation.issues.map(i => `Line ${i.line}: ${i.message}`).join('\n');
                throw new Error(`Original code has syntax issues:\n${issues}`);
            }

            // Placeholder for optimization logic
            let optimizedCode = userCode; // Replace with actual optimization logic

            // Refine the optimized code based on language-specific rules
            optimizedCode = refineOptimizedCode(optimizedCode, language);

            // Validate the optimized code
            const optimizedValidation = await validateSyntax(optimizedCode, language);
            if (!optimizedValidation.isValid) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    reportSyntaxIssues(optimizedValidation.issues, editor.document);
                }
                throw new Error("Optimized code contains syntax errors");
            }

            // Format the optimized code
            optimizedCode = await formatCode(optimizedCode, language);

            // Generate explanation for the optimizations made
            const explanation = await generateOptimizationExplanation(userCode, optimizedCode, language);

            // Notify the user that optimization is complete
            vscode.window.showInformationMessage("Optimization complete!");

            // Return the optimized code and explanation
            return { code: optimizedCode, explanation };
        } catch (error) {
            lastError = error as Error;
            attempts++;
            console.warn(`Attempt ${attempts} failed: ${lastError.message}`);
            if (attempts >= retries) {
                throw new Error(`Failed after ${retries} attempts. Last error: ${lastError.message}`);
            }
        }
    }

    throw new Error("Unexpected error: Function exited without returning a result.");
}

/**
 * Refines the optimized code based on language-specific rules.
 * @param code The optimized code snippet.
 * @param language The programming language of the code.
 * @returns The refined code snippet.
 */
function refineOptimizedCode(code: string, language: string): string {
    if (language === "java") {
        code = code.replace(/\bArrayList\b/g, "LinkedList");
    } else if (language === "python") {
        if (code.includes("if x in list_name")) {
            code = code.replace(/\blist\((.*?)\)/g, "set($1)");
        }
    } else if (language === "cpp") {
        code = code.replace(/\bvector<int>\b/g, "unordered_set<int>");
    }
    return code;
}

/**
 * Validates the syntax of the given code snippet.
 * @param code The code snippet to validate.
 * @param language The programming language of the code.
 * @returns A ValidationResult object indicating whether the code is valid and any issues found.
 */
async function validateSyntax(code: string, language: string): Promise<ValidationResult> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Act as a ${language} compiler. Analyze this code strictly for syntax errors.
Rules:
1. Respond ONLY in JSON format
2. Use this structure: { "issues": { "line": number, "column": number, "message": string, "severity": "error"|"warning" }[] }
3. Line numbers start at 1
4. Column numbers start at 1
5. Be strict about language specifications
6. Mark semantic errors as warnings

Code:
${code}

JSON Response:`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Clean Gemini's response
        const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const validation = JSON.parse(jsonString) as ValidationResult;
        
        // Add fallback to traditional validation
        if (!validation.issues || validation.issues.length === 0) {
            return await traditionalSyntaxCheck(code, language);
        }

        return {
            isValid: validation.issues.every(i => i.severity !== 'error'),
            issues: validation.issues,
            rawResponse: responseText
        };
    } catch (error) {
        console.error("AI Syntax Check Failed:", error);
        return await traditionalSyntaxCheck(code, language);
    }
}

/**
 * Traditional syntax check as a fallback when AI validation fails.
 * @param code The code snippet to validate.
 * @param language The programming language of the code.
 * @returns A ValidationResult object indicating whether the code is valid and any issues found.
 */
async function traditionalSyntaxCheck(code: string, language: string): Promise<ValidationResult> {
    try {
        // Existing syntax check logic
        if (language === 'javascript') {
            new Function(code);
            return { isValid: true, issues: [] };
        }
        // Add other language checks...
        return { isValid: true, issues: [] };
    } catch (error) {
        return {
            isValid: false,
            issues: [{
                line: 1,
                column: 1,
                message: error instanceof Error ? error.message : 'Unknown syntax error',
                severity: 'error'
            }]
        };
    }
}

/**
 * Reports syntax issues in the code to the VSCode editor.
 * @param issues The list of syntax issues.
 * @param document The VSCode document containing the code.
 */
function reportSyntaxIssues(issues: SyntaxIssue[], document: vscode.TextDocument) {
    const diagnostics: vscode.Diagnostic[] = [];
    
    issues.forEach(issue => {
        const line = document.lineAt(issue.line - 1);
        const range = new vscode.Range(
            new vscode.Position(issue.line - 1, issue.column - 1),
            line.range.end
        );
        
        const diagnostic = new vscode.Diagnostic(
            range,
            issue.message,
            issue.severity === 'error' ? 
                vscode.DiagnosticSeverity.Error : 
                vscode.DiagnosticSeverity.Warning
        );
        
        diagnostics.push(diagnostic);
    });

    const collection = vscode.languages.createDiagnosticCollection('ai-syntax');
    collection.set(document.uri, diagnostics);
}

/**
 * Formats the given code snippet based on the programming language.
 * @param code The code snippet to format.
 * @param language The programming language of the code.
 * @returns The formatted code snippet.
 */
async function formatCode(code: string, language: string): Promise<string> {
    try {
        if (language === "javascript" || language === "typescript") {
            return await prettier.format(code, { parser: "babel" });
        }
        return code;
    } catch (error) {
        console.error("⚠️ Formatting failed. Returning unformatted code.");
        return code;
    }
}

/**
 * Activates the VSCode extension.
 * @param context The VSCode extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    // Register the "Optimize Code" command
    context.subscriptions.push(
        vscode.commands.registerCommand('dsxpert.optimizeCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No active editor found.");
                return;
            }

            const userCode = editor.document.getText();
            try {
                // Show a progress notification
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Optimizing Code...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ message: "Detecting language..." });
                    const { code, explanation } = await getOptimizedCode(userCode);

                    // Show the optimized code and explanation in a webview
                    const panel = vscode.window.createWebviewPanel(
                        'optimizationResult',
                        'Optimization Result',
                        vscode.ViewColumn.Beside,
                        {
                            enableScripts: true // Enable JavaScript in the webview
                        }
                    );

                    // Set the HTML content for the webview
                    panel.webview.html = getWebviewContent(code, explanation);

                    // Handle messages from the webview
                    panel.webview.onDidReceiveMessage(async (message) => {
                        switch (message.command) {
                            case 'accept':
                                // Replace the editor's content with the optimized code
                                const edit = new vscode.WorkspaceEdit();
                                const document = editor.document;
                                const fullRange = new vscode.Range(
                                    document.positionAt(0),
                                    document.positionAt(userCode.length)
                                );
                                edit.replace(document.uri, fullRange, code);
                                await vscode.workspace.applyEdit(edit);
                                vscode.window.showInformationMessage("Optimized code accepted!");
                                panel.dispose(); // Close the webview
                                break;

                            case 'reject':
                                vscode.window.showInformationMessage("Optimized code rejected.");
                                panel.dispose(); // Close the webview
                                break;
                        }
                    });
                });
            } catch (error) {
                const errorMessage = (error as Error).message;
                vscode.window.showErrorMessage(`Failed to optimize code: ${errorMessage}`);
            }
        })
    );

    // Register the "Validate Syntax" command
    context.subscriptions.push(
        vscode.commands.registerCommand('dsxpert.validateSyntax', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            const validation = await validateSyntax(
                editor.document.getText(),
                await detectLanguage(editor.document.getText())
            );
            
            reportSyntaxIssues(validation.issues, editor.document);
        })
    );
}

/**
 * Generates HTML content for the webview displaying the optimization result.
 * @param code The optimized code snippet.
 * @param explanation The explanation of the optimizations.
 * @returns The HTML content for the webview.
 */
function getWebviewContent(code: string, explanation: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Optimization Result</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                    line-height: 1.6;
                }
                h1 {
                    color: #569cd6;
                    font-size: 24px;
                    margin-bottom: 16px;
                }
                h2 {
                    color: #569cd6;
                    font-size: 20px;
                    margin-top: 24px;
                    margin-bottom: 12px;
                }
                pre {
                    background-color: #252526;
                    padding: 12px;
                    border-radius: 6px;
                    overflow-x: auto;
                    font-family: 'Consolas', 'Courier New', monospace;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 16px;
                }
                .actions {
                    margin-top: 24px;
                    display: flex;
                    gap: 12px;
                }
                button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background-color 0.2s ease;
                }
                .accept {
                    background-color: #4CAF50;
                    color: white;
                }
                .accept:hover {
                    background-color: #45a049;
                }
                .reject {
                    background-color: #f44336;
                    color: white;
                }
                .reject:hover {
                    background-color: #e53935;
                }
            </style>
        </head>
        <body>
            <h1>Optimization Result</h1>
            <pre>${code}</pre>
            <h2>Optimizations Made</h2>
            <pre>${explanation}</pre>
            <div class="actions">
                <button class="accept" onclick="accept()">Accept</button>
                <button class="reject" onclick="reject()">Reject</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                function accept() {
                    vscode.postMessage({ command: 'accept' });
                }
                function reject() {
                    vscode.postMessage({ command: 'reject' });
                }
            </script>
        </body>
        </html>
    `;
}

/**
 * Deactivates the VSCode extension.
 */
export function deactivate(): void {
    console.log("🛑 Extension Deactivated: DSXpert");
}

// Export functions for testing or external use
export { detectLanguage, getOptimizedCode };