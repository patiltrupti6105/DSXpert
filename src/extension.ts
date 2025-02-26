import * as vscode from "vscode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as prettier from "prettier";
import * as dotenv from "dotenv";
import { getWebviewContent } from "./webview";
import { exec } from "child_process";
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
        const prompt = `
        Explain how the following ${language} code was optimized by replacing inefficient data structures with the **best possible alternatives**. Follow these rules:
        1. Clearly describe the inefficient data structures in the original code.(in one sentence)
        2. List all considered replacement options and explain why they were rejected or selected.(in one sentence)
        3. Justify(in short) why the selected data structures are the most optimal in terms of:
           - Time complexity (e.g., O(1), O(log n), O(n), etc.)
           - Space complexity (e.g., O(1), O(n), etc.)
           - Problem context (e.g., "Use a Trie for prefix search").
        5. Use simple, human-readable language.
        6. Ensure the explanation is complete and not truncated.

        Original Code:
        ${originalCode}

        Optimized Code:
        ${optimizedCode}

        Explanation:`;

        const result = await model.generateContent(prompt);
        const explanation = result.response.text().trim();

        console.log("Generated Explanation (Raw):", explanation); // Debugging

        // Remove Markdown formatting
        const cleanedExplanation = explanation.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();
        console.log("Generated Explanation (Cleaned):", cleanedExplanation); // Debugging

        return cleanedExplanation;
    } catch (error) {
        console.error("Failed to generate optimization explanation:", error);

        // Fallback explanation with more details
        return `The code was optimized by replacing inefficient data structures with the best possible alternatives. For example:
        - Arrays were replaced with hash maps for faster lookups.
        - Linked lists were replaced with arrays for better cache locality.
        - Trees were replaced with graphs for more flexible traversals.`;
    }
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

        // Check if optimization is possible
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
        const optimizationCheckPrompt = `
        Analyze the logic and functoinality of the following ${language} code and determine if it can be optimized by replacing inefficient data structures.
        If not, check if the code has a logic that can be optimised to better time complexity.
        If not , lastly check if code is using inbuilt functions that can be replaced by better time complexity functions in the  ${language}.
        Again go through the code, there HAS to be something that can be changed to make it more optimal (e.g. replace library functions with written code logic to reduce time complexity)
        Respond ONLY with "Yes" or "No".

        Code:
        ${userCode}

        Can it be optimized?:
        `;

        const optimizationCheckResult = await model.generateContent(optimizationCheckPrompt);
        const canOptimize = optimizationCheckResult.response.text().trim().toLowerCase() === "yes";

        if (!canOptimize) {
            // Notify the user that no optimizations were found
            vscode.window.showInformationMessage("No optimizations were found for the given code.");
            return {
                code: userCode, // Return the original code
                explanation: "No optimizations were found. The code is already optimal or cannot be further optimized by replacing data structures."
            };
        }

        // Generate optimized code using AI
        const optimizationPrompt = `
        Optimize the following ${language} code to achieve the best possible time and space complexity by replacing inefficient data structures. Follow these rules:
        1. Identify all inefficient data structures (e.g., arrays, lists, etc.) in the original code.
        2. Try to understand the logic and usage behind the code and then go ahead to figure out relevant replacements.
        3. Explore multiple replacement options (e.g., hash maps, priority queues, trees, etc.) and select the **best possible** data structure for each case.
        4.If optimising logic, strictly ensure the optimised logic (eg nested for loop -> single for loop), if has a different logic, still gives same required results.
        5.ENsure the selected data structure is the most optimal in terms of:
           - Time complexity (e.g., O(1), O(log n), O(n), etc.)
           - Space complexity (e.g., O(1), O(n), etc.)
           - Problem context (e.g., "Use a Trie for prefix search").
        6. Ensure the logic and correctness remain unchanged.
        7. Respond ONLY with the **correct and valid** optimized code.
        8. DONT include justification or anything else in code, only give raw code.
        Original Code:
        ${userCode}

        Optimized Code:`;

        const result = await model.generateContent(optimizationPrompt);
        let optimizedCode = result.response.text().trim();

        // Remove Markdown formatting (e.g., backticks)
        optimizedCode = optimizedCode.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();

        // Refine the optimized code
        optimizedCode = refineOptimizedCode(optimizedCode, language);

        // Generate a detailed explanation
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
    switch (language) {
        case "cpp":
            if (!code.includes("#include <iostream>")) {
                code = `#include <iostream>\n${code}`;
            }
            if (!code.includes("#include <array>") && code.includes("std::array")) {
                code = `#include <array>\n${code}`;
            }
            if (!code.includes("#include <unordered_set>") && code.includes("std::unordered_set")) {
                code = `#include <unordered_set>\n${code}`;
            }
            code = code.replace(/std::cout << numbers\[i\] << \\n;/g, 'std::cout << item << "\\n";');
            break;

        case "python":
            if (!code.includes("import sys") && code.includes("sys.")) {
                code = `import sys\n${code}`;
            }
            if (!code.includes("import math") && code.includes("math.")) {
                code = `import math\n${code}`;
            }
            break;

        case "java":
            if (!code.includes("import java.util.*;") && (code.includes("List") || code.includes("Set"))) {
                code = `import java.util.*;\n${code}`;
            }
            if (!code.includes("import java.io.*;") && code.includes("BufferedReader")) {
                code = `import java.io.*;\n${code}`;
            }
            break;

        case "javascript":
        case "typescript":
            if (!code.includes("import") && code.includes("require(")) {
                code = code.replace(/require\(['"](.+)['"]\)/g, `import $1`);
            }
            break;

        case "csharp":
            if (!code.includes("using System;")) {
                code = `using System;\n${code}`;
            }
            if (!code.includes("using System.Collections.Generic;") && (code.includes("List<") || code.includes("Dictionary<"))) {
                code = `using System.Collections.Generic;\n${code}`;
            }
            break;

        case "ruby":
            if (!code.includes("require 'set'") && code.includes("Set.new")) {
                code = `require 'set'\n${code}`;
            }
            break;

        case "php":
            if (!code.includes("<?php")) {
                code = `<?php\n${code}`;
            }
            break;

        case "swift":
            if (!code.includes("import Foundation") && code.includes("DateFormatter")) {
                code = `import Foundation\n${code}`;
            }
            break;

        case "go":
            if (!code.includes("import (") && code.includes("fmt.")) {
                code = `import "fmt"\n${code}`;
            }
            break;

        case "rust":
            if (!code.includes("use std::collections::HashSet;") && code.includes("HashSet")) {
                code = `use std::collections::HashSet;\n${code}`;
            }
            break;

        case "c":
        case "c++":
            if (!code.includes("#include <stdio.h>") && code.includes("printf")) {
                code = `#include <stdio.h>\n${code}`;
            }
            break;

        default:
            throw new Error("Language not supported");
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
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
interface ValidationResult {
    isValid: boolean;
    issues: SyntaxIssue[];
}

async function traditionalSyntaxCheck(code: string, language: string): Promise<ValidationResult> {
    try {
        // Format the code before checking syntax
        code = await formatCode(code, language);

        switch (language) {
            case "javascript":
            case "typescript":
                try {
                    new Function(code); // Basic syntax check
                    return { isValid: true, issues: [] };
                } catch (error) {
                    return formatError(error);
                }

            case "python":
                if (!code.includes("def ") && !code.includes("import ") && !code.includes("print(")) {
                    return formatSyntaxError("Invalid Python syntax");
                }
                break;

            case "java":
                if (!code.includes("class ") || !code.includes("public static void main")) {
                    return formatSyntaxError("Invalid Java syntax");
                }
                break;

            case "cpp":
            case "c":
            case "c++":
                if (!code.includes("#include") || !code.includes("main()")) {
                    return formatSyntaxError("Invalid C/C++ syntax");
                }
                break;

            case "csharp":
                if (!code.includes("using System;") || !code.includes("class ")) {
                    return formatSyntaxError("Invalid C# syntax");
                }
                break;

            case "ruby":
                if (!code.includes("def ") && !code.includes("puts ")) {
                    return formatSyntaxError("Invalid Ruby syntax");
                }
                break;

            case "php":
                if (!code.includes("<?php")) {
                    return formatSyntaxError("PHP code must start with <?php");
                }
                break;

            case "swift":
                if (!code.includes("import ") && !code.includes("print(")) {
                    return formatSyntaxError("Invalid Swift syntax");
                }
                break;

            case "go":
                if (!code.includes("package main") || !code.includes("func main()")) {
                    return formatSyntaxError("Invalid Go syntax");
                }
                break;

            case "rust":
                if (!code.includes("fn main()")) {
                    return formatSyntaxError("Invalid Rust syntax");
                }
                break;

            default:
                return formatSyntaxError("Unsupported language");
        }
        return { isValid: true, issues: [] };
    } catch (error) {
        return formatError(error);
    }
}
// Helper function to format error messages
function formatError(error: unknown): ValidationResult {
    return {
        isValid: false,
        issues: [{ line: 1, column: 1, message: error instanceof Error ? error.message : "Unknown syntax error", severity: "error" }]
    };
}

// Helper function to format syntax errors
function formatSyntaxError(message: string): ValidationResult {
    return {
        isValid: false,
        issues: [{ line: 1, column: 1, message, severity: "error" }]
    };
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
// Format code using appropriate formatter
async function formatCode(code: string, language: string): Promise<string> {
    return new Promise((resolve) => {
        let command = "";

        switch (language) {
            case "javascript":
            case "typescript":
                command = `npx prettier --parser ${language} --stdin-filepath temp.${language}`;
                break;
            case "python":
                command = "black -q -";
                break;
            case "java":
                command = "google-java-format -";
                break;
            case "cpp":
            case "c":
            case "c++":
                command = "clang-format";
                break;
            case "csharp":
                command = "dotnet format --folder";
                break;
            case "ruby":
                command = "ruby -c";
                break;
            case "php":
                command = "php -l";
                break;
            case "swift":
                command = "swift-format format --stdin";
                break;
            case "go":
                command = "gofmt";
                break;
            case "rust":
                command = "rustfmt";
                break;
            default:
                resolve(code); // Return unformatted code if no formatter is available
                return;
        }

        const child = exec(command, (error, stdout) => {
            if (error) {
                resolve(code);
            } else {
                if (child.stdin) {
                    child.stdin.write(code);
                    child.stdin.end();
                }
                resolve(stdout.trim());
            }
        });

        if (child.stdin) {
            child.stdin.write(code);
            child.stdin.end();
        }
    });
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

// Deactivates the VSCode extension.


export function deactivate(): void {
    console.log("🛑 Extension Deactivated: DSXpert");
}

// Export functions for testing or external use
export { detectLanguage, getOptimizedCode };