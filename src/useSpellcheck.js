import { useEffect, useRef } from 'react';
import nspell from 'nspell';
// dictionary-en's own package.json restricts which files can be imported
// through its package name (a modern "exports" map) — .aff/.dic aren't in
// that allowed list, even though they physically exist in the package, so
// `import ... from 'dictionary-en/index.aff?url'` gets refused by the
// resolver before Vite ever gets to bundle it. Referencing the same file by
// a plain relative path into node_modules sidesteps that: exports-map
// restrictions only apply to resolving a package name as a specifier, not
// to an ordinary relative filesystem import. Path assumes the standard
// Electron Forge layout (src/ and node_modules/ both directly under the
// project root) — adjust the "../" depth if useSpellcheck.js ever moves.
import affUrl from '../node_modules/dictionary-en/index.aff?url';
import dicUrl from '../node_modules/dictionary-en/index.dic?url';
import { retext } from 'retext';
import retextEnglish from 'retext-english';
import retextEquality from 'retext-equality';
import retextRepeatedWords from 'retext-repeated-words';
import retextReadability from 'retext-readability';
import retextPassive from 'retext-passive';

// Spelling (nspell) and grammar (retext) both run fully offline, no server
// process — see manuscript-agent-spec.md's "Spell & grammar check" section
// for why that matters here (LanguageTool would need a Java process or a
// network call, which contradicts the app's no-backend architecture).
export function useSpellcheck() {
  const spellRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch(affUrl).then(r => r.text()), fetch(dicUrl).then(r => r.text())])
      .then(([aff, dic]) => { if (!cancelled) spellRef.current = nspell({ aff, dic }); })
      .catch(() => {});
    processorRef.current = retext()
      .use(retextEnglish)
      .use(retextEquality)
      .use(retextRepeatedWords)
      .use(retextReadability, { threshold: 6 })
      .use(retextPassive);
    return () => { cancelled = true; };
  }, []);

  // Matches the `(view) => Diagnostic[] | Promise<Diagnostic[]>` shape
  // @codemirror/lint's linter() expects. EditorPanel.jsx wires this in with
  // { delay: 800 }, so CodeMirror itself handles debouncing — this function
  // doesn't need its own debounce logic.
  return async function checkText(view) {
    const diagnostics = [];
    const text = view.state.doc.toString();

    const spell = spellRef.current;
    if (spell) {
      const wordPattern = /[A-Za-z']+/g;
      let match;
      while ((match = wordPattern.exec(text))) {
        const word = match[0];
        if (word.length < 2 || spell.correct(word)) continue;
        const suggestions = spell.suggest(word).slice(0, 3);
        diagnostics.push({
          from: match.index,
          to: match.index + word.length,
          severity: 'warning',
          message: suggestions.length ? `Possible spelling mistake. Suggestions: ${suggestions.join(', ')}` : 'Possible spelling mistake.',
        });
      }
    }

    const processor = processorRef.current;
    if (processor) {
      const file = await processor.process(text);
      for (const message of file.messages) {
        const position = message.place || message.position;
        if (!position?.start) continue;
        const from = position.start.offset ?? 0;
        const to = position.end?.offset ?? from;
        if (to <= from) continue;
        diagnostics.push({ from, to, severity: 'info', message: message.reason || String(message) });
      }
    }

    return diagnostics.sort((a, b) => a.from - b.from);
  };
}