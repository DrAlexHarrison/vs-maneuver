/**
 * Pure word-swap logic for a single line of text.
 *
 * This module has no VS Code dependency so it can be unit tested under Node.
 *
 * Columns are string indices (UTF-16 code units), matching
 * `vscode.Position.character`. A column is a caret position between
 * characters, so a caret at a word's start or just past its end belongs to
 * that word. This matches the original command: it left the caret at the end
 * of the moved word, and pressing the shortcut again must keep moving the
 * same word.
 *
 * A word is a maximal run of Unicode letters, combining marks, numbers,
 * connector punctuation (including `_`), and emoji/pictographs. The emoji
 * pieces cover skin-tone modifiers, regional indicators used by flags, and
 * join controls (zero-width joiner and non-joiner), so a multi-code-point
 * emoji stays in one word.
 *
 * Everything between two neighbouring words is the separator. A swap keeps
 * the separator text in place and exchanges only the two word texts:
 *
 *   "a, b"       -> "b, a"
 *   "(foo) bar"  -> "(bar) foo"
 *   "x.y"        -> "y.x"
 *
 * The replaced range is the smallest range covering the two words and the
 * separator between them. Text before and after that range is untouched.
 * The replacement has the same length as the replaced text, so the line
 * length never changes.
 */

export type SwapDirection = 'left' | 'right';

export interface SwapResult {
    /** Full text of the line after the swap. */
    newLineText: string;
    /** Caret column after the swap: the end of the word that moved. */
    newCursorColumn: number;
    /** Start column (inclusive) of the smallest range to replace. */
    replaceStart: number;
    /** End column (exclusive) of the smallest range to replace. */
    replaceEnd: number;
    /** Text to insert in place of `[replaceStart, replaceEnd)`. */
    replacementText: string;
}

interface WordSpan {
    /** Start column (inclusive). */
    start: number;
    /** End column (exclusive). */
    end: number;
    text: string;
}

// A token made only of combining marks or join controls is not a word alone.
const HAS_WORD_SUBSTANCE =
    /[\p{L}\p{N}\p{Pc}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}]/u;

function findWords(line: string): WordSpan[] {
    const wordPattern =
        /[\p{L}\p{M}\p{N}\p{Pc}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\p{Join_Control}]+/gu;
    const words: WordSpan[] = [];

    for (const match of line.matchAll(wordPattern)) {
        const text = match[0];
        const start = match.index;
        if (start === undefined || !HAS_WORD_SUBSTANCE.test(text)) {
            continue;
        }
        words.push({ start, end: start + text.length, text });
    }

    return words;
}

/**
 * Swap the word at `cursorColumn` with its neighbour in `direction`.
 * Returns `null` when there is no word at the caret or no neighbour to swap
 * with in that direction.
 */
export function swapWord(
    lineText: string,
    cursorColumn: number,
    direction: SwapDirection,
): SwapResult | null {
    if (typeof lineText !== 'string' || lineText.length === 0) {
        return null;
    }
    if (direction !== 'left' && direction !== 'right') {
        return null;
    }
    if (!Number.isInteger(cursorColumn)) {
        return null;
    }
    if (cursorColumn < 0 || cursorColumn > lineText.length) {
        return null;
    }

    const words = findWords(lineText);
    const currentIndex = words.findIndex(
        (word) => cursorColumn >= word.start && cursorColumn <= word.end,
    );
    if (currentIndex < 0) {
        return null;
    }

    const neighbourIndex =
        direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (neighbourIndex < 0 || neighbourIndex >= words.length) {
        return null;
    }

    const leftWord = words[Math.min(currentIndex, neighbourIndex)];
    const rightWord = words[Math.max(currentIndex, neighbourIndex)];
    const separator = lineText.slice(leftWord.end, rightWord.start);

    const replaceStart = leftWord.start;
    const replaceEnd = rightWord.end;
    const replacementText = rightWord.text + separator + leftWord.text;
    const newLineText =
        lineText.slice(0, replaceStart) +
        replacementText +
        lineText.slice(replaceEnd);

    const currentWord = words[currentIndex];
    const newCursorColumn =
        direction === 'left'
            ? leftWord.start + currentWord.text.length
            : leftWord.start +
              rightWord.text.length +
              separator.length +
              currentWord.text.length;

    return {
        newLineText,
        newCursorColumn,
        replaceStart,
        replaceEnd,
        replacementText,
    };
}

export function swapWordLeft(
    lineText: string,
    cursorColumn: number,
): SwapResult | null {
    return swapWord(lineText, cursorColumn, 'left');
}

export function swapWordRight(
    lineText: string,
    cursorColumn: number,
): SwapResult | null {
    return swapWord(lineText, cursorColumn, 'right');
}
