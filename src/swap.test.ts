import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { swapWord, swapWordLeft, swapWordRight } from './swap.js';
import type { SwapDirection, SwapResult } from './swap.js';

// Columns are caret positions between characters and are counted in UTF-16
// code units, the same units as `vscode.Position.character` and JavaScript
// string indices. For "foo bar", foo spans columns 0 to 3 and bar spans
// columns 4 to 7. A caret at 0, 1, 2, or 3 is on foo; a caret at 4 through 7
// is on bar. After a swap the caret lands at the end of the moved word, as
// the original extension did, so repeated presses keep moving that word.

function expectSwap(
    lineText: string,
    cursorColumn: number,
    direction: SwapDirection,
    expectedLineText: string,
    expectedCursorColumn: number,
): SwapResult {
    const result = swapWord(lineText, cursorColumn, direction);
    assert.ok(
        result,
        `expected a swap for ${JSON.stringify(lineText)} at ${cursorColumn} (${direction})`,
    );
    assert.equal(result.newLineText, expectedLineText);
    assert.equal(result.newCursorColumn, expectedCursorColumn);

    // The reported range must rebuild the full line, and a swap only
    // reorders the two words around their separator, so lengths hold.
    assert.equal(
        lineText.slice(0, result.replaceStart) +
            result.replacementText +
            lineText.slice(result.replaceEnd),
        result.newLineText,
    );
    assert.equal(
        result.replacementText.length,
        result.replaceEnd - result.replaceStart,
    );
    assert.equal(result.newLineText.length, lineText.length);
    return result;
}

function expectNoSwap(lineText: string, cursorColumn: number): void {
    assert.equal(swapWordLeft(lineText, cursorColumn), null);
    assert.equal(swapWordRight(lineText, cursorColumn), null);
}

describe('ordinary swaps', () => {
    it('matches the README example when moving a middle word left', () => {
        // "bar" spans columns 10 to 13 (start, middle, and end).
        for (const cursor of [10, 11, 12, 13]) {
            expectSwap(
                'const foo bar baz',
                cursor,
                'left',
                'const bar foo baz',
                9,
            );
        }
    });

    it('moves a middle word right and keeps the caret on it', () => {
        for (const cursor of [10, 11, 12, 13]) {
            expectSwap(
                'const foo bar baz',
                cursor,
                'right',
                'const foo baz bar',
                17,
            );
        }
    });

    it('treats start, middle, and end of a word the same', () => {
        for (const cursor of [0, 1, 2, 3]) {
            expectSwap('foo bar', cursor, 'right', 'bar foo', 7);
        }
        for (const cursor of [4, 5, 6, 7]) {
            expectSwap('foo bar', cursor, 'left', 'bar foo', 3);
        }
    });

    it('exposes left and right helpers that agree with swapWord', () => {
        assert.deepEqual(
            swapWordLeft('foo bar', 5),
            swapWord('foo bar', 5, 'left'),
        );
        assert.deepEqual(
            swapWordRight('foo bar', 1),
            swapWord('foo bar', 1, 'right'),
        );
    });

    it('keeps moving the same word on repeated presses', () => {
        const first = expectSwap(
            'one two three',
            10,
            'left',
            'one three two',
            9,
        );
        const second = expectSwap(
            first.newLineText,
            first.newCursorColumn,
            'left',
            'three one two',
            5,
        );
        assert.equal(
            swapWordLeft(second.newLineText, second.newCursorColumn),
            null,
        );
    });

    it('moves a word right across the line on repeated presses', () => {
        const first = expectSwap('one two three', 1, 'right', 'two one three', 7);
        const second = expectSwap(
            first.newLineText,
            first.newCursorColumn,
            'right',
            'two three one',
            13,
        );
        assert.equal(
            swapWordRight(second.newLineText, second.newCursorColumn),
            null,
        );
    });

    it('returns to the original line after swapping right then left', () => {
        const first = expectSwap('a b c', 2, 'right', 'a c b', 5);
        expectSwap(first.newLineText, first.newCursorColumn, 'left', 'a b c', 3);
    });
});

