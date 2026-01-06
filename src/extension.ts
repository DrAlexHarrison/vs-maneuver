import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const moveLeftCmd = vscode.commands.registerCommand('swapWord.moveLeft', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const position = editor.selection.active;
        const line = document.lineAt(position.line);
        const lineText = line.text;

        // Get current word range
        const currentWordRange = document.getWordRangeAtPosition(position);
        if (!currentWordRange) return;

        const currentWord = document.getText(currentWordRange);
        const currentStart = currentWordRange.start.character;
        const currentEnd = currentWordRange.end.character;

        // Find previous word
        const textBefore = lineText.substring(0, currentStart);
        const prevMatch = textBefore.match(/(\w+)(\s*)$/);
        if (!prevMatch) return;

        const prevWord = prevMatch[1];
        const spaceBetween = prevMatch[2];
        const prevStart = currentStart - prevMatch[0].length;

        // Build the swapped text
        const beforePrev = lineText.substring(0, prevStart);
        const afterCurrent = lineText.substring(currentEnd);
        const newLineText = beforePrev + currentWord + spaceBetween + prevWord + afterCurrent;

        await editor.edit(editBuilder => {
            editBuilder.replace(line.range, newLineText);
        });

        // Move cursor to stay with the word we moved
        const newPos = new vscode.Position(position.line, prevStart + currentWord.length);
        editor.selection = new vscode.Selection(newPos, newPos);
    });

    const moveRightCmd = vscode.commands.registerCommand('swapWord.moveRight', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const position = editor.selection.active;
        const line = document.lineAt(position.line);
        const lineText = line.text;

        // Get current word range
        const currentWordRange = document.getWordRangeAtPosition(position);
        if (!currentWordRange) return;

        const currentWord = document.getText(currentWordRange);
        const currentStart = currentWordRange.start.character;
        const currentEnd = currentWordRange.end.character;

        // Find next word
        const textAfter = lineText.substring(currentEnd);
        const nextMatch = textAfter.match(/^(\s*)(\w+)/);
        if (!nextMatch) return;

        const spaceBetween = nextMatch[1];
        const nextWord = nextMatch[2];
        const nextEnd = currentEnd + nextMatch[0].length;

        // Build the swapped text
        const beforeCurrent = lineText.substring(0, currentStart);
        const afterNext = lineText.substring(nextEnd);
        const newLineText = beforeCurrent + nextWord + spaceBetween + currentWord + afterNext;

        await editor.edit(editBuilder => {
            editBuilder.replace(line.range, newLineText);
        });

        // Move cursor to stay with the word we moved
        const newPos = new vscode.Position(
            position.line,
            currentStart + nextWord.length + spaceBetween.length + currentWord.length
        );
        editor.selection = new vscode.Selection(newPos, newPos);
    });

    context.subscriptions.push(moveLeftCmd, moveRightCmd);
}

export function deactivate() {}
