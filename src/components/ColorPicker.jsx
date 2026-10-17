import { useEffect, useState } from 'react';

const DEFAULT_PRESETS = [
  '#fbf9f4',
  '#f4efe6',
  '#fffef9',
  '#25242a',
];

// The DOM only accepts exactly #rrggbb on input[type=color] — a 3-digit hex,
// a missing #, or a half-typed value makes it throw the moment React writes
// the property, which took down the whole Template Manager window. Values are
// normalized through here before ever reaching that input.
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const expandHex = hex => {
  const withHash = hex.startsWith('#') ? hex : `#${hex}`;
  return withHash.length === 4
    ? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`
    : withHash;
};

export default function ColorPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  // `label` names the colour in the accessibility tree (the Inspector stacks
  // four of these, so "Choose colour" alone would not say which one), and
  // `compact` drops the preset row for those stacked uses — the swatch, the hex
  // field and the reset are what the Style tab's Colors section shows.
  label = 'Choose page background color',
  compact = false,
  onReset,
}) {
  // `value` can be undefined (e.g. a saved template predating this field);
  // both the native input and the preset comparison need a safe fallback.
  const displayValue = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const safeValue = HEX.test(displayValue) ? expandHex(displayValue) : '#ffffff';

  // The text field keeps its own draft while focused so partial input
  // ("#fbf", "fbf9") doesn't fight the controlled value or crash the color
  // input — complete hexes are forwarded to the parent immediately,
  // incomplete ones stay in the draft until they are or the field blurs.
  const [draft, setDraft] = useState(displayValue);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(displayValue);
  }, [displayValue, focused]);

  const commit = raw => {
    setDraft(raw);
    const trimmed = raw.trim();
    if (HEX.test(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)) {
      onChange(expandHex(trimmed));
    }
  };

  return (
    <div className="color-picker">
      <div className="color-picker-main">
        <label className="color-picker-swatch">
          <input
            type="color"
            value={safeValue}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
          />
          <span
            className="color-picker-preview"
            style={{ backgroundColor: safeValue }}
          />
        </label>

        <input
          type="text"
          value={focused ? draft : displayValue}
          onChange={(e) => commit(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={`${label} hex value`}
          className="color-picker-hex"
          placeholder="#ffffff"
          spellCheck={false}
        />

        {/* Drops a Title/Subtitle/Body colour override so the role goes back
            to inheriting (the body colour) instead of merely matching it. */}
        {onReset && (
          <button
            type="button"
            className="color-picker-reset"
            title={`Reset ${label}`}
            aria-label={`Reset ${label}`}
            onClick={onReset}
          >
            ↺
          </button>
        )}
      </div>

      {!compact && <div className="swatches">
        {presets.map((color) => (
          <button
            type="button"
            aria-label={`Use ${color}`}
            key={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={displayValue === color.toLowerCase()
              ? 'swatch-active'
              : ''}
          />
        ))}
      </div>}
    </div>
  );
}