describe('line boundaries and empty input', () => {
    it('does nothing for the first word moving left', () => {
        assert.equal(swapWordLeft('foo bar baz', 1), null);
        assert.equal(swapWordLeft('foo bar baz', 0), null);
    });

    it('does nothing for the last word moving right', () => {
        assert.equal(swapWordRight('foo bar baz', 10), null);
        assert.equal(swapWordRight('foo bar baz', 11), null);
    });

    it('does nothing on an empty line', () => {
        expectNoSwap('', 0);
    });

    it('does nothing on a whitespace-only line', () => {
        for (const cursor of [0, 1, 2, 3]) {
            expectNoSwap('   ', cursor);
        }
        expectNoSwap('\t', 0);
        expectNoSwap('\t', 1);
    });

    it('does nothing when the line has a single word', () => {
        for (const cursor of [0, 1, 2, 3, 4]) {
            expectNoSwap('only', cursor);
        }
    });

    it('does nothing for a single word surrounded by spaces or punctuation', () => {
        expectNoSwap('  only  ', 4);
        expectNoSwap('(only)', 3);
    });

    it('does nothing for a cursor outside the line', () => {
        expectNoSwap('foo bar', -1);
        expectNoSwap('foo bar', 8);
    });

    it('does nothing for a non-integer cursor column', () => {
        expectNoSwap('foo bar', 1.5);
        expectNoSwap('foo bar', Number.NaN);
        expectNoSwap('foo bar', Number.POSITIVE_INFINITY);
    });
});

describe('spaces and tabs between words', () => {
    it('keeps several spaces between the swapped words', () => {
        expectSwap('foo   bar', 1, 'right', 'bar   foo', 9);
        expectSwap('foo   bar', 8, 'left', 'bar   foo', 3);
    });

    it('keeps a tab between the swapped words', () => {
        expectSwap('foo\tbar', 1, 'right', 'bar\tfoo', 7);
        expectSwap('foo\tbar', 5, 'left', 'bar\tfoo', 3);
    });

    it('keeps a mixed run of spaces and tabs in place', () => {
        expectSwap('foo \t bar', 1, 'right', 'bar \t foo', 9);
        expectSwap('foo \t bar', 7, 'left', 'bar \t foo', 3);
    });

    it('leaves leading and trailing whitespace where it was', () => {
        expectSwap('  foo bar  ', 3, 'right', '  bar foo  ', 9);
        expectSwap('  foo bar  ', 7, 'left', '  bar foo  ', 5);
    });

    it('does nothing when the caret is inside a run of spaces', () => {
        // In "foo   bar", column 3 is the end of foo and column 6 is the
        // start of bar. Columns 4 and 5 sit only on spaces.
        expectNoSwap('foo   bar', 4);
        expectNoSwap('foo   bar', 5);
    });

    it('does nothing when the caret is between two tabs', () => {
        expectNoSwap('foo\t\tbar', 4);
    });

    it('does nothing in leading or trailing whitespace away from a word', () => {
        expectNoSwap('  foo bar', 0);
        expectNoSwap('  foo bar', 1);
        expectNoSwap('foo bar ', 8);
    });

    it('still swaps from the caret at the end of the last word', () => {
        expectSwap('foo bar ', 7, 'left', 'bar foo ', 3);
    });
});

