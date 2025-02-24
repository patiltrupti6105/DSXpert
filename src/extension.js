"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) {k2 = k;}
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) {k2 = k;}
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) {if (Object.prototype.hasOwnProperty.call(o, k)) {ar[ar.length] = k;}}
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) {return mod;}
        var result = {};
        if (mod !== null) {for (var k = ownKeys(mod), i = 0; i < k.length; i++) {if (k[i] !== "default") {__createBinding(result, mod, k[i]);}}}
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
exports.detectLanguage = detectLanguage;
exports.getOptimizedCode = getOptimizedCode;
const vscode = __importStar(require("vscode"));
const generative_ai_1 = require("@google/generative-ai");
const dotenv = __importStar(require("dotenv"));
// ✅ Load environment variables
console.log("🟡 Loading .env file...");
dotenv.config(); // Ensure this runs before accessing environment variables
// ✅ Debugging Log: Check if .env loaded correctly
console.log("📌 Loaded ENV Variables:", Object.keys(process.env));
// ✅ Fetch API key
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ API key not found! Check your .env file.");
    throw new Error("API key not found. Set GEMINI_API_KEY in your .env file.");
}
else {
    console.log("✅ API key loaded successfully!");
}
const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
// ✅ Debugging Log: Confirm AI Model is initialized
console.log("🚀 GoogleGenerativeAI Model Initialized");
// Function to detect programming language
function detectLanguage(code) {
    const languagePatterns = {
        'python': /def\s+\w+\s*\(/,
        'java': /public\s+class\s+|void\s+main\s*\(/,
        'cpp': /#include\s+<.*>|int\s+main\s*\(/,
        'javascript': /function\s+\w+\s*\(|const\s+\w+\s*=\s*\(\)\s*=>/,
        'csharp': /using\s+System;|class\s+\w+\s*{|static\s+void\s+Main\s*\(/,
        'ruby': /def\s+\w+|class\s+\w+|module\s+\w+/,
        'php': /<\?php|function\s+\w+\s*\(/,
        'swift': /import\s+Foundation|func\s+\w+\s*\(/,
        'go': /package\s+main|func\s+main\s*\(/,
        'rust': /fn\s+main\s*\(/,
    };
    for (const [lang, pattern] of Object.entries(languagePatterns)) {
        if (pattern.test(code)) {
            console.log(`🔍 Detected Language: ${lang}`);
            return lang;
        }
    }
    console.log("⚠️ Unknown Language Detected");
    return 'unknown';
}
// AI-Powered Code Optimizer
async function getOptimizedCode(userCode) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const language = detectLanguage(userCode);
        const prompt = `
        You are an AI that automatically optimizes and transforms ${language} code by selecting the best data structures dynamically.

        **Requirements:**
        1. Detect the programming language.
        2. Identify inefficient data structures used in the code.
        3. Replace them with optimized alternatives based on:
           - Space and time complexity
           - Input size
           - Readability and maintainability
        4. Ensure correctness and functionality remain unchanged.
        5. Return the transformed code, explaining the changes made.

        **Input Code:**
        \`\`\`${language}
        ${userCode}
        \`\`\`

        **Optimized Code:**`;
        console.log("⚙️ Generating optimized code...");
        const result = await model.generateContent(prompt);
        if (!result.response || !result.response.text) {
            throw new Error("Invalid response from AI model.");
        }
        console.log("✅ Code optimization successful!");
        return result.response.text();
    }
    catch (error) {
        console.error("❌ Error generating optimized code:", error);
        return "Error generating optimized code.";
    }
}
// Register VS Code Command
function activate(context) {
    console.log("🟢 Extension Activated: DSXpert");
    let disposable = vscode.commands.registerCommand("dsxpert.optimizeCode", async () => {
        console.log("🔹 Running Code Optimization Command...");
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        const userCode = editor.document.getText(editor.selection);
        if (!userCode) {
            vscode.window.showErrorMessage("Please select some code first.");
            return;
        }
        vscode.window.showInformationMessage("Optimizing code...");
        console.log("📥 User Code Selected: ", userCode.substring(0, 100) + "...");
        const optimizedCode = await getOptimizedCode(userCode);
        if (!optimizedCode || optimizedCode.includes("Error")) {
            vscode.window.showErrorMessage("Failed to optimize code.");
            return;
        }
        editor.edit(editBuilder => {
            editBuilder.replace(editor.selection, optimizedCode);
        });
        vscode.window.showInformationMessage("Code optimized successfully!");
        console.log("✅ Code Optimization Complete!");
    });
    context.subscriptions.push(disposable);
}
function deactivate() {
    console.log("🔴 Extension Deactivated: DSXpert");
}
//# sourceMappingURL=extension.js.map