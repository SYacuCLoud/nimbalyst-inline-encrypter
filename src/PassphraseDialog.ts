/**
 * Minimal modal prompts built with plain DOM so they can be opened from
 * Lexical decorators, slash command handlers and AI tool handlers alike.
 */

interface FieldSpec {
  name: string;
  label: string;
  type: 'password' | 'text';
  value?: string;
}

function openModal(
  title: string,
  fields: FieldSpec[],
  validate: (values: Record<string, string>) => string | null,
  initialError?: string,
): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'nim-enc-overlay';

    const form = document.createElement('form');
    form.className = 'nim-enc-dialog';
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');

    const heading = document.createElement('div');
    heading.className = 'nim-enc-dialog-title';
    heading.textContent = `🔒 ${title}`;
    form.appendChild(heading);

    const inputs: Record<string, HTMLInputElement> = {};
    for (const field of fields) {
      const label = document.createElement('label');
      label.className = 'nim-enc-field';
      const caption = document.createElement('span');
      caption.textContent = field.label;
      const input = document.createElement('input');
      input.type = field.type;
      input.value = field.value ?? '';
      input.autocomplete = 'off';
      input.spellcheck = false;
      label.append(caption, input);
      form.appendChild(label);
      inputs[field.name] = input;
    }

    const errorLine = document.createElement('div');
    errorLine.className = 'nim-enc-error';
    errorLine.textContent = initialError ?? '';
    form.appendChild(errorLine);

    const actions = document.createElement('div');
    actions.className = 'nim-enc-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'nim-enc-button';
    cancel.textContent = '취소';
    const ok = document.createElement('button');
    ok.type = 'submit';
    ok.className = 'nim-enc-button nim-enc-button-primary';
    ok.textContent = '확인';
    actions.append(cancel, ok);
    form.appendChild(actions);

    overlay.appendChild(form);
    document.body.appendChild(overlay);

    const previousFocus = document.activeElement as HTMLElement | null;
    const finish = (result: Record<string, string> | null) => {
      // Drop references to typed secrets before removing the DOM.
      for (const input of Object.values(inputs)) input.value = '';
      overlay.remove();
      previousFocus?.focus?.();
      resolve(result);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values: Record<string, string> = {};
      for (const [name, input] of Object.entries(inputs)) values[name] = input.value;
      const problem = validate(values);
      if (problem) {
        errorLine.textContent = problem;
        return;
      }
      finish(values);
    });
    cancel.addEventListener('click', () => finish(null));
    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) finish(null);
    });
    form.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      }
    });

    const firstEmpty = fields.find((f) => !f.value) ?? fields[0];
    setTimeout(() => inputs[firstEmpty.name]?.focus(), 0);
  });
}

export async function promptPassphrase(options: {
  title: string;
  error?: string;
  confirm?: boolean;
}): Promise<{ passphrase: string } | null> {
  const fields: FieldSpec[] = [{ name: 'passphrase', label: 'Passphrase', type: 'password' }];
  if (options.confirm) {
    fields.push({ name: 'again', label: 'Passphrase 확인', type: 'password' });
  }
  const values = await openModal(
    options.title,
    fields,
    (v) => {
      if (!v.passphrase) return 'passphrase를 입력하세요.';
      if (options.confirm && v.passphrase !== v.again) return '두 passphrase가 일치하지 않습니다.';
      return null;
    },
    options.error,
  );
  return values ? { passphrase: values.passphrase } : null;
}

export async function promptSecret(options: {
  title: string;
  initial?: string;
}): Promise<string | null> {
  const values = await openModal(
    options.title,
    [{ name: 'secret', label: '비밀 값', type: 'password', value: options.initial }],
    (v) => (v.secret ? null : '값을 입력하세요.'),
  );
  return values ? values.secret : null;
}
