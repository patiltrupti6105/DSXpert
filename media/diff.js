// Import the diff library
const Diff = require('diff');

// Expose the diff functions to the webview
window.Diff = {
    createTwoFilesPatch: (oldFileName, newFileName, oldStr, newStr) => {
        return Diff.createPatch(oldFileName, newFileName, oldStr, newStr);
    },
    diffLines: (oldStr, newStr) => {
        return Diff.diffLines(oldStr, newStr);
    }
};