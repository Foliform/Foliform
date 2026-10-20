import { Icon } from './Icon';
import { BrandMark } from './BrandMark';
import { templatesEnabled } from '../featureFlags';

export function Topbar({ title, notice, words, pageCount, activeView, theme, onThemeChange, onViewChange, onRename, onNew, onOpen, onSave, onExport, onOpenTemplates, onRecover }) {
  return <header className="topbar"><div className="brand"><BrandMark /><span>Foliform</span><i></i><button className="title-button" onClick={onRename}>{title}</button><span className="saved"><b></b>{notice}</span></div><nav><button className={activeView === 'Editor' ? 'nav-active' : ''} onClick={() => onViewChange('Editor')}>Editor</button><button className={activeView === 'Preview' ? 'nav-active' : ''} onClick={() => onViewChange('Preview')}>Preview</button></nav><div className="top-actions"><span className="metrics">{words} words · {pageCount} pages</span><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={onThemeChange}>{theme === 'dark' ? '☼' : '☾'}</button>{templatesEnabled && <button onClick={onOpenTemplates}>Templates</button>}<button onClick={onRecover}>History</button><button onClick={onNew}>New</button><button onClick={onOpen}>Open</button><button onClick={onSave}><Icon>↥</Icon> Save</button><button className="primary" onClick={onExport}><Icon>↓</Icon> Export</button></div></header>;
}
