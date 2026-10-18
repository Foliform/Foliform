import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('manuscript', {
  createProject: (data) => ipcRenderer.invoke('project:create', data),
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectPath: (path) => ipcRenderer.invoke('project:openPath', path),
  listProjects: () => ipcRenderer.invoke('project:list'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  listRecovery: (path) => ipcRenderer.invoke('project:recovery:list', path),
  getRecovery: (path, id) => ipcRenderer.invoke('project:recovery:get', path, id),
  checkProjectAssets: (project) => ipcRenderer.invoke('project:preflight-assets', project),
  importAsset: (projectPath) => ipcRenderer.invoke('asset:import', projectPath),
  renderPdf: (project) => ipcRenderer.invoke('preview:pdf', project),
  exportBook: (format, project, settings) => ipcRenderer.invoke('export:book', { format, project, settings }),
  importGoogleFont: (root, family) => ipcRenderer.invoke('font:import', { root, family }),
  openTemplateManager: (theme) => ipcRenderer.invoke('window:openTemplateManager', theme),
  setTheme: (theme) => ipcRenderer.send('theme:changed', theme),
  onThemeChange: (callback) => {
    const listener = (_, theme) => callback(theme);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },
  listTemplates: () => ipcRenderer.invoke('template:list'),
  saveTemplate: (template) => ipcRenderer.invoke('template:save', template),
  deleteTemplate: (id) => ipcRenderer.invoke('template:delete', id),
});
