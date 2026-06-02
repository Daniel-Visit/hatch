'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type RefinerComposerProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

const MAX_HEIGHT = 140;

export function RefinerComposer({ onSend, disabled = false }: RefinerComposerProps) {
  const t = useTranslations('Wanted');
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autosize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px';
  }

  function send() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    // Reset height after clearing
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    autosize();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="refiner-composer">
      <div className="refiner-composer-wrap">
        <textarea
          ref={textareaRef}
          placeholder={t('composer.placeholder')}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        <button className="send-btn" onClick={send} disabled={disabled}>
          →
        </button>
      </div>
      <div className="refiner-composer-hint">{t('composer.hint')}</div>
    </div>
  );
}