describe('punctuation between or around words', () => {
    it('swaps across a comma and space in both directions', () => {
        expectSwap('a, b', 0, 'right', 'b, a', 4);
        expectSwap('a, b', 1, 'right', 'b, a', 4);
        expectSwap('a, b', 3, 'left', 'b, a', 1);
        expectSwap('a, b', 4, 'left', 'b, a', 1);
    });

    it('keeps surrounding parentheses on the same slot', () => {
        expectSwap('(foo) bar', 2, 'right', '(bar) foo', 9);
        expectSwap('(foo) bar', 7, 'left', '(bar) foo', 4);
    });

    it('swaps the parts on either side of a dot', () => {
        expectSwap('x.y', 0, 'right', 'y.x', 3);
        expectSwap('x.y', 1, 'right', 'y.x', 3);
        expectSwap('x.y', 2, 'left', 'y.x', 1);
        expectSwap('x.y', 3, 'left', 'y.x', 1);
    });

    it('swaps function arguments without moving the call punctuation', () => {
        expectSwap('f(a, b)', 2, 'right', 'f(b, a)', 6);
        expectSwap('f(a, b)', 5, 'left', 'f(b, a)', 3);
    });

    it('swaps across punctuation with no following space', () => {
        expectSwap('foo,bar', 1, 'right', 'bar,foo', 7);
        expectSwap('foo,bar', 5, 'left', 'bar,foo', 3);
    });

    it('keeps a multi-character operator between the words', () => {
        expectSwap('a && b', 0, 'right', 'b && a', 6);
        expectSwap('a && b', 5, 'left', 'b && a', 1);
    });

    it('swaps across a semicolon separator', () => {
        expectSwap('foo; bar', 1, 'right', 'bar; foo', 8);
        expectSwap('foo; bar', 6, 'left', 'bar; foo', 3);
    });

    it('does nothing when the caret is only on punctuation or spaces', () => {
        // Column 2 in "a, b" is after the comma and before the space.
        expectNoSwap('a, b', 2);
        // Column 0 is before "(" and column 5 is after ")" in "(foo) bar".
        expectNoSwap('(foo) bar', 0);
        expectNoSwap('(foo) bar', 5);
    });
});

describe('words with digits and underscores', () => {
    it('keeps trailing digits and embedded underscores with the word', () => {
        expectSwap('foo1 bar_2', 2, 'right', 'bar_2 foo1', 10);
        expectSwap('foo1 bar_2', 7, 'left', 'bar_2 foo1', 5);
    });

    it('treats an underscore inside a name as part of the word', () => {
        expectSwap('foo_bar baz', 3, 'right', 'baz foo_bar', 11);
        expectSwap('foo_bar baz', 9, 'left', 'baz foo_bar', 3);
    });

    it('keeps a leading underscore with the word', () => {
        expectSwap('_foo bar', 0, 'right', 'bar _foo', 8);
        expectSwap('_foo bar', 6, 'left', 'bar _foo', 3);
    });

    it('swaps number-only words', () => {
        expectSwap('123 456', 1, 'right', '456 123', 7);
        expectSwap('123 456', 5, 'left', '456 123', 3);
    });

    it('swaps short alphanumeric words', () => {
        expectSwap('v2 v10', 1, 'right', 'v10 v2', 6);
        expectSwap('v2 v10', 4, 'left', 'v10 v2', 3);
    });
});

describe('non-ASCII letters', () => {
    it('swaps words with precomposed accented letters whole', () => {
        expectSwap('café naïve', 1, 'right', 'naïve café', 10);
        expectSwap('café naïve', 7, 'left', 'naïve café', 5);
    });

    it('keeps combining accents with their base letters', () => {
        // Written with escapes so the decomposed forms stay decomposed:
        // "cafe" plus U+0301 is five code units, not a single "é".
        const line = 'cafe\u0301 the\u0301';
        assert.equal('cafe\u0301'.length, 5);
        expectSwap(line, 1, 'right', 'the\u0301 cafe\u0301', 10);
        expectSwap(line, 7, 'left', 'the\u0301 cafe\u0301', 4);
    });

    it('swaps Cyrillic words', () => {
        expectSwap('привет мир', 2, 'right', 'мир привет', 10);
        expectSwap('привет мир', 8, 'left', 'мир привет', 3);
    });

    it('swaps space-separated CJK words', () => {
        expectSwap('你好 世界', 0, 'right', '世界 你好', 5);
        expectSwap('你好 世界', 3, 'left', '世界 你好', 2);
    });

    it('swaps accented words across punctuation', () => {
        expectSwap('café, thé', 1, 'right', 'thé, café', 9);
        expectSwap('café, thé', 7, 'left', 'thé, café', 3);
    });
});

