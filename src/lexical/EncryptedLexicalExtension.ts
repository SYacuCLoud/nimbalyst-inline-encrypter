import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  TextNode,
  defineExtension,
} from 'lexical';

import { isToken } from '../crypto';
import { $createEncryptedInlineNode, EncryptedInlineNode } from './EncryptedInlineNode';

/**
 * Replace the current selection with a pending encrypted node, or insert an
 * empty one that will prompt for the secret. Must run in an editor update.
 */
export function $insertEncryptedSecret(): void {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;
  const selected = selection.isCollapsed() ? null : selection.getTextContent();
  selection.insertNodes([$createEncryptedInlineNode('', selected || null)]);
}

/**
 * The host's inline-code format transformer can claim `enc:v1:...` spans
 * before our text-match transformer runs on markdown import, leaving them as
 * code-formatted text. Convert those into encrypted nodes after the fact.
 */
function $convertCodeToken(node: TextNode): void {
  if (!node.hasFormat('code')) return;
  const text = node.getTextContent().trim();
  if (isToken(text)) {
    node.replace($createEncryptedInlineNode(text));
  }
}

export const EncryptedLexicalExtension = defineExtension({
  name: '@nimbalyst/extensions/inline-encrypter',
  nodes: [EncryptedInlineNode],
  register: (editor) => {
    const removeTransform = editor.registerNodeTransform(TextNode, $convertCodeToken);
    // Ctrl/Cmd+Shift+E encrypts the selected text.
    const removeHotkey = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'e') {
          return false;
        }
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;
        event.preventDefault();
        $insertEncryptedSecret();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      removeTransform();
      removeHotkey();
    };
  },
});
