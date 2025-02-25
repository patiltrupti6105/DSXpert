const vscode = acquireVsCodeApi();

// Handle tab switching
document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
        const tabId = button.getAttribute("data-tab");
        document.querySelectorAll(".tab-content").forEach((content) => {
            content.style.display = "none";
        });
        document.querySelectorAll(".tab-button").forEach((btn) => {
            btn.classList.remove("active");
        });
        document.getElementById(tabId).style.display = "block";
        button.classList.add("active");
    });
});

// Highlight changes in optimized code
function highlightChanges(originalCode, optimizedCode) {
    const diff = Diff.diffLines(originalCode, optimizedCode);
    const optimizedCodeElement = document.querySelector("#optimized-code");
    optimizedCodeElement.innerHTML = "";

    diff.forEach((part) => {
        const span = document.createElement("span");
        span.textContent = part.value;
        if (part.added) {
            span.classList.add("hl-added");
        } else if (part.removed) {
            span.classList.add("hl-removed");
        } else {
            span.classList.add("hl-unchanged");
        }
        optimizedCodeElement.appendChild(span);
    });
}

// Handle accept and reject
function accept() {
    const optimizedCode = document.querySelector("#optimized-code").innerText;
    vscode.postMessage({ command: "accept", code: optimizedCode });
}

function reject() {
    vscode.postMessage({ command: "reject" });
}

// Highlight code blocks and changes
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightBlock(block);
    });

    const originalCode = document.querySelector("#original code").innerText;
    const optimizedCode = document.querySelector("#optimized-code").innerText;
    highlightChanges(originalCode, optimizedCode);
});