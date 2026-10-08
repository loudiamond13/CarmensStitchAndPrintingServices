/* CSPS design-system components — React + TypeScript port of the approved reference.
   DOM structure, class names and copy are identical to the reference. Styling lives in
   src/styles/components.css (.csp-*) — do not restyle these components with Tailwind utilities. */
// SPEC-DEVIATION: D-07. App. D.3 reconciled with the strict type and lint gates using the smallest fixes, each marked
// SPEC-DEVIATION and listed in web/SPEC-DEVIATIONS.md; the file is also Prettier-formatted (layout only). The frozen
// original is src/ui/__reference__/index.tsx, and src/ui/differential.test.tsx proves the rendered DOM is unchanged.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type SVGProps,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { ICONS, type IconName } from './icons';
// SPEC-DEVIATION: WEB-02 Mark without the raw-HTML prop. mark.tsx renders App. D.4 as JSX (same DOM).
import { MarkSvg } from './mark';
import {
  CASCADE_LABELS,
  ORDER_STATUSES,
  cascadeSentence,
  formatDate,
  formatPeso,
  orderTotals,
  passwordStrength,
  type CascadeCounts,
  type Order,
  type OrderImage,
  type OrderStatus,
  type Role,
  type Totals,
} from '../lib/csps';

export * from '../lib/csps';
export type { IconName };

/* ───────────── links (router-agnostic) ─────────────
   Wrap the app once: <LinkProvider component={RouterLink}>…</LinkProvider>
   (React Router's <Link to> renders a plain <a>, so the DOM matches the reference). */

