import { useEffect, useRef } from 'react';
import FontPicker from 'fontpicker/dist/fontpicker.js';
import 'fontpicker/dist/fontpicker.min.css';
import { findFont } from '../fontCatalog';

export function FontPickerControl({ value = '', label, placeholder = 'Choose a font', onSelect, compact = false }) {
  const buttonRef = useRef(null);
  const pickerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const button = buttonRef.current;
    const picker = new FontPicker(button, {
      variants: false,
      defaultSubset: 'latin',
      showClearButton: true,
      showCancelButton: true,
      saveFavourites: false,
      storageKey: 'foliform-font-picker-favourites',
      stateKey: 'foliform-font-picker',
      container: document.body,
    });
    picker.on('pick', font => {
      const result = onSelectRef.current?.(
        font?.family.name || '',
        Boolean(font && (font.family.popularity !== undefined || findFont(font.family.name)?.google)),
      );
      if (result && typeof result.catch === 'function') {
        result.catch(error => console.error('Font selection failed', error));
      }
    });
    pickerRef.current = picker;
    return () => {
      picker.destroy();
      pickerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const picker = pickerRef.current;
    const button = buttonRef.current;
    if (!picker || !button) return;
    const catalogFont = findFont(value);
    const pickerName = catalogFont?.google || value;
    if (pickerName && picker.families.has(pickerName)) {
      picker.setFont(pickerName);
      return;
    }
    picker.setFont(null);
    button.textContent = value || placeholder;
  }, [value, placeholder]);

  return <button
    type="button"
    ref={buttonRef}
    className={`font-picker-control${compact ? ' font-picker-control--compact' : ''}`}
    aria-label={label}
    title={label}
  />;
}
