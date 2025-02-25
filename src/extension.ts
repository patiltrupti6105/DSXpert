import * as vscode from "vscode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as prettier from "prettier";
import * as dotenv from "dotenv";
import { getWebviewContent } from "./webview";
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
    'csharp', 'ruby', 'php', 'swift', 'go', 'rust', 'c', 'c++'
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-002" });
        const prompt = `Determine the programming language of the following code snippet. 
            Respond ONLY with the language name in lowercase, nothing else.
            
            Code:\n${code}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().toLowerCase();

        // Sanitize and validate Gemini's response
        const detectedLang = text
            .replace(/[^a-z#+]/g, '') // Remove special characters
            .replace(/(sharp)/g, 'csharp') // Fix C# variations
            .replace(/(cpp|c\+\+)/g, 'cpp') // Fix C++ variations
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-002" });
        const prompt = `
        Explain how the following ${language} code was optimized by changing data structures. Follow these rules:
        1. Clearly describe the inefficient data structures in the original code.
        2. Explain why the new data structures are more efficient in terms of time and space complexity.
        3. Provide a step-by-step explanation of the changes made.
        4. Use simple, human-readable language.
        5. Ensure the explanation is complete and not truncated.

        Original Code:
        ${originalCode}

        Optimized Code:
        ${optimizedCode}

        Explanation:`;

        const result = await model.generateContent(prompt);
        const explanation = result.response.text().trim();

        // Remove Markdown formatting
        return explanation.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();
    } catch (error) {
        console.error("Failed to generate optimization explanation:", error);

        // Fallback explanation with more details
        return `The code was optimized by replacing inefficient data structures with more efficient ones. For example:
        - Arrays were replaced with hash maps for faster lookups.
        - Linked lists were replaced with arrays for better cache locality.
        - Trees were replaced with graphs for more flexible traversals.`;
    }
}
function formatExplanation(explanation: string): string {
    // Remove overly technical jargon
    explanation = explanation.replace(/time complexity of O\([^)]+\)/g, 'faster');
    explanation = explanation.replace(/space complexity of O\([^)]+\)/g, 'more memory-efficient');

    // Simplify sentences
    explanation = explanation.replace(/Therefore/g, 'So');
    explanation = explanation.replace(/However/g, 'But');

    // Ensure the explanation is concise
    const maxLength = 500; // Limit explanation length
    if (explanation.length > maxLength) {
        explanation = explanation.substring(0, maxLength) + '...';
    }

    return explanation;
}
/**
 * Optimizes the given code snippet and provides an explanation.
 * @param userCode The code snippet to optimize.
 * @param retries The number of retry attempts in case of failure.
 * @returns An object containing the optimized code and its explanation.
 */
async function getOptimizedCode(userCode: string): Promise<{ code: string; explanation: string }> {
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

        // Generate optimized code using AI
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-002" });
        const prompt = `
        Optimize the following ${language} code to improve time and space complexity by changing data structures. Follow these rules:
        1. Identify inefficient data structures (e.g., arrays, lists, etc.) and replace them with better alternatives (e.g., hash maps, priority queues, etc.).
        2. Ensure the logic and correctness remain unchanged.
        3. Respond ONLY with the optimized code.

        Original Code:
        ${userCode}

        Optimized Code:`;

        const result = await model.generateContent(prompt);
        let optimizedCode = result.response.text().trim();

        // Remove Markdown formatting (e.g., backticks)
        optimizedCode = optimizedCode.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();

        // Refine the optimized code
        optimizedCode = refineOptimizedCode(optimizedCode, language);

        // Generate a concise explanation
        const explanation = await generateOptimizationExplanation(userCode, optimizedCode, language);
        console.log("Generated Explanation:", explanation); // Debugging

        // Notify the user that optimization is complete
        vscode.window.showInformationMessage("Optimization complete!");

        return { code: optimizedCode, explanation };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to optimize code: ${error.message}`);
        } else {
            throw new Error("Failed to optimize code: Unknown error");
        }
    }
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
        // C++ specific optimizations
        code = code.replace(/\bstd::vector<int>\b/g, "std::unordered_set<int>");
        code = code.replace(/\bstd::endl\b/g, "\\n"); // Prefer newline over endl
        code = code.replace(/\bfor \(int i = 0; i < (\w+).size\(\); i\+\+\)/g, "for (auto& item : $1)"); // Range-based for loop
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-002" });
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
        if (language === 'javascript') {
            new Function(code);
            return { isValid: true, issues: [] };
        } else if (language === 'cpp') {
            // Use a C++ linter or compiler for syntax validation
            // For now, assume the code is valid
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
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Optimizing Code...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ message: "Detecting language..." });
                    const { code, explanation } = await getOptimizedCode(userCode);
                    console.log("Explanation Passed to Webview:", explanation); // Debugging
    
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
                    const stylesUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'styles.css'));
                    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'script.js'));
                    panel.webview.html = getWebviewContent(userCode, code, explanation, stylesUri, scriptUri);
    
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
}

/**
 * Generates HTML content for the webview displaying the optimization result.
 * @param code The optimized code snippet.
 * @param explanation The explanation of the optimizations.
 * @returns The HTML content for the webview.
 */

/**
 * Deactivates the VSCode extension.
 */
// Inside the activate function

export function deactivate(): void {
    console.log("🛑 Extension Deactivated: DSXpert");
}

// Export functions for testing or external use
export { detectLanguage, getOptimizedCode };