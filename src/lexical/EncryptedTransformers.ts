import type { TextMatchTransformer } from '@lexical/markdown';

import { TOKEN_SOURCE } from '../crypto';
import {
  $createEncryptedInlineNode,
  $isEncryptedInlineNode,
  EncryptedInlineNode,
} from './EncryptedInlineNode';

// Matches the whole inline-code span (backticks included) so it wins over the
// built-in inline-code format transformer, which matches the same range.
const IMPORT_REGEXP = new RegExp('`(' + TOKEN_SOURCE + ')`');
// No typing-time shortcut; secrets are inserted via slash command / hotkey.
const SHORTCUT_REGEXP = /(?!)/;

export const ENCRYPTED_INLINE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [EncryptedInlineNode],
  export: (node) => {
    if (!$isEncryptedInlineNode(node)) {
      return null;
    }
    const token = node.getToken();
    // Pending nodes export their original text (already plaintext on disk)
    // or nothing, so an autosave mid-prompt never writes a broken token.
    return token ? '`' + token + '`' : node.getPendingPlain() ?? '';
  },
  importRegExp: IMPORT_REGEXP,
  regExp: SHORTCUT_REGEXP,
  replace: (textNode, match) => {
    textNode.replace($createEncryptedInlineNode(match[1]));
  },
  trigger: '`',
  type: 'text-match',
};