describe('emoji', () => {
    it('treats a space-separated emoji as a word', () => {
        // The waving hand is one code point but two UTF-16 code units, so
        // in "hello 👋 world" it spans columns 6 to 8.
        assert.equal('👋'.length, 2);
        for (const cursor of [6, 7, 8]) {
            expectSwap('hello 👋 world', cursor, 'left', '👋 hello world', 2);
            expectSwap('hello 👋 world', cursor, 'right', 'hello world 👋', 14);
        }
    });

    it('swaps a text word with a neighbouring emoji', () => {
        expectSwap('hello 👋 world', 1, 'right', '👋 hello world', 8);
        expectSwap('hello 👋 world', 10, 'left', 'hello world 👋', 11);
    });

    it('keeps a skin-tone modifier with its emoji', () => {
        const wavingHand = '👋🏽';
        assert.equal(wavingHand.length, 4);
        const line = `hi ${wavingHand} there`;
        expectSwap(line, 4, 'right', `hi there ${wavingHand}`, 13);
        expectSwap(line, 4, 'left', `${wavingHand} hi there`, 4);
    });

    it('keeps a zero-width-joiner emoji sequence together', () => {
        const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
        assert.equal(family.length, 8);
        const line = `a ${family} b`;
        expectSwap(line, 5, 'right', `a b ${family}`, 12);
        expectSwap(line, 5, 'left', `${family} a b`, 8);
    });

    it('keeps a flag made of regional indicators together', () => {
        const flag = '\u{1F1EB}\u{1F1F7}';
        assert.equal(flag.length, 4);
        const line = `x ${flag} y`;
        expectSwap(line, 4, 'left', `${flag} x y`, 4);
        expectSwap(line, 4, 'right', `x y ${flag}`, 8);
    });

    it('keeps a variation selector with its emoji', () => {
        const heart = '\u2764\uFE0F';
        assert.equal(heart.length, 2);
        const line = `a ${heart} b`;
        expectSwap(line, 3, 'right', `a b ${heart}`, 6);
        expectSwap(line, 3, 'left', `${heart} a b`, 2);
    });

    it('does nothing past an emoji at the edge of the line', () => {
        assert.equal(swapWordLeft('👋 hello', 0), null);
        assert.equal(swapWordRight('👋 hello', 5), null);
    });
});

describe('smallest replaced range', () => {
    it('replaces only the swapped words between leading and trailing text', () => {
        assert.deepEqual(swapWordRight('  foo bar  ', 3), {
            newLineText: '  bar foo  ',
            newCursorColumn: 9,
            replaceStart: 2,
            replaceEnd: 9,
            replacementText: 'bar foo',
        });
    });

    it('replaces only the arguments inside a call', () => {
        assert.deepEqual(swapWordRight('f(a, b)', 2), {
            newLineText: 'f(b, a)',
            newCursorColumn: 6,
            replaceStart: 2,
            replaceEnd: 6,
            replacementText: 'b, a',
        });
    });

    it('leaves a punctuation prefix outside the replaced range', () => {
        assert.deepEqual(swapWordLeft('(foo) bar', 7), {
            newLineText: '(bar) foo',
            newCursorColumn: 4,
            replaceStart: 1,
            replaceEnd: 9,
            replacementText: 'bar) foo',
        });
    });

    it('leaves words before and after the swap outside the range', () => {
        assert.deepEqual(swapWordRight('xx foo, bar yy', 3), {
            newLineText: 'xx bar, foo yy',
            newCursorColumn: 11,
            replaceStart: 3,
            replaceEnd: 11,
            replacementText: 'bar, foo',
        });
    });

    it('does not claim the whole line for a swap in the middle', () => {
        const result = swapWordLeft('const foo bar baz', 11);
        assert.ok(result);
        assert.equal(result.replaceStart, 6);
        assert.equal(result.replaceEnd, 13);
        assert.equal(result.replacementText, 'bar foo');
    });
});
