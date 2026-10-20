import { basicSetup } from 'codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorState } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import { linter, lintGutter } from '@codemirror/lint';
import { useEffect, useRef, useState } from 'react';
import { isIsolatedDashLine, setColumnCountDirective } from '../canonical';
import { FontPickerControl } from './FontPickerControl';

const markerPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = findMarkers(view); }
  update(update) { if (update.docChanged || update.viewportChanged) this.decorations = findMarkers(update.view); }
}, { decorations: value => value.decorations });

function findMarkers(view) {
  const ranges = [];
  const doc = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    for (let position = from; position <= to;) {
      const line = doc.lineAt(position);
      const trimmed = line.text.trim();
      const isolated = (trimmed === '---' || trimmed === '----') && isIsolatedDashLine({
        lineCount: doc.lines,
        lineNumber: line.number,
        getLineText: n => doc.line(n).text,
      });
      if (isolated) {
        ranges.push(Decoration.line({ class: trimmed === '---' ? 'cm-page-break-line' : 'cm-divider-line' }).range(line.from));
      }
      position = line.to + 1;
    }
  }
  return Decoration.set(ranges);
}

// Word wrap is toggled at runtime through a compartment so the editor is
// never torn down (which would lose undo history and scroll position).
const wrapCompartment = new Compartment();

// checkText: (view) => Diagnostic[] | Promise<Diagnostic[]>
// Wired by the parent from the nspell (spelling) + retext (grammar) pipeline
// described in manuscript-agent-spec.md, on the same ~800ms debounce as
// autosave — CodeMirror's linter() handles the debounce itself via `delay`.
export function EditorPanel({ source, setSource, pageWarning, checkText, onFontApply, columnCount, hasColumnDirective, onSetColumnCount }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  // A writing app defaults to wrapped prose; the head button flips it.
  const [wrap, setWrap] = useState(true);
  const [paragraphFont, setParagraphFont] = useState('');
  const [applyingFont, setApplyingFont] = useState(false);

  useEffect(() => {
    const extensions = [
      basicSetup,
      // @codemirror/lang-markdown highlights embedded raw HTML tags natively
      // once @codemirror/lang-html is present as a dependency — no separate
      // HTML editor mode or manual mode-switching needed.
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      markerPlugin,
      lintGutter(),
      wrapCompartment.of(EditorView.lineWrapping),
      EditorView.updateListener.of(update => {
        if (update.docChanged) setSource(update.state.doc.toString());
      }),
    ];
    if (checkText) extensions.push(linter(checkText, { delay: 800 }));

    const state = EditorState.create({ doc: source, extensions });
    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== source) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
  }, [source]);

  const toggleWrap = () => {
    setWrap(current => {
      const next = !current;
      viewRef.current?.dispatch({ effects: wrapCompartment.reconfigure(next ? EditorView.lineWrapping : []) });
      return next;
    });
  };

  const insertMarker = marker => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const insertion = `\n\n${marker}\n\n`;
    view.dispatch({
      changes: { from, to, insert: insertion },
      selection: { anchor: from + insertion.length },
      scrollIntoView: true,
    });
    view.focus();
  };

  const setDocumentColumns = count => {
    const view = viewRef.current;
    if (!view) return;
    const currentSource = view.state.doc.toString();
    const nextSource = setColumnCountDirective(currentSource, count);
    let prefixLength = 0;
    while (prefixLength < currentSource.length && currentSource[prefixLength] === nextSource[prefixLength]) prefixLength += 1;
    let suffixLength = 0;
    while (suffixLength < currentSource.length - prefixLength
      && suffixLength < nextSource.length - prefixLength
      && currentSource[currentSource.length - 1 - suffixLength] === nextSource[nextSource.length - 1 - suffixLength]) suffixLength += 1;
    view.dispatch({
      changes: {
        from: prefixLength,
        to: currentSource.length - suffixLength,
        insert: nextSource.slice(prefixLength, nextSource.length - suffixLength),
      },
    });
    view.focus();
    onSetColumnCount?.(count);
  };

  const applyParagraphFont = async (family, isGoogleFont) => {
    const view = viewRef.current;
    if (!view || !family || applyingFont) return;
    setApplyingFont(true);
    try {
      if (onFontApply && !(await onFontApply(family, isGoogleFont))) return;
      setParagraphFont(family);

      const { from, to } = view.state.selection.main;
      const doc = view.state.doc;
      const startLine = doc.lineAt(from);
      if (from === to && !startLine.text.trim()) {
        const opening = `::: font "${family}"`;
        const insertion = `${opening}\n\n:::`;
        view.dispatch({
          changes: { from: startLine.from, to: startLine.to, insert: insertion },
          selection: { anchor: startLine.from + opening.length + 1 },
          scrollIntoView: true,
        });
        view.focus();
        return;
      }

      const lastPosition = to > from && doc.lineAt(to).from === to ? to - 1 : to;
      let firstLine = startLine.number;
      let lastLine = doc.lineAt(Math.max(from, lastPosition)).number;
      while (firstLine > 1 && doc.line(firstLine - 1).text.trim()) firstLine -= 1;
      while (lastLine < doc.lines && doc.line(lastLine + 1).text.trim()) lastLine += 1;

      const blockFrom = doc.line(firstLine).from;
      const blockTo = doc.line(lastLine).to;
      const text = doc.sliceString(blockFrom, blockTo);
      const replacement = `::: font "${family}"\n${text}\n:::`;
      view.dispatch({
        changes: { from: blockFrom, to: blockTo, insert: replacement },
        selection: { anchor: blockFrom + replacement.length },
        scrollIntoView: true,
      });
      view.focus();
    } finally {
      setApplyingFont(false);
    }
  };

  const closeOptions = event => {
    event.currentTarget.closest('details').open = false;
  };

  return <section className="editor-panel"><div className="editor-head"><span>Markdown + HTML · Act I · Chapter One</span><div className="editor-head-tools"><FontPickerControl label="Font for paragraph" placeholder="Paragraph font" value={paragraphFont} onSelect={applyParagraphFont} compact /><details className="editor-options"><summary aria-label="Show more editor options">More</summary><div className="editor-options-menu"><span className="editor-options-label">Whole-book columns</span>{[1, 2, 3].map(count => <button type="button" key={count} onClick={event => { setDocumentColumns(count); closeOptions(event); }} aria-pressed={columnCount === count}>{count === 1 ? 'One column' : `${count} columns`}</button>)}{hasColumnDirective && <button type="button" onClick={event => { setDocumentColumns(null); closeOptions(event); }}>Use Style setting</button>}<hr /><button type="button" onClick={event => { insertMarker('---'); closeOptions(event); }} title="Insert a hard page break">Page break</button><button type="button" onClick={event => { insertMarker('----'); closeOptions(event); }} title="Insert a decorative divider">Divider</button><button type="button" onClick={event => { toggleWrap(); closeOptions(event); }} aria-pressed={wrap} title="Toggle word wrap">Word wrap: {wrap ? 'On' : 'Off'}</button></div></details></div></div><div className="source-wrap"><div ref={editorRef} className="editor-canvas" aria-label="Document source" /></div>{pageWarning && <div className="source-hint">Use a blank line before and after <strong>---</strong> for a hard page break.</div>}<footer><span>Markdown + HTML · UTF-8</span><span>Autosaves while you write</span></footer></section>;
}
