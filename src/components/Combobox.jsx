import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A real combobox, hand-rolled: the app ships no UI library, and the native
// `<input list>` + `<datalist>` pairing it replaced was genuinely broken here.
// Chromium draws a datalist popup in the browser process, so it ignores the
// panel completely — no dark styling, no width match, no highlighting of the
// current value — and inside Electron it frequently fails to open at all from
// a click on the field. Replacing it means we own the popup: filtered as you
// type, keyboard-driven, and styled like the rest of the Inspector.
//
// The list is rendered through a portal at the document root and positioned
// with fixed coordinates, because the Style tab's `.inspector-body` scrolls —
// anything absolutely positioned inside it gets clipped at the panel edge.
//
// The field stays editable on purpose. Kits can hold a family the catalog
// doesn't list (any project saved before the catalog existed), so the control
// has to be able to *show* a value it can't offer, and typing a name that
// exactly matches an option commits it on Enter or on blur.
export default function Combobox({
  id,
  value = '',
  options = [],
  onSelect,
  placeholder = '',
  disabled = false,
  className = '',
  emptyText = 'No matches',
  // Names the control for assistive tech — several of these stack in the same
  // panel, so "Search fonts…" alone would not say which role it sets.
  label,
}) {
  // Options may be plain strings or { value, label, meta } objects. The Style
  // tab passes one module-level array, so identity is stable and this only
  // recomputes when the caller actually swaps the list out.
  const entries = useMemo(
    () => options.map(option => (typeof option === 'string' ? { value: option, label: option } : option)),
    [options],
  );

  const [text, setText] = useState(value ?? '');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState(null);

  const fieldRef = useRef(null);
  const listRef = useRef(null);
  const listId = `${useId()}-list`;


  // Typing filters; an untouched field must show everything, which is why the
  // filter query is separate from the committed value. Without that split,
  // opening on "Georgia" would offer exactly one option.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(option => option.label.toLowerCase().includes(needle));
  }, [entries, query]);

  // The field shows what the parent stored unless the user is mid-edit, so a
  // commit from anywhere else (the Remix button, an applied template) lands in
  // the input without fighting a half-typed name.
  useEffect(() => {
    if (document.activeElement !== fieldRef.current) setText(value ?? '');
  }, [value]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
    setQuery('');
  }, []);

  const commit = useCallback(option => {
    setText(option?.value ?? '');
    if (option) onSelect?.(option.value);
    close();
  }, [close, onSelect]);

  // Fixed coordinates from the field's own rect, so the popup escapes the
  // scrolling panel it lives in. Flips above the field when there is no room
  // below — the last font row sits near the bottom of a short window.
  const position = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const flip = below < 190 && rect.top > below;
    // Match the field, but never so narrow that family names are unreadable
    // (the Template Manager's field is tight), and never off the right edge.
    const width = Math.max(Math.round(rect.width), 190);
    setPlacement({
      left: Math.max(8, Math.min(Math.round(rect.left), window.innerWidth - width - 8)),
      width,
      top: flip ? undefined : Math.round(rect.bottom + 4),
      bottom: flip ? Math.round(window.innerHeight - rect.top + 4) : undefined,
      maxHeight: Math.max(130, Math.min(300, (flip ? rect.top : below) - 12)),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    position();
    // Capture-phase scroll catches the Inspector's own scrolling body, not
    // just the window; without it the popup detaches from the field as soon
    // as the panel scrolls.
    const onMove = () => position();
    const onOutside = event => {
      if (fieldRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return;
      close();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('pointerdown', onOutside, true);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('pointerdown', onOutside, true);
    };
  }, [open, position, close]);

  // Keep the highlighted row in view as the arrows walk the list, and pull the
  // opening highlight (the value already in the field) into view: that one is
  // set before the popup exists, so this has to re-run once it is placed.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId, placement]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, entries.findIndex(option => option.value === value)));
    setOpen(true);
  };

  const move = step => {
    setActive(current => {
      const count = matches.length;
      if (!count) return -1;
      if (current < 0) return step > 0 ? 0 : count - 1;
      return (current + step + count) % count;
    });
  };

  const handleKeyDown = event => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { openList(); return; }
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      if (open && active >= 0 && matches[active]) { event.preventDefault(); commit(matches[active]); return; }
      if (open && matches.length === 1) { event.preventDefault(); commit(matches[0]); return; }
      // Enter on a hand-typed name still commits when it names a real option,
      // and an emptied field clears the role back to the body font.
      const typed = matches.find(option => option.value.toLowerCase() === text.trim().toLowerCase());
      if (typed || !text.trim()) { event.preventDefault(); commit(typed || { value: '' }); return; }
      close();
      return;
    }
    if (event.key === 'Escape') { if (open) { event.preventDefault(); setText(value ?? ''); close(); } return; }
    if (event.key === 'Home' && open) { event.preventDefault(); setActive(0); return; }
    if (event.key === 'End' && open) { event.preventDefault(); setActive(matches.length - 1); return; }
    if (event.key === 'Tab') close();
  };

  // Blur is the other way a typed name gets committed: leaving the field after
  // typing "Georgia" should stick, and leaving it after typing "Geor" should
  // drop back to whatever was stored rather than keep a name that matches
  // nothing. An empty field clears the role, same as the datalist did.
  const handleBlur = () => {
    const typed = text.trim();
    if (!typed) { commit({ value: '' }); return; }
    const exact = entries.find(option => option.value.toLowerCase() === typed.toLowerCase());
    if (exact) { if (exact.value !== value) commit(exact); else close(); return; }
    setText(value ?? '');
    close();
  };

  const activeId = open && active >= 0 && matches[active] ? `${listId}-${active}` : undefined;

  const popup = open && placement ? createPortal(
    <ul
      className="combobox-list"
      id={listId}
      role="listbox"
      ref={listRef}
      aria-label={label}
      style={{
        left: `${placement.left}px`,
        width: `${placement.width}px`,
        top: placement.top === undefined ? undefined : `${placement.top}px`,
        bottom: placement.bottom === undefined ? undefined : `${placement.bottom}px`,
        maxHeight: `${placement.maxHeight}px`,
      }}
    >
      {matches.length === 0 && <li className="combobox-empty">{emptyText}</li>}
      {matches.map((option, index) => <li
        key={option.value}
        id={`${listId}-${index}`}
        role="option"
        aria-selected={option.value === value}
        className={`combobox-option${index === active ? ' active' : ''}${option.value === value ? ' selected' : ''}`}
        // Keeps focus in the field: without this the input blurs first and the
        // list is gone before the click lands.
        onMouseDown={event => event.preventDefault()}
        onMouseMove={() => setActive(index)}
        onClick={() => commit(option)}
      >
        <span className="combobox-option-check" aria-hidden="true">{option.value === value ? '✓' : ''}</span>
        <span className="combobox-option-label">{option.label}</span>
        {option.meta && <span className="combobox-option-meta">{option.meta}</span>}
      </li>)}
    </ul>,
    document.body,
  ) : null;

  return <div className={`combobox ${className}`}>
    <input
      id={id}
      ref={fieldRef}
      type="text"
      className="field combobox-input"
      role="combobox"
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={activeId}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      disabled={disabled}
      spellCheck={false}
      autoComplete="off"
      // Typing always filters, so the query is the typed text here rather than
      // the empty string openList resets it to for a keyboard/click open.
      onChange={event => { setText(event.target.value); setQuery(event.target.value); setActive(-1); setOpen(true); }}
      // Clicking or tabbing into the field opens the full list, which is what
      // makes the control discoverable without typing first.
      onFocus={openList}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
    <button
      type="button"
      className="combobox-toggle"
      tabIndex={-1}
      aria-hidden="true"
      disabled={disabled}
      onMouseDown={event => event.preventDefault()}
      onClick={() => { if (open) { close(); return; } fieldRef.current?.focus(); openList(); }}
    >⌄</button>
    {popup}
  </div>;
}
