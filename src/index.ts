/**
 * Inline Encrypter extension entry.
 *
 * Stores secrets inside markdown as `enc:v1:...` inline code and renders them
 * as lock chips in the Lexical editor. Passphrases live only in memory.
 */

import './styles.css';

import type { AIToolContext, ExtensionAITool, ExtensionToolResult } from '@nimbalyst/extension-sdk';

import { encrypt } from './crypto';
import {
  $insertEncryptedSecret,
  ENCRYPTED_INLINE_TRANSFORMER,
  EncryptedLexicalExtension,
} from './lexical';
import { lock, passphraseForEncrypt } from './session';

export async function activate(): Promise<void> {
  // Nodes, transformers and commands are registered by the host from the
  // exports below; nothing else to set up.
}

export async function deactivate(): Promise<void> {
  lock();
}

export const transformers = {
  ENCRYPTED_INLINE_TRANSFORMER,
};

export const lexicalExtensions = {
  EncryptedLexicalExtension,
};

// Slash command handlers run inside an editor command listener context,
// so the Lexical `$` helpers operate on the active editor.
export const slashCommandHandlers = {
  insertEncryptedSecret: () => {
    $insertEncryptedSecret();
  },
  lockSecrets: () => {
    lock();
  },
};

const encryptTool: ExtensionAITool = {
  name: 'inline_encrypter.encrypt',
  description:
    'Encrypt a secret (password, API key, token) with the user\'s Inline Encrypter passphrase and return an `enc:v1:...` token. ' +
    'The user is prompted for the passphrase in the app if the session is locked; the passphrase is never returned. ' +
    'Insert the returned token into the markdown wrapped in single backticks, e.g. `enc:v1:...`, in place of the plaintext. ' +
    'There is no decrypt tool: never write the plaintext back into files.',
  scope: 'global',
  inputSchema: {
    type: 'object',
    properties: {
      plaintext: { type: 'string', description: 'The secret value to encrypt' },
    },
    required: ['plaintext'],
  },
  handler: async (args: Record<string, unknown>, _context: AIToolContext): Promise<ExtensionToolResult> => {
    const plaintext = args.plaintext;
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      return { success: false, error: 'plaintext must be a non-empty string' };
    }
    const passphrase = await passphraseForEncrypt();
    if (!passphrase) {
      return { success: false, error: 'The user cancelled the passphrase prompt.' };
    }
    const token = await encrypt(plaintext, passphrase);
    return {
      success: true,
      message: `\`${token}\``,
    };
  },
};

export const aiTools = [encryptTool];