type LinkComponent = ComponentType<
  { to: string; className?: string; children?: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>
>;
const LinkCtx = createContext<LinkComponent | null>(null);
// SPEC-DEVIATION: kept for API compatibility only; UiLink no longer reads this context (see UiLink).
export function LinkProvider({ component, children }: { component: LinkComponent; children: ReactNode }) {
  return <LinkCtx.Provider value={component}>{children}</LinkCtx.Provider>;
}
export type UiLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };
// SPEC-DEVIATION: react-hooks static-components, exactOptionalPropertyTypes (TS2769) and jsx-a11y anchor-has-content.
// UiLink renders react-router's Link directly instead of the component from LinkProvider (React Router 8 is the only
// router, research Flag 2), and passes children explicitly. LinkProvider stays exported for API compatibility; the
// rendered <a> is the same as RouterLink's.
export function UiLink({ to, children, ...rest }: UiLinkProps) {
  const external = /^(https?:|mailto:|tel:|#)/.test(to);
  return external ? (
    <a href={to} {...rest}>
      {children}
    </a>
  ) : (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
}

/* ───────────── Icon ───────────── */

// SPEC-DEVIATION: D-10. `color` is left out because lucide-react reads it as the stroke colour instead of passing it to
// the svg; icons take their colour from CSS (stroke currentColor), and no App. D.3 call site passes it.
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'color'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  label?: string;
}
// SPEC-DEVIATION: D-10 lucide-react wrapper. Renders ICONS[name] (lucide-react 1.52.0) with the App. D.3 svg wrapper:
// class csp-icon, width/height = size, viewBox 0 0 24 24, fill none, stroke currentColor, stroke-width, round caps and
// joins, aria-hidden unless labelled (then role img + aria-label). lucide-react supplies xmlns, viewBox, fill, stroke
// and the caps/joins defaults and adds its own `lucide lucide-<name>` classes (D-28). ICONS covers every IconName, so
// the verbatim `if (!nodes) return null` guard was unreachable (no-unnecessary-condition) and is gone.
export function Icon({ name, size = 20, strokeWidth = 2, className, label, ...rest }: IconProps) {
  const LucideIcon = ICONS[name];
  return (
    <LucideIcon
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={clsx('csp-icon', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...rest}
    />
  );
}

/* ───────────── Brand ───────────── */

export interface MarkProps {
  size?: number;
  label?: string;
  className?: string;
}
/** The CSPS mark: a stitched C with a needle threaded through it. */
// SPEC-DEVIATION: WEB-02, no-restricted-syntax (CWE-79). The mark's elements are JSX children of MarkSvg instead of
// an innerHTML string; MarkSvg supplies viewBox 0 0 512 512 and xmlns.
export function Mark({ size = 40, label, className }: MarkProps) {
  return (
    <MarkSvg
      className={clsx('csp-mark', className)}
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

const MARK_SIZE = { sm: 36, md: 56, lg: 104 } as const;
export interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'wordmark' | 'mark';
  tagline?: boolean;
  className?: string;
}
/** [C]SPS — the mark stands in for the C. */
export function Logo({ size = 'md', tagline = true, variant = 'full', className }: LogoProps) {
  return (
    <span
      className={clsx('csp-logo', 'csp-logo-' + size, 'csp-logo-v-' + variant, className)}
      role="img"
      aria-label="CSPS — Carmen's Stitch & Printing Services"
    >
      {variant === 'mark' && <Mark size={MARK_SIZE[size]} />}
      {variant === 'full' && (
        <span className="csp-logo-word" aria-hidden="true">
          <Mark size={MARK_SIZE[size]} className="csp-logo-c" />
          <span className="csp-logo-mark">
            SPS
            <span className="csp-logo-slash" />
          </span>
        </span>
      )}
      {variant === 'wordmark' && (
        <span className="csp-logo-mark" aria-hidden="true">
          CSPS
          <span className="csp-logo-slash" />
        </span>
      )}
      {variant !== 'mark' && tagline && (
        <span className="csp-logo-tag" aria-hidden="true">
          Carmen's Stitch
          <br />
          &amp; Printing Services
        </span>
      )}
    </span>
  );
}

export function StitchDivider({ label, className }: { label?: ReactNode; className?: string }) {
  return (
    <div className={clsx('csp-stitch-divider', className)} role="separator">
      {label && <span className="csp-stitch-label">{label}</span>}
    </div>
  );
}

export interface SectionCutProps {
  top?: boolean;
  bottom?: boolean;
  tone?: 'surface' | 'accent';
  mesh?: boolean;
  children?: ReactNode;
  className?: string;
}
export function SectionCut({
  top = true,
  bottom = true,
  tone = 'surface',
  mesh = false,
  children,
  className,
}: SectionCutProps) {
  return (
    <section
      className={clsx(
        'csp-cut',
        top && 'csp-cut-top',
        bottom && 'csp-cut-bottom',
        'csp-cut-' + tone,
        mesh && 'csp-mesh',
        className,
      )}
    >
      <div className="csp-cut-inner">{children}</div>
    </section>
  );
}

// SPEC-DEVIATION: exactOptionalPropertyTypes (TS2375 x3). label and number accept an explicit undefined, because
// ImageUploader, OrderCard and CategoryCard pass optional values straight through; same output.
export interface MediaPlaceholderProps {
  label?: string | undefined;
  number?: string | number | undefined;
  ratio?: string;
  className?: string;
}
export function MediaPlaceholder({ label, number, ratio = '4 / 3', className }: MediaPlaceholderProps) {
  return (
    <div
      className={clsx('csp-media-ph', 'csp-mesh', className)}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={label ? label + ' (no image yet)' : 'No image yet'}
    >
      {number != null && number !== '' && (
        <span className="csp-media-ph-num" aria-hidden="true">
          {number}
        </span>
      )}
      <span className="csp-media-ph-label">
        <Icon name="image" size={16} />
        {label || 'No image yet'}
      </span>
    </div>
  );
}

/* ───────────── Actions ───────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ghost-danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
}
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'csp-btn',
        'csp-btn-' + variant,
        'csp-btn-' + size,
        block && 'csp-btn-block',
        !children && 'csp-btn-icon',
        className,
      )}
    >
      {loading ? (
        <Icon name="loader-circle" size={18} className="csp-spin" />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />
      )}
      {children != null && children !== false && <span>{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}
/** Same look as Button, rendered as a link (the mockups use <a class="csp-btn …"> for navigation). */
export interface ButtonLinkProps extends UiLinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
}
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <UiLink {...rest} className={clsx('csp-btn', 'csp-btn-' + variant, 'csp-btn-' + size, className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </UiLink>
  );
}

/* ───────────── Status ───────────── */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'mockup' | 'danger' | 'solid';
export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}
export function Badge({ tone = 'neutral', dot = false, icon, children, className }: BadgeProps) {
  return (
    <span className={clsx('csp-badge', 'csp-badge-' + tone, className)}>
      {dot && <span className="csp-badge-dot" aria-hidden="true" />}
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'neutral',
  mockup: 'mockup',
  production: 'warning',
  ready: 'info',
  completed: 'success',
  cancelled: 'danger',
};
export const PAYMENT_TONE: Record<string, BadgeTone> = {
  GCash: 'info',
  Maya: 'success',
  Cash: 'neutral',
  'Bank Transfer': 'mockup',
};
export const EXPENSE_TONE: Record<string, BadgeTone> = {
  Rent: 'accent',
  Utilities: 'info',
  Salaries: 'mockup',
  Supplies: 'warning',
  Equipment: 'success',
  Maintenance: 'neutral',
  Others: 'neutral',
};

export function StatusBadge({ status = 'pending', className }: { status?: OrderStatus; className?: string }) {
  // SPEC-DEVIATION: no-unnecessary-condition. The maps are read as partial so the fallbacks still cover a status
  // string the types do not know (data from the API); same output.
  const tones: Partial<Record<string, BadgeTone>> = STATUS_TONE;
  const labels: Partial<Record<string, string>> = ORDER_STATUSES;
  return (
    <Badge tone={tones[status] ?? 'neutral'} dot className={clsx('csp-status', className)}>
      {labels[status] ?? status}
    </Badge>
  );
}

export function Avatar({ name = '', size = 36, className }: { name?: string; size?: number; className?: string }) {
  // SPEC-DEVIATION: noUncheckedIndexedAccess (TS2532). charAt(0) is p[0] for the non-empty words left by filter.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return (
    <span
      className={clsx('csp-avatar', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-label={name}
    >
      {initials}
    </span>
  );
}

/* ───────────── Forms ───────────── */

// SPEC-DEVIATION: lint consistent-type-definitions (interface instead of type alias); same type.
interface FieldBase {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  prefix?: string;
  required?: boolean;
  className?: string;
  id?: string;
}
export type FieldProps =
  | (FieldBase & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>)
  | (FieldBase & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'>);
export function Field(props: FieldProps) {
  const { label, hint, error, prefix, required, multiline = false, id, className, ...rest } = props;
  const fid = useId();
  const iid = id || fid;
  const describedBy = error || hint ? iid + '-msg' : undefined;
  const common = {
    id: iid,
    className: 'csp-input',
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy,
    required,
  };
  return (
    <div className={clsx('csp-field', error && 'is-invalid', className)}>
      {label && (
        <label className="csp-label" htmlFor={iid}>
          {label}
          {required && (
            <span className="csp-req" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      <div className={clsx('csp-control', prefix && 'has-prefix', multiline && 'is-multiline')}>
        {prefix && (
          <span className="csp-prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
        ) : (
          <input {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
        )}
      </div>
      {(error || hint) && (
        <p id={iid + '-msg'} className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>
          {error && <Icon name="triangle-alert" size={14} />}
          {error || hint}
        </p>
      )}
    </div>
  );
}

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> {
  label?: string;
  showStrength?: boolean;
  error?: string;
  hint?: ReactNode;
  value?: string;
  defaultValue?: string;
}
export function PasswordField({
  label = 'Password',
  showStrength = false,
  value,
  defaultValue,
  onChange,
  error,
  hint,
  ...rest
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? '');
  const v = value ?? inner;
  const st = passwordStrength(v);
  const fid = useId();
  return (
    <div className={clsx('csp-field', error && 'is-invalid')}>
      <label className="csp-label" htmlFor={fid}>
        {label}
      </label>
      <div className="csp-control has-suffix">
        <input
          id={fid}
          className="csp-input"
          type={shown ? 'text' : 'password'}
          value={v}
          aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? fid + '-msg' : undefined}
          onChange={(e) => {
            setInner(e.target.value);
            onChange?.(e);
          }}
          {...rest}
        />
        {/* SPEC-DEVIATION: lint no-confusing-void-expression (block-bodied handlers here and below); same behaviour. */}
        <button
          type="button"
          className="csp-suffix-btn"
          onClick={() => {
            setShown(!shown);
          }}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
      {/* SPEC-DEVIATION: lint restrict-plus-operands (template with String(); same class names here and below). */}
      {showStrength && (
        <div className={clsx('csp-strength', `is-${String(st.score)}`)} aria-live="polite">
          <div className="csp-strength-bars" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={i <= st.score ? 'on' : ''} />
            ))}
          </div>
          <span className="csp-strength-label">{v ? st.label : 'Use 8+ characters with a number and a symbol'}</span>
        </div>
      )}
      {(error || hint) && (
        <p id={fid + '-msg'} className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>
          {error && <Icon name="triangle-alert" size={14} />}
          {error || hint}
        </p>
      )}
    </div>
  );
}

export type SelectOption = string | { value: string; label: string };
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
}
// SPEC-DEVIATION: lint no-useless-default-assignment (options is required; also SegmentedControl, Tabs, DataTable,
// IncomeExpenseChart and ProcessSteps); same output for every typed call.
export function Select({ label, options, placeholder, error, hint, className, ...rest }: SelectProps) {
  const fid = useId();
  return (
    <div className={clsx('csp-field', error && 'is-invalid', className)}>
      {label && (
        <label className="csp-label" htmlFor={fid}>
          {label}
        </label>
      )}
      <div className="csp-control csp-select">
        <select id={fid} className="csp-input" aria-invalid={!!error || undefined} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const v = typeof o === 'string' ? o : o.value;
            return (
              <option key={v} value={v}>
                {typeof o === 'string' ? o : o.label}
              </option>
            );
          })}
        </select>
        <Icon name="chevron-down" size={18} className="csp-select-chev" />
      </div>
      {(error || hint) && <p className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>{error || hint}</p>}
    </div>
  );
}

export interface SegmentOption<V extends string = string> {
  value: V;
  label: string;
  icon?: IconName;
  showLabel?: boolean;
}
export interface SegmentedControlProps<V extends string = string> {
  options: readonly SegmentOption<V>[];
  value?: V;
  onChange?: (v: V) => void;
  label?: string;
}
export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<V>) {
  const [inner, setInner] = useState<V | undefined>(value ?? options[0]?.value);
  const cur = value ?? inner;
  return (
    <div className="csp-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={cur === o.value}
          className={clsx('csp-seg-btn', cur === o.value && 'is-on')}
          onClick={() => {
            setInner(o.value);
            onChange?.(o.value);
          }}
          aria-label={o.label && !o.showLabel && o.icon ? o.label : undefined}
          title={o.label}
        >
          {o.icon && <Icon name={o.icon} size={18} />}
          {(o.showLabel || !o.icon) && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export interface TabItem<I extends string = string> {
  id: I;
  label: string;
  count?: number;
}
export interface TabsProps<I extends string = string> {
  items: readonly TabItem<I>[];
  value?: I;
  onChange?: (id: I) => void;
}
export function Tabs<I extends string = string>({ items, value, onChange }: TabsProps<I>) {
  const [inner, setInner] = useState<I | undefined>(value ?? items[0]?.id);
  const cur = value ?? inner;
  return (
    <div className="csp-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={cur === t.id}
          className={clsx('csp-tab', cur === t.id && 'is-on')}
          onClick={() => {
            setInner(t.id);
            onChange?.(t.id);
          }}
        >
          {t.label}
          {t.count != null && <span className="csp-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Drag-drop or browse; thumbnails; drag to reorder; the first image is the cover. */
export interface ImageUploaderProps {
  images?: OrderImage[];
  defaultImages?: OrderImage[];
  onChange?: (images: OrderImage[]) => void;
  onFiles?: (files: File[]) => void;
  max?: number;
}
export function ImageUploader({ images, defaultImages = [], onChange, onFiles, max = 12 }: ImageUploaderProps) {
  const [inner, setInner] = useState<OrderImage[]>(defaultImages);
  const list = images ?? inner;
  const set = (next: OrderImage[]) => {
    setInner(next);
    onChange?.(next);
  };
  const [over, setOver] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null) => {
    // SPEC-DEVIATION: lint prefer-string-starts-ends-with and restrict-plus-operands; same filter and ids.
    const picked = Array.from(files ?? [])
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, max - list.length);
    if (!picked.length) return;
    onFiles?.(picked);
    set(
      list.concat(
        picked.map((f, i) => ({
          id: `up-${String(Date.now())}-${String(i)}`,
          name: f.name,
          src: URL.createObjectURL(f),
        })),
      ),
    );
  };
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = list.slice();
    const [m] = next.splice(from, 1);
    // SPEC-DEVIATION: noUncheckedIndexedAccess (TS2345). `from` is always a list index, so m is always defined.
    if (m === undefined) return;
    next.splice(to, 0, m);
    set(next);
  };
  // SPEC-DEVIATION: jsx-a11y no-static-element-interactions / no-noninteractive-element-interactions. The drop zone and
  // thumbnail drag handlers are native listeners attached through callback refs (React 19 ref cleanup) instead of JSX
  // props; no DOM change. The keyboard-accessible reorder is Phase 9.
  const dropZoneRef = (zone: HTMLDivElement | null) => {
    if (zone === null) return;
    const onDragOver = (e: DragEvent) => {
      if (dragFrom.current == null) {
        e.preventDefault();
        setOver(true);
      }
    };
    const onDragLeave = () => {
      setOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      if (dragFrom.current == null) addFiles(e.dataTransfer?.files ?? null);
    };
    zone.addEventListener('dragover', onDragOver);
    zone.addEventListener('dragleave', onDragLeave);
    zone.addEventListener('drop', onDrop);
    return () => {
      zone.removeEventListener('dragover', onDragOver);
      zone.removeEventListener('dragleave', onDragLeave);
      zone.removeEventListener('drop', onDrop);
    };
  };
  const thumbRef = (i: number) => (thumb: HTMLLIElement | null) => {
    if (thumb === null) return;
    const onDragStart = () => {
      dragFrom.current = i;
    };
    const onDragEnd = () => {
      dragFrom.current = null;
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      if (dragFrom.current != null) move(dragFrom.current, i);
      dragFrom.current = null;
    };
    thumb.addEventListener('dragstart', onDragStart);
    thumb.addEventListener('dragend', onDragEnd);
    thumb.addEventListener('dragover', onDragOver);
    thumb.addEventListener('drop', onDrop);
    return () => {
      thumb.removeEventListener('dragstart', onDragStart);
      thumb.removeEventListener('dragend', onDragEnd);
      thumb.removeEventListener('dragover', onDragOver);
      thumb.removeEventListener('drop', onDrop);
    };
  };
  return (
    <div className="csp-uploader">
      <div ref={dropZoneRef} className={clsx('csp-drop', over && 'is-over')}>
        <Icon name="cloud-upload" size={28} />
        <p className="csp-drop-title">
          Drag images here or{' '}
          <button
            type="button"
            className="csp-linkbtn"
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            browse
          </button>
        </p>
        <p className="csp-drop-hint">
          JPG, PNG or WEBP · up to 10 MB each · {list.length}/{max}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
          }}
        />
      </div>
      {list.length > 0 && (
        <ul className="csp-thumbs" aria-label="Order images — drag to reorder; the first is the cover">
          {list.map((img, i) => (
            <li key={img.id} ref={thumbRef(i)} className={clsx('csp-thumb', i === 0 && 'is-cover')} draggable>
              {img.src ? (
                <img src={img.src} alt={img.name || `Order image ${String(i + 1)}`} />
              ) : (
                <MediaPlaceholder label={img.name} number={img.number} ratio="1 / 1" />
              )}
              {i === 0 && <span className="csp-thumb-cover">Cover</span>}
              <span className="csp-thumb-grip" aria-hidden="true">
                <Icon name="grip-vertical" size={16} />
              </span>
              <div className="csp-thumb-actions">
                {i > 0 && (
                  <button
                    type="button"
                    className="csp-thumb-btn"
                    onClick={() => {
                      move(i, 0);
                    }}
                    aria-label="Make cover image"
                  >
                    <Icon name="star" size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="csp-thumb-btn"
                  onClick={() => {
                    set(list.filter((x) => x.id !== img.id));
                  }}
                  aria-label={`Remove ${img.name || 'image'}`}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Data display ───────────── */

export function Money({
  amount,
  size = 'md',
  tone,
  className,
}: {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'success' | 'warning' | 'danger' | 'muted';
  className?: string;
}) {
  return (
    <span className={clsx('csp-money', 'csp-money-' + size, tone && 'tone-' + tone, className)}>
      {formatPeso(amount)}
    </span>
  );
}

export interface KpiCardProps {
  label: string;
  value: number | string;
  money?: boolean;
  icon?: IconName;
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  loading?: boolean;
}
export function KpiCard({ label, value, money = true, icon, delta, deltaLabel, hint, loading = false }: KpiCardProps) {
  const up = delta != null && delta >= 0;
  return (
    <div className="csp-card csp-kpi" aria-busy={loading || undefined}>
      <div className="csp-kpi-head">
        <span className="csp-overline">{label}</span>
        {icon && (
          <span className="csp-kpi-icon">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton width="70%" height={36} />
      ) : (
        <div className="csp-kpi-value">{money && typeof value === 'number' ? formatPeso(value) : value}</div>
      )}
      {(delta != null || hint) && !loading && (
        <div className="csp-kpi-foot">
          {delta != null && (
            <span className={clsx('csp-delta', up ? 'is-up' : 'is-down')}>
              <Icon name={up ? 'trending-up' : 'trending-down'} size={14} />
              {Math.abs(delta)}%
            </span>
          )}
          <span>{deltaLabel || hint}</span>
        </div>
      )}
    </div>
  );
}

/** variant "card" = compact block inside OrderCard; "panel" = order detail (adds expenses + profit). */
export function OrderTotals({
  order,
  totals,
  variant = 'panel',
}: {
  order?: Partial<Order>;
  totals?: Totals;
  variant?: 'card' | 'panel';
}) {
  const t = totals ?? orderTotals(order);
  // SPEC-DEVIATION: lint array-type (T[] instead of Array<T>, also ADMIN_NAV and ProcessSteps); same type.
  const rows: [string, number][] = [
    ['Total', t.total],
    ['Total Discount', -t.discount],
    ['Total Paid', -t.paid],
  ];
  return (
    <div className={clsx('csp-totals', 'csp-totals-' + variant)}>
      <dl className="csp-totals-rows">
        {rows.map(([k, v]) => (
          <div key={k} className="csp-totals-row">
            <dt>{k}</dt>
            <dd>{formatPeso(v)}</dd>
          </div>
        ))}
      </dl>
      <div className={clsx('csp-balance', t.fullyPaid ? 'is-paid' : 'is-due')}>
        <span className="csp-overline">{t.fullyPaid ? 'Balance' : 'Balance due'}</span>
        {t.fullyPaid ? (
          <span className="csp-balance-paid">
            <Icon name="circle-check" size={variant === 'card' ? 18 : 22} />
            Fully Paid
          </span>
        ) : (
          <span className="csp-balance-value">{formatPeso(t.balance)}</span>
        )}
      </div>
      {variant === 'panel' && (
        <dl className="csp-totals-rows csp-totals-internal">
          <div className="csp-totals-row">
            <dt>Order Expenses</dt>
            <dd>{formatPeso(t.expenses)}</dd>
          </div>
          <div className="csp-totals-row is-strong">
            <dt>Estimated Profit</dt>
            <dd className={t.profit < 0 ? 'is-neg' : ''}>{formatPeso(t.profit)}</dd>
          </div>
          <p className="csp-totals-note">Profit = Total − Discount − Expenses. Internal only.</p>
        </dl>
      )}
    </div>
  );
}

export interface OrderCardProps {
  order: Order;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}
export function OrderCard({ order, onView, onEdit, onDelete }: OrderCardProps) {
  const o = order;
  const t = orderTotals(o);
  const images = o.images ?? [];
  const cover = images[0];
  // SPEC-DEVIATION: lint no-unnecessary-type-conversion. Number() is kept for a quantity that arrives as text, so the
  // value is read as unknown first; same sum.
  const qty = (o.items ?? []).reduce((s, i) => s + (Number(i.quantity as unknown) || 0), 0);
  return (
    <article className="csp-card csp-order-card">
      <button type="button" className="csp-order-media" onClick={onView} aria-label={'View order ' + o.number}>
        {cover?.src ? (
          <img src={cover.src} alt="" />
        ) : (
          <MediaPlaceholder label={cover ? cover.name : 'No images yet'} number={cover?.number} ratio="16 / 10" />
        )}
        <span className="csp-order-status">
          <StatusBadge status={o.status} />
        </span>
        {images.length > 1 && (
          <span className="csp-order-count">
            <Icon name="image" size={14} />
            {images.length}
          </span>
        )}
      </button>
      <div className="csp-order-body">
        <div className="csp-order-head">
          <span className="csp-order-no">{o.number}</span>
          <span className="csp-order-qty">{qty} pcs</span>
        </div>
        <h3 className="csp-order-team">{o.team || o.customer}</h3>
        <p className="csp-order-cust">{o.team ? o.customer : ''}</p>
        <div className="csp-order-dates">
          <span>
            <Icon name="calendar" size={14} />
            {formatDate(o.orderDate)}
          </span>
          <span className={clsx(o.overdue && 'is-overdue')}>
            <Icon name="clock" size={14} />
            Due {formatDate(o.dueDate)}
          </span>
        </div>
        <OrderTotals totals={t} variant="card" />
      </div>
      <div className="csp-order-actions">
        <Button size="sm" variant="ghost" icon="eye" onClick={onView}>
          View
        </Button>
        <Button size="sm" variant="ghost" icon="pencil" onClick={onEdit}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost-danger"
          icon="trash-2"
          onClick={onDelete}
          aria-label={'Delete order ' + o.number}
        />
      </div>
    </article>
  );
}

export interface DataTableColumn<R> {
  key: string;
  label: ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  money?: boolean;
  render?: (row: R) => ReactNode;
}
export interface DataTableProps<R> {
  columns: DataTableColumn<R>[];
  rows: R[];
  rowKey?: keyof R & string;
  loading?: boolean;
  error?: string;
  empty?: ReactNode;
  caption?: string;
}
export function DataTable<R extends Record<string, unknown>>({
  columns,
  rows,
  loading = false,
  error,
  empty,
  rowKey,
  caption,
}: DataTableProps<R>) {
  return (
    <div className="csp-table-wrap">
      <table className="csp-table">
        {caption && <caption className="csp-sr">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            [0, 1, 2, 3].map((i) => (
              <tr key={`sk${String(i)}`} aria-hidden="true">
                {columns.map((c) => (
                  <td key={c.key}>
                    <Skeleton width={c.align === 'right' ? '60%' : '80%'} height={14} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && error && (
            <tr>
              <td colSpan={columns.length}>
                <div className="csp-table-state is-error">
                  <Icon name="triangle-alert" size={18} />
                  {error}
                </div>
              </td>
            </tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>{empty || <div className="csp-table-state">Nothing here yet.</div>}</td>
            </tr>
          )}
          {!loading &&
            !error &&
            rows.map((r, ri) => (
              <tr key={rowKey ? String(r[rowKey]) : ri}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align || 'left' }} className={c.money ? 'is-num' : undefined}>
                    {c.render ? c.render(r) : c.money ? formatPeso(r[c.key] as number) : (r[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/** Monthly income vs expenses — grouped bars, single axis. */
export interface ChartDatum {
  month: string;
  income: number;
  expenses: number;
}
export function IncomeExpenseChart({ data, height = 220 }: { data: ChartDatum[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const W = 640,
    H = height,
    L = 52,
    B = 28,
    T = 12;
  const gw = (W - L) / Math.max(1, data.length);
  const bw = Math.min(18, gw / 3.2);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = [0, 0.5, 1].map((f) => top * f);
  // SPEC-DEVIATION: lint restrict-plus-operands / restrict-template-expressions (String() in templates here, in the
  // svg and tooltip below and in bar()); the same text, because a template literal already converts with String().
  const k = (v: number) => (v >= 1000 ? `₱${String(Math.round(v / 1000))}k` : `₱${String(v)}`);
  const cur = hover != null ? data[hover] : undefined;
  return (
    <figure className="csp-chart">
      <div className="csp-chart-legend">
        <span>
          <i className="sw-income" />
          Income (payments)
        </span>
        <span>
          <i className="sw-expense" />
          Expenses (company + orders)
        </span>
      </div>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        role="img"
        aria-label="Monthly income versus expenses"
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={L} x2={W} y1={y(tv)} y2={y(tv)} className="csp-chart-grid" />
            <text x={L - 8} y={y(tv) + 4} textAnchor="end" className="csp-chart-tick">
              {k(tv)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx0 = L + gw * i + gw / 2;
          return (
            <g
              key={d.month}
              onMouseEnter={() => {
                setHover(i);
              }}
            >
              <rect x={L + gw * i} y={T} width={gw} height={H - T - B} fill="transparent" />
              {hover === i && (
                <rect x={L + gw * i + 4} y={T} width={gw - 8} height={H - T - B} className="csp-chart-hover" rx="6" />
              )}
              <path d={bar(cx0 - bw - 1, y(d.income), bw, H - B - y(d.income))} className="csp-chart-income" />
              <path d={bar(cx0 + 1, y(d.expenses), bw, H - B - y(d.expenses))} className="csp-chart-expense" />
              <text x={cx0} y={H - 8} textAnchor="middle" className="csp-chart-tick">
                {d.month}
              </text>
            </g>
          );
        })}
        <line x1={L} x2={W} y1={H - B} y2={H - B} className="csp-chart-axis" />
      </svg>
      {cur && hover != null && (
        <div className="csp-chart-tip" style={{ left: `calc(${String(((L + gw * hover + gw / 2) / W) * 100)}% )` }}>
          <strong>{cur.month}</strong>
          <span>
            <i className="sw-income" />
            Income {formatPeso(cur.income)}
          </span>
          <span>
            <i className="sw-expense" />
            Expenses {formatPeso(cur.expenses)}
          </span>
          <span className="csp-chart-net">Net {formatPeso(cur.income - cur.expenses)}</span>
        </div>
      )}
    </figure>
  );
}
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  const n = String;
  return `M${n(x)},${n(y + h)}V${n(y + r)}Q${n(x)},${n(y)} ${n(x + r)},${n(y)}H${n(x + w - r)}Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + r)}V${n(y + h)}Z`;
}

/* ───────────── Overlays ───────────── */

export interface ModalProps {
  open?: boolean;
  title: string;
  description?: ReactNode;
  // SPEC-DEVIATION: exactOptionalPropertyTypes (TS2375). ConfirmDialog passes its optional onCancel straight through.
  onClose?: (() => void) | undefined;
  footer?: ReactNode;
  variant?: 'center' | 'slideover';
  /** Render without the fixed .csp-overlay backdrop (used inside .s-overlay, as in the mockups). */
  inline?: boolean;
  children?: ReactNode;
}
export function Modal({
  open = true,
  title,
  description,
  onClose,
  footer,
  variant = 'center',
  inline = false,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
    };
  }, [open, onClose]);
  // SPEC-DEVIATION: jsx-a11y no-static-element-interactions. The backdrop mousedown listener is attached through a
  // callback ref instead of a JSX prop; no DOM change. The focus trap is plan 02-11.
  const overlayRef = (overlay: HTMLDivElement | null) => {
    if (overlay === null) return;
    const onMouseDown = (e: MouseEvent) => {
      if (e.target === overlay) onClose?.();
    };
    overlay.addEventListener('mousedown', onMouseDown);
    return () => {
      overlay.removeEventListener('mousedown', onMouseDown);
    };
  };
  if (!open) return null;
  return (
    <div ref={overlayRef} className={clsx('csp-overlay', 'csp-overlay-' + variant, inline && 'is-inline')}>
      <div className={clsx('csp-modal', 'csp-modal-' + variant)} role="dialog" aria-modal="true" aria-label={title}>
        <header className="csp-modal-head">
          <div>
            <h2 className="csp-modal-title">{title}</h2>
            {description && <p className="csp-modal-desc">{description}</p>}
          </div>
          {onClose && (
            <button type="button" className="csp-iconbtn" onClick={onClose} aria-label="Close">
              <Icon name="x" size={20} />
            </button>
          )}
        </header>
        <div className="csp-modal-body">{children}</div>
        {footer && <footer className="csp-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  title?: string;
  message?: ReactNode;
  counts?: CascadeCounts;
  /** Type-to-confirm text (e.g. the order number). */
  confirmText?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  inline?: boolean;
  loading?: boolean;
}
export function ConfirmDialog({
  title = 'Delete this?',
  message,
  counts,
  confirmText,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  inline = false,
  loading = false,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const ok = !confirmText || typed.trim() === confirmText;
  const cascade = counts ? cascadeSentence(counts) : '';
  return (
    <Modal
      open
      title={title}
      onClose={onCancel}
      inline={inline}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" icon="trash-2" disabled={!ok} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="csp-confirm">
        <span className="csp-confirm-icon">
          <Icon name="triangle-alert" size={22} />
        </span>
        <div>
          {message && <p className="csp-confirm-msg">{message}</p>}
          {cascade && counts && (
            <div className="csp-cascade" role="alert">
              <p className="csp-cascade-lead">{cascade}</p>
              <ul className="csp-cascade-list">
                {CASCADE_LABELS.map(([k, one]) => {
                  const n = counts[k] ?? 0;
                  return (
                    <li key={k} className={n === 0 ? 'is-zero' : ''}>
                      <span>{n}</span>
                      {n === 1 ? one : k}
                    </li>
                  );
                })}
              </ul>
              <p className="csp-cascade-foot">This can't be undone.</p>
            </div>
          )}
          {confirmText && (
            <Field
              label={
                <>
                  Type <strong>{confirmText}</strong> to confirm
                </>
              }
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
              }}
              autoComplete="off"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';
export interface ToastProps {
  tone?: ToastTone;
  title: string;
  message?: ReactNode;
  onClose?: () => void;
  action?: ReactNode;
}
const TOAST_ICON: Record<ToastTone, IconName> = {
  success: 'circle-check',
  danger: 'triangle-alert',
  info: 'info',
  warning: 'triangle-alert',
};
export function Toast({ tone = 'success', title, message, onClose, action }: ToastProps) {
  return (
    <div className={clsx('csp-toast', 'csp-toast-' + tone)} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="csp-toast-icon">
        <Icon name={TOAST_ICON[tone]} size={20} />
      </span>
      <div className="csp-toast-text">
        <strong>{title}</strong>
        {message && <span>{message}</span>}
      </div>
      {action}
      {onClose && (
        <button type="button" className="csp-iconbtn" onClick={onClose} aria-label="Dismiss">
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}

/* ───────────── Navigation ───────────── */

export interface NavLinkItem {
  label: string;
  to: string;
}
export const SITE_LINKS: NavLinkItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
];
export interface SiteHeaderProps {
  links?: NavLinkItem[];
  active?: string;
  onQuote?: () => void;
}
export function SiteHeader({ links = SITE_LINKS, active = 'Home', onQuote }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className={clsx('csp-site-header', open && 'is-open')}>
      <div className="csp-site-header-in">
        <UiLink to="/" className="csp-site-logo">
          <Logo size="sm" />
        </UiLink>
        <nav className="csp-site-nav" aria-label="Main">
          {links.map((l) => (
            <UiLink
              key={l.label}
              to={l.to}
              className={clsx('csp-site-link', l.label === active && 'is-on')}
              aria-current={l.label === active ? 'page' : undefined}
            >
              {l.label}
            </UiLink>
          ))}
        </nav>
        <Button variant="primary" size="sm" iconRight="arrow-right" className="csp-site-cta" onClick={onQuote}>
          Get a Quote
        </Button>
        <button
          type="button"
          className="csp-iconbtn csp-site-burger"
          aria-expanded={open}
          aria-label="Menu"
          onClick={() => {
            setOpen(!open);
          }}
        >
          <Icon name={open ? 'x' : 'menu'} size={22} />
        </button>
      </div>
      {open && (
        <nav className="csp-site-drawer" aria-label="Mobile">
          {links.map((l) => (
            <UiLink
              key={l.label}
              to={l.to}
              onClick={() => {
                setOpen(false);
              }}
              className={clsx('csp-site-dlink', l.label === active && 'is-on')}
            >
              {l.label}
              <Icon name="arrow-right" size={20} />
            </UiLink>
          ))}
          <Button variant="primary" block iconRight="arrow-right" onClick={onQuote}>
            Get a Quote
          </Button>
        </nav>
      )}
    </header>
  );
}

export type AdminSection = 'dashboard' | 'orders' | 'expenses' | 'users' | 'profile';
export const ADMIN_NAV: { id: AdminSection; label: string; icon: IconName; to: string; manager?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', to: '/admin' },
  { id: 'orders', label: 'Orders', icon: 'clipboard-list', to: '/admin/orders' },
  { id: 'expenses', label: 'Company Expenses', icon: 'receipt', to: '/admin/expenses' },
  { id: 'users', label: 'Users', icon: 'users', to: '/admin/users', manager: true },
  { id: 'profile', label: 'My Profile', icon: 'user-round', to: '/admin/profile' },
];
export interface SidebarProps {
  active?: AdminSection;
  role?: Role;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onNavigate?: (id: AdminSection) => void;
  onLogout?: () => void;
  user?: { name: string };
}
export function Sidebar({
  active = 'dashboard',
  role = 'admin',
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onNavigate,
  onLogout,
  user,
}: SidebarProps) {
  const [c, setC] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? c;
  return (
    <aside className={clsx('csp-sidebar', collapsed && 'is-collapsed')}>
      <div className="csp-sidebar-top">
        {collapsed ? <Logo size="sm" variant="mark" /> : <Logo size="sm" tagline={false} />}
        <button
          type="button"
          className="csp-iconbtn"
          onClick={() => {
            setC(!collapsed);
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
        </button>
      </div>
      <nav className="csp-sidebar-nav" aria-label="Admin">
        {ADMIN_NAV.filter((n) => !n.manager || role === 'manager').map((n) => (
          <UiLink
            key={n.id}
            to={n.to}
            onClick={() => onNavigate?.(n.id)}
            className={clsx('csp-nav', active === n.id && 'is-on')}
            aria-current={active === n.id ? 'page' : undefined}
            title={collapsed ? n.label : undefined}
          >
            <Icon name={n.icon} size={20} />
            <span className="csp-nav-label">{n.label}</span>
            {n.manager && !collapsed && <span className="csp-nav-tag">Manager</span>}
          </UiLink>
        ))}
      </nav>
      <div className="csp-sidebar-foot">
        {user && !collapsed && (
          <div className="csp-sidebar-user">
            <Avatar name={user.name} size={32} />
            <div>
              <strong>{user.name}</strong>
              <span>{role === 'manager' ? 'Manager' : 'Admin'}</span>
            </div>
          </div>
        )}
        {/* SPEC-DEVIATION: D-27 (O-9), jsx-a11y anchor-is-valid. Logout is a button, not <a href="#">; same class,
            title and children, and the D-27 compat rule in overrides.css keeps the link look. */}
        <button
          type="button"
          className="csp-nav"
          onClick={() => {
            onLogout?.();
          }}
          title={collapsed ? 'Logout' : undefined}
        >
          <Icon name="log-out" size={20} />
          <span className="csp-nav-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export interface TopbarProps {
  user?: { name: string };
  role?: Role;
  placeholder?: string;
  onMenu?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onSearch?: (q: string) => void;
}
export function Topbar({
  user = { name: 'Carmen Reyes' },
  role = 'manager',
  placeholder = 'Search orders, customers, teams…',
  onMenu,
  theme,
  onToggleTheme,
  onSearch,
}: TopbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === '/' && !(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
    };
  }, []);
  return (
    <div className="csp-topbar">
      <button type="button" className="csp-iconbtn csp-topbar-menu" aria-label="Open navigation" onClick={onMenu}>
        <Icon name="menu" size={20} />
      </button>
      <label className="csp-search">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          aria-label="Search"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch?.(e.currentTarget.value);
          }}
        />
        <kbd>/</kbd>
      </label>
      <div className="csp-topbar-right">
        {onToggleTheme && (
          <button
            type="button"
            className="csp-iconbtn"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>
        )}
        <button type="button" className="csp-usermenu" aria-haspopup="menu">
          <Avatar name={user.name} size={32} />
          <span className="csp-usermenu-text">
            <strong>{user.name}</strong>
            <span>{role === 'manager' ? 'Manager' : 'Admin'}</span>
          </span>
          <Icon name="chevron-down" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ───────────── Marketing ───────────── */

export interface CategoryCardProps {
  title: string;
  description: string;
  number?: string;
  image?: string;
  href?: string;
}
export function CategoryCard({ title, description, number, image, href = '/products' }: CategoryCardProps) {
  return (
    <UiLink to={href} className="csp-cat">
      <div className="csp-cat-media">
        {image ? <img src={image} alt="" /> : <MediaPlaceholder label={title} number={number} ratio="4 / 5" />}
      </div>
      <div className="csp-cat-body">
        <h3 className="csp-cat-title">{title}</h3>
        <p className="csp-cat-desc">{description}</p>
        <span className="csp-cat-link">
          Customize
          <Icon name="arrow-up-right" size={18} />
        </span>
      </div>
    </UiLink>
  );
}

export function ProcessSteps({ steps }: { steps: { title: string; description: string; icon?: IconName }[] }) {
  return (
    <ol className="csp-steps">
      {steps.map((s, i) => (
        <li key={i} className="csp-step">
          <span className="csp-step-no" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          {s.icon && (
            <span className="csp-step-icon">
              <Icon name={s.icon} size={22} />
            </span>
          )}
          <h3 className="csp-step-title">{s.title}</h3>
          <p className="csp-step-desc">{s.description}</p>
        </li>
      ))}
    </ol>
  );
}

export function TestimonialCard({
  quote,
  name,
  team,
  rating = 5,
}: {
  quote: string;
  name: string;
  team: string;
  rating?: number;
}) {
  return (
    <figure className="csp-testi">
      <div className="csp-testi-stars" aria-label={`${String(rating)} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon key={i} name="star" size={16} className={i <= rating ? 'on' : ''} />
        ))}
      </div>
      <blockquote className="csp-testi-quote">{quote}</blockquote>
      <figcaption className="csp-testi-by">
        <Avatar name={name} size={40} />
        <span>
          <strong>{name}</strong>
          <span>{team}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/* ───────────── Feedback ───────────── */

export function EmptyState({
  icon = 'clipboard-list',
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="csp-empty">
      <span className="csp-empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="csp-empty-title">{title}</h3>
      {message && <p className="csp-empty-msg">{message}</p>}
      {action}
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return (
    <span className={clsx('csp-skel', className)} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
  );
}

/* ───────────── Toast queue (auto-dismiss 4.5 s, newest on top, max 3) ───────────── */

export interface ToastItem extends Omit<ToastProps, 'onClose'> {
  id: number;
}
// SPEC-DEVIATION: lint no-empty-function (the default context value returns undefined explicitly; same no-op).
const ToastCtx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = (t: Omit<ToastItem, 'id'>) => {
    const id = ++seq.current;
    setList((l) => [{ ...t, id }, ...l].slice(0, 3));
    window.setTimeout(() => {
      setList((l) => l.filter((x) => x.id !== id));
    }, 4500);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {list.length > 0 && (
        <div className="s-toast-layer">
          {list.map(({ id, ...t }) => (
            <Toast
              key={id}
              {...t}
              onClose={() => {
                setList((l) => l.filter((x) => x.id !== id));
              }}
            />
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
