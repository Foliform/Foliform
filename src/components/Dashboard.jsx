import { BrandMark } from './BrandMark';

export function Dashboard({ showNew, setShowNew, newTitle, setNewTitle, onOpen, onCreate, recentProjects = [], onOpenRecent, theme, onThemeChange }) {
  return <main className={`app-shell dashboard theme-${theme}`}>
    <header className="topbar">
      <div className="brand"><BrandMark /><span>Foliform</span></div>
      <div className="top-actions"><button className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={onThemeChange}>{theme === 'dark' ? '☼' : '☾'}</button><button onClick={onOpen}>Open manuscript</button><button className="primary" onClick={() => setShowNew(true)}>New manuscript</button></div>
    </header>
    <section className="welcome">
      <span className="eyebrow">Write. Design. Publish.</span>
      <h1>Your next book starts here.</h1>
      <p>Create a portable manuscript project, then write and typeset it in one focused workspace.</p>
      <div className="welcome-actions"><button className="primary" onClick={() => setShowNew(true)}>Create a manuscript <span>→</span></button><button onClick={onOpen}>Open an existing project</button></div>
      {recentProjects.length > 0 && <div className="template-row"><h2>Recent manuscripts</h2><div className="recent-grid">{recentProjects.map(project => <div className="template-card recent-card" key={project.path} onClick={() => onOpenRecent(project.path)}><div className="blank-paper"><span>{project.title || 'Untitled manuscript'}</span><i></i><i></i><i></i></div><div><b>{project.title || 'Untitled manuscript'}</b><small>{new Date(project.lastOpened).toLocaleDateString()}</small></div></div>)}</div></div>}
      <div className="template-row"><h2>Start with a blank page</h2><div className="template-card" onClick={() => setShowNew(true)}><div className="blank-paper"><span>Untitled manuscript</span><i></i><i></i><i></i></div><div><b>Blank manuscript</b><small>Markdown + HTML · Your Brand Kit</small></div></div></div>
    </section>
    {showNew && <div className="modal-backdrop"><section className="new-modal"><button className="close" onClick={() => setShowNew(false)}>×</button><span className="eyebrow">New project</span><h2>Create a manuscript</h2><label>Working title</label><input autoFocus className="field" value={newTitle} onChange={event => setNewTitle(event.target.value)} onKeyDown={event => event.key === 'Enter' && onCreate()} /><p className="muted">Write Markdown and HTML together in the same document.</p><button className="primary create-button" onClick={onCreate}>Create project</button></section></div>}
  </main>;
}
