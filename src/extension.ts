import * as vscode from "vscode";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as prettier from "prettier";
import * as child_process from "child_process";
import * as dotenv from "dotenv";
dotenv.config();

console.log("✅ Loaded ENV File: ", process.env.GEMINI_API_KEY ? "Success" : "Failed");

const API_KEY: string | undefined = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("❌ API key not found! Check your .env file.");
    throw new Error("API key not found. Set GEMINI_API_KEY in your .env file.");
} else {
    console.log("✅ API key loaded successfully!");
}

const genAI = new GoogleGenerativeAI(API_KEY);
console.log("🚀 GoogleGenerativeAI Model Initialized");

function detectLanguage(code: string): string {
    const languagePatterns: Record<string, RegExp> = {
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

async function getOptimizedCode(userCode: string): Promise<{ code: string; explanation: string }> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const language = detectLanguage(userCode);
        console.log("⚙️ Generating optimized code...");

        const prompt = `
You are an AI that improves ${language} code by optimizing data structures **without changing the programming language**. 
**The output must remain in ${language}. Do NOT translate or convert it to another language.**

🚨 **STRICT RULES:**  
1. **Do NOT change the programming language.** The output must remain in ${language}.  
2. Identify inefficient data structures and replace them with better alternatives.  
3. Optimize for:
   - Time and space complexity  
   - Maintainability  
   - Readability  
4. Ensure the logic and correctness remain unchanged.
5. **At the end of the optimized code, append a multi-line comment explaining**:  
   - **What changes were made**
   - **Why the changes improve efficiency**
   - Use **language-specific multi-line comment syntax** (e.g., \`/*\` for Java, \`/*\` for Python).  
   - Do NOT use markdown.REMOVE markdown, the code SHOULD NOT CONTAIN ANY MARKDOWN in the whole code(e.g., if ''' found, remove it).
6. **DO NOT include any additional formatting markers—just the pure optimized code.** 
7.**DO NOT wrap the code or the comment in markdown(''',\`\`\`).
---

❌ **BAD EXAMPLE (Incorrect Output)**:  
_Input (Java):_  
\`\`\`java  
ArrayList<Integer> list = new ArrayList<>();  
\`\`\`  

_Output (WRONG - Converted to C#):_  
\`\`\`csharp  
List<int> list = new List<int>();  
\`\`\`  

✅ **GOOD EXAMPLE (Correct Output - Java Remains Java)**:  
\`\`\`java  
LinkedList<Integer> list = new LinkedList<>();  
\`\`\`  

---

**Input Code (must remain in ${language}):**  
\`\`\`${language}  
${userCode}  
\`\`\`  

**Optimized Code (must remain in ${language},must reduce time complexity,strictly formatted,strictly follow correct syntax in ${language} NO markdown, NO extra formatting markers, must end with a valid comment in ${language}):**  
`;

        const result = await model.generateContent(prompt);
        if (!result.response || !result.response.text) {
            throw new Error("Invalid response from AI model.");
        }
        let optimizedCode = result.response.text();

        optimizedCode = optimizedCode.replace(/^```[\w+\s]*\n|```$/g, "").trim();
        optimizedCode = optimizedCode.replace(/^'''[\w+\s]*\n|'''$/g, "").trim();

        optimizedCode = refineOptimizedCode(optimizedCode, language);

        if (!validateSyntax(optimizedCode, language)) {
            console.error("❌ AI-generated code has syntax errors. Regenerating...");
            return { code: "Error: AI-generated code contains syntax issues.", explanation: "" };
        }

        optimizedCode = await formatCode(optimizedCode, language);
        console.log("✅ Code optimization successful!");

        const explanation = extractExplanation(optimizedCode, language);
        optimizedCode = optimizedCode.replace(explanation, "").trim();

        return { code: optimizedCode, explanation };
    } catch (error) {
        console.error("❌ Error generating optimized code:", error);
        return { code: "Error generating optimized code.", explanation: "" };
    }
}

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

function validateSyntax(code: string, language: string): boolean {
    try {
        if (language === "javascript" || language === "typescript") {
            new Function(code);
        } else if (language === "python") {
            child_process.execSync("python -c \"import sys; exec(sys.stdin.read())\"", { input: code });
        } else if (language === "java") {
            child_process.execSync("javac -Xlint:none -", { input: code });
        } else if (language === "cpp") {
            child_process.execSync("g++ -fsyntax-only -xc++ -", { input: code });
        }
        return true;
    } catch (error) {
        return false;
    }
}

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

function extractExplanation(code: string, language: string): string {
    const commentPatterns: Record<string, RegExp> = {
        'python': /"""(.*?)"""/s,
        'java': /\/\*(.*?)\*\//s,
        'cpp': /\/\*(.*?)\*\//s,
        'javascript': /\/\*(.*?)\*\//s,
        'csharp': /\/\*(.*?)\*\//s,
        'ruby': /=begin(.*?)=end/s,
        'php': /\/\*(.*?)\*\//s,
        'swift': /\/\*(.*?)\*\//s,
        'go': /\/\*(.*?)\*\//s,
        'rust': /\/\*(.*?)\*\//s,
    };

    const pattern = commentPatterns[language] || /\/\*(.*?)\*\//s;
    const match = code.match(pattern);
    return match ? match[1].trim() : "";
}

function showExplanationWebview(explanation: string): void {
    const panel = vscode.window.createWebviewPanel(
        'explanationView',
        'Optimization Explanation',
        vscode.ViewColumn.Beside,
        {}
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Optimization Explanation</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    background-color: #1e1e1e;
                    color: #d4d4d4;
                }
                h1 {
                    color: #569cd6;
                }
                pre {
                    background-color: #252526;
                    padding: 10px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <h1>Optimization Explanation</h1>
            <pre>${explanation}</pre>
        </body>
        </html>
    `;
}

export function activate(context: vscode.ExtensionContext): void {
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
        console.log("📥 User Code Selected:", userCode.substring(0, 100) + "...");

        const { code: optimizedCode, explanation } = await getOptimizedCode(userCode);
        if (!optimizedCode || optimizedCode.includes("Error")) {
            vscode.window.showErrorMessage("Failed to optimize code.");
            return;
        }

        // Show the explanation in a webview
        showExplanationWebview(explanation);

        // Show a Quick Pick dialog to accept or reject changes
        const choice = await vscode.window.showQuickPick(["Accept Changes", "Reject Changes"], {
            placeHolder: "Do you want to accept the optimized code?",
        });

        if (choice === "Accept Changes") {
            editor.edit(editBuilder => {
                editBuilder.replace(editor.selection, optimizedCode);
            });
            vscode.window.showInformationMessage("Code optimized successfully!");
            console.log("✅ Code Optimization Complete!");
        } else {
            vscode.window.showInformationMessage("Optimization rejected.");
            console.log("❌ Optimization Rejected by User.");
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate(): void {
    console.log("🛑 Extension Deactivated: DSXpert");
}

export { detectLanguage, getOptimizedCode };