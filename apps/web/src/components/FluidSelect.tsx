import { useEffect, useId, useRef, useState } from "react";

export interface FluidOption { value: string; label: string }

/** An accessible, animated alternative to the unstyleable native select popup. */
export function FluidSelect({ label, value, options, onChange, disabled = false, className = "" }: {
  label: string; value: string | number; options: FluidOption[]; onChange: (value: string) => void; disabled?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const current = options.find((option) => option.value === String(value)) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <div className={`field fluid-select ${className}`} ref={root}>
    <span className="fluid-select-label">{label}</span>
    <button ref={button} type="button" className="fluid-select-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} disabled={disabled}
      onClick={() => setOpen((value) => !value)}>
      <span>{current?.label}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    <div id={menuId} className="fluid-select-menu" role="menu" aria-label={`${label} options`} data-open={open || undefined}>
      {options.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === String(value)}
        onClick={() => { onChange(option.value); setOpen(false); button.current?.focus(); }}>
        <span>{option.label}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 2.8 2.8 6.2-6.2" /></svg>
      </button>)}
    </div>
  </div>;
}
