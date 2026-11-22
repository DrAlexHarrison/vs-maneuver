import * as vscode from 'vscode';
import { swapWord } from './swap.js';
import type { SwapDirection } from './swap.js';

async function swapActiveWord(direction: SwapDirection): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const document = editor.document;
    const primarySelection = editor.selection;
    const position = primarySelection.active;
    const line = document.lineAt(position.line);

    const result = swapWord(line.text, position.character, direction);
    if (!result) {
        return;
    }

    // Replace only the two swapped words and the separator between them.
    // A whole-line replacement needlessly disturbs other cursors, markers,
    // and undo state for text that did not change.
    const replaceRange = new vscode.Range(
        position.line,
        result.replaceStart,
        position.line,
        result.replaceEnd,
    );

    // Captured before the edit so other cursors can be kept. The swap never
    // changes the line length, so their columns are still valid afterwards.
    const previousSelections = [...editor.selections];

    const edited = await editor.edit((editBuilder) => {
        editBuilder.replace(replaceRange, result.replacementText);
    });
    if (!edited) {
        return;
    }

    const newPosition = new vscode.Position(
        position.line,
        result.newCursorColumn,
    );
    const newSelection = new vscode.Selection(newPosition, newPosition);

    if (previousSelections.length <= 1) {
        editor.selection = newSelection;
        return;
    }

    // Move only the cursor that invoked the swap; keep the others in place.
    let movedPrimary = false;
    const nextSelections = previousSelections.map((selection) => {
        if (!movedPrimary && selection.isEqual(primarySelection)) {
            movedPrimary = true;
            return newSelection;
        }
        return selection;
    });

    if (movedPrimary) {
        editor.selections = nextSelections;
    } else {
        editor.selection = newSelection;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const moveLeftCmd = vscode.commands.registerCommand(
        'swapWord.moveLeft',
        () => swapActiveWord('left'),
    );
    const moveRightCmd = vscode.commands.registerCommand(
        'swapWord.moveRight',
        () => swapActiveWord('right'),
    );

    context.subscriptions.push(moveLeftCmd, moveRightCmd);
}

export function deactivate() {}
