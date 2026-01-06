# Swap Word

Swap the word under your cursor with adjacent words using simple keyboard shortcuts.

## Features

- **Alt+Left**: Swap current word with the word to its left
- **Alt+Right**: Swap current word with the word to its right

The cursor follows the word as it moves, so you can keep pressing the shortcut to move a word further.

## Demo

```
Before: const foo bar baz
             ^cursor on "bar"

After Alt+Left: const bar foo baz
                      ^cursor follows "bar"
```

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dralexharrison.swap-word), or search "Swap Word" in the Extensions view.

## Keybindings

| Command | Keybinding | Description |
|---------|------------|-------------|
| Swap Word Left | `Alt+Left` | Swap with previous word |
| Swap Word Right | `Alt+Right` | Swap with next word |

These can be customized in VS Code's Keyboard Shortcuts settings.

## Support

**Note:** This is a side project. I'm the founder of [Saturday Inc](https://saturdaymorning.fit), building the app that fuels your next marathon, century ride, or Ironman. Issues and PRs welcome, but response times may vary.

## License

MIT
