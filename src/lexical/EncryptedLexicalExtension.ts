import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  TextNode,
  defineExtension,
  type LexicalEditor,
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

/**
 * The host's floating text toolbar has no extension hook, so add a lock
 * button to it whenever it mounts (it is portaled into `.editor-scroller`).
 * shortcut: relies on host class names, switch to an official API if one ships.
 */
function addToolbarButton(editor: LexicalEditor, popup: Element): void {
  if (popup.querySelector('.nim-enc-toolbar-button')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'popup-item spaced floating-toolbar-action nim-enc-toolbar-button';
  button.title = '비밀로 암호화 (Ctrl+Shift+E)';
  button.setAttribute('aria-label', '비밀로 암호화');
  button.innerHTML = '<span class="material-symbols-outlined">lock</span>';
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => editor.update($insertEncryptedSecret));
  const link = popup.querySelector('.format.link')?.closest('button');
  if (link) link.after(button);
  else popup.appendChild(button);
}

function registerToolbarButton(editor: LexicalEditor): () => void {
  let observer: MutationObserver | null = null;
  const removeRoot = editor.registerRootListener((root) => {
    observer?.disconnect();
    observer = null;
    const scroller = root?.closest('.editor-scroller');
    if (!scroller) return;
    const scan = () => {
      for (const popup of scroller.querySelectorAll(':scope > .floating-text-format-popup')) {
        addToolbarButton(editor, popup);
      }
    };
    observer = new MutationObserver(scan);
    observer.observe(scroller, { childList: true });
    scan();
  });
  return () => {
    removeRoot();
    observer?.disconnect();
  };
}

export const EncryptedLexicalExtension = defineExtension({
  name: '@syacucloud/inline-encrypter',
  nodes: [EncryptedInlineNode],
  register: (editor) => {
    const removeTransform = editor.registerNodeTransform(TextNode, $convertCodeToken);
    const removeToolbarButton = registerToolbarButton(editor);
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
      removeToolbarButton();
      removeHotkey();
    };
  },
});
