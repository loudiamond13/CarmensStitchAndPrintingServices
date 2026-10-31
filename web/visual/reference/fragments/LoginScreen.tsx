// Reference side of the S1 Sign in page (plan 04-32; test only, never shipped): a JSX transcription of App. E.5, the
// `div.s-login` (the `.s-login-brand.s-mesh` panel and the `.s-login-form` column holding `form.s-login-card`), with the
// frozen App. D.3 Logo, Field, PasswordField, Button and Icon, for the `state` prop default | error | loading and the
// App. E.5 values (email paolo.garcia@example.com; password empty, then "tahi2026"; the button reads "Sign In" or
// "Signing in"). Deviations, all listed in docs/web/parity.md section 6:
//   - D-03 (owner): "Keep me signed in" is drawn unticked. App. E.5 ticks it.
//   - The quote reads "Orders, payments and expenses, all in one place." (the OR-4 rewrite of the spec's long dash,
//     UI-SPEC "Copy").
//   - The form column is a `main` (spec §11: one main per page; the converted AuthFrame renders it), not a div.
//   - The frame keeps the mockup's `min-height: 960px` (the converted preview fixes the same height).
//   - Links carry router paths instead of design-canvas hrefs (attributes are not compared); "Forgot password?" is a
//     link to the forgot-password screen (D-16, App. E.5 shows a toast).
//   - The converted ErrorState gives the banner's text block `flex: 1 1 0%; min-width: 0` so a long message or reference
//     wraps inside the banner (UI-SPEC long-text backstop). The same two values are written inline on the frozen text
//     block; with the same words the look does not change.
//   - The converted Checkbox (assumption A12) is a label holding a grid cell with the box and a hidden tick, not a bare
//     input. The cell, the box's grid placement and its item display (the D-03 rule draws the tick as a ::before and so
//     makes the box a centring grid) are written inline here so the two trees pair; the box look is the D-03 ruling.
// The frozen components come from the extracted spec module, loaded the way kit.ts loads it (import.meta.glob, so the
// frozen code is never type-checked).
import type { ComponentType, ReactNode } from 'react';

type ModuleExports = Readonly<Record<string, unknown>>;

const spec = Object.values(import.meta.glob<ModuleExports>('../../.reference-src/ui/index.tsx', { eager: true }))[0];

function frozen<P extends object>(name: string): ComponentType<P> {
  const component = spec?.[name];
  if (typeof component !== 'function') {
    throw new Error(`The frozen spec has no ${name}. Run node visual/reference/extract-spec.mjs.`);
  }
  return component as ComponentType<P>;
}

const Logo = frozen<{ size?: string }>('Logo');
const Icon = frozen<{ name: string; size?: number }>('Icon');
const Field = frozen<{ label?: string; type?: string; defaultValue?: string; autoComplete?: string }>('Field');
const PasswordField = frozen<{ label?: string; defaultValue?: string; autoComplete?: string }>('PasswordField');
const Button = frozen<{
  variant?: string;
  size?: string;
  block?: boolean;
  loading?: boolean;
  iconRight?: string;
  type?: 'submit' | 'button';
  children?: ReactNode;
}>('Button');

export interface LoginScreenProps {
  state?: 'default' | 'error' | 'loading';
}

export function LoginScreen({ state = 'default' }: LoginScreenProps) {
  const loading = state === 'loading';
  return (
    <div className="s-login" style={{ minHeight: 960 }}>
      <div className="s-login-brand s-mesh">
        <div className="s-login-slab" />
        <div className="s-login-bands" />
        <span className="s-login-num">C</span>
        <div style={{ position: 'relative' }}>
          <Logo size="lg" />
        </div>
        <div className="s-login-quote">
          <span className="s-eyebrow">Staff area</span>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            Orders, payments and expenses, all in one place.
          </p>
        </div>
      </div>

      <main className="s-login-form">
        <form className="s-login-card" aria-label="Sign in">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="s-eyebrow">CSPS Admin</span>
            <h1>Sign in</h1>
            <p className="s-small s-muted">Use the email and password your manager set up for you.</p>
          </div>

          {state === 'error' && (
            <div className="s-banner is-danger" role="alert">
              <Icon name="triangle-alert" size={20} />
              <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                <strong>Email or password is incorrect.</strong>
                <span>Check for typos, or ask your manager to reset your password.</span>
              </div>
            </div>
          )}

          <Field label="Email" type="email" defaultValue="paolo.garcia@example.com" autoComplete="username" />
          <PasswordField
            label="Password"
            defaultValue={state === 'default' ? '' : 'tahi2026'}
            autoComplete="current-password"
          />

          <div className="s-login-row">
            <label className="s-check">
              <span style={{ display: 'grid', flex: 'none' }}>
                {/* D-03: unticked at rest (App. E.5 draws it ticked). The box sits in the cell as a plain grid item. */}
                <input
                  type="checkbox"
                  style={{
                    gridColumnStart: 1,
                    gridRowStart: 1,
                    display: 'block',
                    justifyContent: 'normal',
                    alignContent: 'normal',
                    flexShrink: 1,
                  }}
                />
              </span>
              Keep me signed in
            </label>
            <a className="s-link s-small" href="/admin/forgot-password">
              Forgot password?
            </a>
          </div>

          <Button variant="primary" size="lg" block loading={loading} iconRight="arrow-right" type="submit">
            {loading ? 'Signing in' : 'Sign In'}
          </Button>

          <div className="s-note">
            <Icon name="shield-check" size={18} />
            <span>Staff only. Customer orders are placed through the public site or Messenger.</span>
          </div>
          <a className="s-back" href="/">
            <Icon name="chevron-left" size={16} />
            Back to the CSPS website
          </a>
        </form>
      </main>
    </div>
  );
}
