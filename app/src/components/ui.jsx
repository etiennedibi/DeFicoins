import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useI18n } from '../i18n/index.jsx';

/* ---------- screen header ---------- */

export function TopBar({ title, onBack, right }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      <button className="topbar-btn" onClick={onBack || (() => nav(-1))} aria-label="Back">
        <Icon name="back" size={22} />
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

/* ---------- password input with reveal ---------- */

export function PasswordField({ value, onChange, placeholder, autoComplete = 'current-password', id }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <span className="adorn"><Icon name="lock" size={18} /></span>
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="adorn"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
      >
        <Icon name={shown ? 'eyeOff' : 'eye'} size={19} />
      </button>
    </div>
  );
}

/* ---------- language picker ---------- */

export function LanguagePicker() {
  const { lang, setLang, langs, current, t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="lang-chip" onClick={() => setOpen(true)} aria-label={t('settings.language')}>
        <span className="lang-flag">{current.flag}</span>
        <Icon name="chevronDown" size={15} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('lang.title')}>
        <ul className="lang-list">
          {langs.map((l) => (
            <li key={l.code}>
              <button
                className={'lang-row' + (l.code === lang ? ' is-active' : '')}
                onClick={() => { setLang(l.code); setOpen(false); }}
              >
                <span className="lang-flag">{l.flag}</span>
                <span className="lang-label">{l.label}</span>
                {l.code === lang && <Icon name="check" size={18} className="lang-check" />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

/* ---------- bottom sheet ---------- */

export function Sheet({ open, onClose, title, children, height }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <div
        className="sheet"
        style={height ? { maxHeight: height } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- misc ---------- */

export function Spinner({ size = 20 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Loading" />;
}

export function Banner({ tone = 'info', icon = 'info', children }) {
  return (
    <div className={'banner banner-' + tone}>
      <Icon name={icon} size={18} />
      <p>{children}</p>
    </div>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

/* Copies text and flips its label for a moment, so the tap has feedback
   even when the OS shows no toast. */
export function CopyButton({ text, label, copiedLabel, className = 'btn btn-primary' }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API is unavailable over plain http and in some webviews.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    setDone(true);
  }

  return (
    <button type="button" className={className} onClick={copy}>
      <Icon name={done ? 'check' : 'copy'} size={19} />
      {done ? copiedLabel : label}
    </button>
  );
}
