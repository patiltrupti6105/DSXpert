import * as vscode from 'vscode';
export function getWebviewContent(
    originalCode: string,
    optimizedCode: string,
    explanation: string,
    stylesUri: vscode.Uri,
    scriptUri: vscode.Uri
): string {
    console.log("Explanation Passed to Webview:", explanation); // Debugging

    const isOptimized = optimizedCode !== originalCode;

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Optimization Result</title>
            <link href="${stylesUri}" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/dark.min.css">
        </head>
        <body>
            <div class="tabs">
                <button class="tab-button active" data-tab="original">Original Code</button>
                ${isOptimized ? '<button class="tab-button" data-tab="optimized">Optimized Code</button>' : ''}
            </div>
            <div id="original" class="tab-content active">
                <pre><code class="language-javascript">${originalCode}</code></pre>
            </div>
            ${isOptimized ? `
            <div id="optimized" class="tab-content">
                <pre><code id="optimized-code" class="language-javascript">${optimizedCode}</code></pre>
            </div>
            ` : ''}
            <h2>Optimizations Made</h2>
            <div class="explanation">
                <pre>${explanation}</pre>
            </div>
            ${isOptimized ? `
            <div class="actions">
                <button class="accept" onclick="accept()">Accept</button>
                <button class="reject" onclick="reject()">Reject</button>
            </div>
            ` : ''}
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
            <script src="${scriptUri}"></script>
        </body>
        </html>
    `;
}