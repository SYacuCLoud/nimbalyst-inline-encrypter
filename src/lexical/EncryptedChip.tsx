import type { JSX } from 'react';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $createTextNode, $getNodeByKey, type NodeKey } from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';

import { decrypt, encrypt } from '../crypto';
import { promptSecret } from '../PassphraseDialog';
import { passphraseForEncrypt, withPassphrase } from '../session';
import { $isEncryptedInlineNode } from './EncryptedInlineNode';

const CLIPBOARD_CLEAR_MS = 30_000;

// Guards the pending-encryption flow against double mounts.
const pendingInFlight = new Set<NodeKey>();

interface EncryptedChipProps {
  nodeKey: NodeKey;
  token: string;
  pendingPlain: string | null;
}

export function EncryptedChip({ nodeKey, token, pendingPlain }: EncryptedChipProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [plain, setPlain] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);

  const close = useCallback(() => {
    setPlain(null);
    setShown(false);
    setStatus(null);
  }, []);

  // Newly inserted node: collect the secret and passphrase, then encrypt.
  useEffect(() => {
    if (token || pendingInFlight.has(nodeKey)) return;
    pendingInFlight.add(nodeKey);
    (async () => {
      const secret = pendingPlain || (await promptSecret({ title: '새 비밀 암호화' }));
      const passphrase = secret ? await passphraseForEncrypt() : null;
      if (!secret || !passphrase) {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (!$isEncryptedInlineNode(node)) return;
          if (pendingPlain) node.replace($createTextNode(pendingPlain));
          else node.remove();
        });
        return;
      }
      const newToken = await encrypt(secret, passphrase);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isEncryptedInlineNode(node)) node.setToken(newToken);
      });
    })().finally(() => pendingInFlight.delete(nodeKey));
  }, [editor, nodeKey, pendingPlain, token]);

  // Close the popover (and forget the plaintext) on outside click / Escape.
  useEffect(() => {
    if (plain === null) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, plain]);

  const unlock = useCallback(async () => {
    if (!token || busy) return;
    if (plain !== null) {
      close();
      return;
    }
    setBusy(true);
    try {
      const value = await withPassphrase((pass) => decrypt(token, pass));
      if (value !== null) setPlain(value);
    } finally {
      setBusy(false);
    }
  }, [busy, close, plain, token]);

  const copy = useCallback(async () => {
    if (plain === null) return;
    await navigator.clipboard.writeText(plain);
    setStatus('복사됨 · 30초 후 클립보드를 비웁니다');
    const copied = plain;
    setTimeout(async () => {
      try {
        if ((await navigator.clipboard.readText()) === copied) {
          await navigator.clipboard.writeText('');
        }
      } catch {
        // Clipboard read can be denied; leave it alone in that case.
      }
    }, CLIPBOARD_CLEAR_MS);
  }, [plain]);

  const edit = useCallback(async () => {
    if (plain === null) return;
    const next = await promptSecret({ title: '비밀 수정', initial: plain });
    if (next === null) return;
    const passphrase = await passphraseForEncrypt();
    if (!passphrase) return;
    const newToken = await encrypt(next, passphrase);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isEncryptedInlineNode(node)) node.setToken(newToken);
    });
    close();
  }, [close, editor, nodeKey, plain]);

  const removeEncryption = useCallback(() => {
    if (plain === null) return;
    if (!window.confirm('암호화를 해제하면 이 값이 파일에 평문으로 저장됩니다. 계속할까요?')) return;
    const value = plain;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isEncryptedInlineNode(node)) node.replace($createTextNode(value));
    });
  }, [editor, nodeKey, plain]);

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <span className="nim-enc-shell" ref={rootRef}>
      <span
        className={['nim-enc-chip', token ? '' : 'nim-enc-chip-pending', plain !== null ? 'nim-enc-chip-open' : ''].join(' ')}
        title={token ? '클릭하여 잠금 해제' : '암호화 중...'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.stopPropagation();
          void unlock();
        }}
      >
        {plain !== null ? '🔓' : '🔒'} {busy ? '...' : '비밀'}
      </span>
      {plain !== null ? (
        <span className="nim-enc-popover" onClick={stop} onMouseDown={stop}>
          <code className="nim-enc-value">{shown ? plain : '•'.repeat(Math.min(Math.max(plain.length, 8), 24))}</code>
          <span className="nim-enc-actions">
            <button type="button" className="nim-enc-button" onClick={() => setShown(!shown)}>
              {shown ? '숨기기' : '보기'}
            </button>
            <button type="button" className="nim-enc-button nim-enc-button-primary" onClick={() => void copy()}>
              복사
            </button>
            {isEditable ? (
              <>
                <button type="button" className="nim-enc-button" onClick={() => void edit()}>
                  수정
                </button>
                <button type="button" className="nim-enc-button nim-enc-button-danger" onClick={removeEncryption}>
                  해제
                </button>
              </>
            ) : null}
          </span>
          {status ? <span className="nim-enc-status">{status}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
