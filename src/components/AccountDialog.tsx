/**
 * Account modal: lets a guest save their progress (attach an email) or sign in to
 * an existing account, and lets a registered user rename themselves or sign out.
 * Passwordless — both email flows send a magic link (see AuthProvider).
 */
import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import './AccountDialog.css';

type View = 'menu' | 'save' | 'signin' | 'sent';

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const [view, setView] = useState<View>('menu');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- name editing (registered users) ---
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(auth.displayName ?? '');

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setBusy(true);
    setError(null);
    const fn = view === 'save' ? auth.upgradeWithEmail : auth.signInWithEmail;
    const { error: err } = await fn(addr);
    setBusy(false);
    if (err) {
      // The most common upgrade failure: that email is already a real account.
      setError(
        view === 'save' && /registered|already/i.test(err)
          ? 'That email already has an account — use “Sign in” instead.'
          : err,
      );
      return;
    }
    setView('sent');
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await auth.updateDisplayName(name);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setEditingName(false);
  };

  return (
    <div className="acct" role="dialog" aria-modal="true" aria-label="Account" onClick={onClose}>
      <div className="acct__card" onClick={(e) => e.stopPropagation()}>
        <button className="acct__close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {auth.isAnonymous ? (
          // ---------------------------------------------------------------- guest
          view === 'menu' ? (
            <>
              <h2 className="acct__h2">Your account</h2>
              <p className="acct__sub">
                Playing as <strong>{auth.displayName ?? 'guest'}</strong> (guest). Save your account
                to keep your name and stats across devices.
              </p>
              <div className="acct__actions">
                <button
                  className="btn btn--primary acct__btn"
                  onClick={() => {
                    setError(null);
                    setView('save');
                  }}
                >
                  Save your account
                </button>
                <button
                  className="btn btn--ghost acct__btn"
                  onClick={() => {
                    setError(null);
                    setView('signin');
                  }}
                >
                  Sign in
                </button>
              </div>
            </>
          ) : view === 'sent' ? (
            <SentNotice email={email} onClose={onClose} />
          ) : (
            <EmailForm
              title={view === 'save' ? 'Save your account' : 'Sign in'}
              hint={
                view === 'save'
                  ? 'We’ll email you a link to confirm. Your current name and stats are kept.'
                  : 'We’ll email you a link to sign in to your existing account.'
              }
              cta={view === 'save' ? 'Send confirmation' : 'Send sign-in link'}
              email={email}
              setEmail={setEmail}
              busy={busy}
              error={error}
              onSubmit={submitEmail}
              onBack={() => {
                setError(null);
                setView('menu');
              }}
            />
          )
        ) : (
          // ----------------------------------------------------------- registered
          <>
            <h2 className="acct__h2">Your account</h2>
            {editingName ? (
              <form className="acct__nameform" onSubmit={saveName}>
                <input
                  className="acct__input"
                  value={name}
                  maxLength={24}
                  autoFocus
                  aria-label="Display name"
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="acct__actions">
                  <button className="btn btn--primary acct__btn" disabled={busy} type="submit">
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className="btn btn--ghost acct__btn"
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setName(auth.displayName ?? '');
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="acct__name">{auth.displayName ?? 'Player'}</p>
                {auth.email && <p className="acct__email">{auth.email}</p>}
                <div className="acct__actions">
                  <button
                    className="btn btn--ghost acct__btn"
                    onClick={() => {
                      setName(auth.displayName ?? '');
                      setEditingName(true);
                    }}
                  >
                    Edit name
                  </button>
                  <button
                    className="btn btn--ghost acct__btn"
                    onClick={async () => {
                      await auth.signOut();
                      onClose();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
            {error && <p className="acct__error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function EmailForm({
  title,
  hint,
  cta,
  email,
  setEmail,
  busy,
  error,
  onSubmit,
  onBack,
}: {
  title: string;
  hint: string;
  cta: string;
  email: string;
  setEmail: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <h2 className="acct__h2">{title}</h2>
      <p className="acct__sub">{hint}</p>
      <input
        className="acct__input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        autoFocus
        aria-label="Email address"
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <p className="acct__error">{error}</p>}
      <div className="acct__actions">
        <button className="btn btn--primary acct__btn" disabled={busy || !email.trim()} type="submit">
          {busy ? 'Sending…' : cta}
        </button>
        <button className="btn btn--ghost acct__btn" type="button" onClick={onBack}>
          Back
        </button>
      </div>
    </form>
  );
}

function SentNotice({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <>
      <h2 className="acct__h2">Check your email</h2>
      <p className="acct__sub">
        We sent a link to <strong>{email}</strong>. Open it on this device to finish — you’ll come
        right back here, signed in.
      </p>
      <div className="acct__actions">
        <button className="btn btn--primary acct__btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </>
  );
}
