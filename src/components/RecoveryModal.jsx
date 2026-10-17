import { useEffect, useState } from 'react';

export function RecoveryModal({ projectPath, onClose, onRestore }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    window.manuscript?.listRecovery(projectPath).then(items => {
      if (active) setSnapshots(items || []);
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectPath]);

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="recovery-modal" onMouseDown={event => event.stopPropagation()}><button className="close" onClick={onClose}>×</button><span className="eyebrow">Draft history</span><h2>Recover a draft</h2><p>Snapshots are created automatically as your manuscript changes.</p>{loading ? <p>Loading history…</p> : snapshots.length === 0 ? <p>No recovery snapshots yet. New snapshots appear as you edit and save.</p> : <div className="recovery-list">{snapshots.map(item => <button key={item.id} onClick={() => onRestore(item.id)}><strong>{item.title}</strong><span>{new Date(item.createdAt).toLocaleString()}</span><small>{item.words.toLocaleString()} words</small></button>)}</div>}</section></div>;
}
