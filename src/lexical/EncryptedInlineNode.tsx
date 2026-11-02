import type {
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import type { JSX } from 'react';

import { $applyNodeReplacement, DecoratorNode } from 'lexical';

import { EncryptedChip } from './EncryptedChip';

export type SerializedEncryptedInlineNode = Spread<
  {
    token: string;
  },
  SerializedLexicalNode
>;

/**
 * Inline secret stored as `enc:v1:...` in markdown.
 *
 * A node without a token is "pending": it was just inserted and its chip is
 * asking the user for a passphrase. `__pendingPlain` holds text the user
 * selected for encryption; it is in memory only and is exported verbatim
 * (it was already plaintext in the file) until encryption completes.
 */
export class EncryptedInlineNode extends DecoratorNode<JSX.Element> {
  __token: string;
  __pendingPlain: string | null;

  constructor(token: string, pendingPlain: string | null = null, key?: NodeKey) {
    super(key);
    this.__token = token;
    this.__pendingPlain = pendingPlain;
  }

  static getType(): string {
    return 'encrypted-inline';
  }

  static clone(node: EncryptedInlineNode): EncryptedInlineNode {
    return new EncryptedInlineNode(node.__token, node.__pendingPlain, node.__key);
  }

  static importJSON(serializedNode: SerializedEncryptedInlineNode): EncryptedInlineNode {
    return $createEncryptedInlineNode(serializedNode.token);
  }

  exportJSON(): SerializedEncryptedInlineNode {
    return {
      ...super.exportJSON(),
      type: 'encrypted-inline',
      version: 1,
      token: this.__token,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.className = 'nim-enc-node';
    span.spellcheck = false;
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  isInline(): true {
    return true;
  }

  getTextContent(): string {
    return '[encrypted]';
  }

  getToken(): string {
    return this.getLatest().__token;
  }

  getPendingPlain(): string | null {
    return this.getLatest().__pendingPlain;
  }

  setToken(token: string): void {
    const writable = this.getWritable();
    writable.__token = token;
    writable.__pendingPlain = null;
  }

  decorate(): JSX.Element {
    return (
      <EncryptedChip
        nodeKey={this.__key}
        token={this.__token}
        pendingPlain={this.__pendingPlain}
      />
    );
  }
}

export function $createEncryptedInlineNode(
  token: string,
  pendingPlain: string | null = null,
): EncryptedInlineNode {
  return $applyNodeReplacement(new EncryptedInlineNode(token, pendingPlain));
}

export function $isEncryptedInlineNode(
  node: LexicalNode | null | undefined,
): node is EncryptedInlineNode {
  return node instanceof EncryptedInlineNode;
}
