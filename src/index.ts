import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage("DSXpert Extension Activated!");
}

export function deactivate() {}
