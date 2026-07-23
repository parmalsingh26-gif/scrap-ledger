import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Folder {
  _id: string;
  name: string;
  path: string;
  parent: string;
  createdAt: string;
}

interface Document {
  _id: string;
  name: string;
  folder: string;
  url: string;
  thumbnailUrl?: string;
  type: 'pdf' | 'image' | 'excel' | 'word' | 'text' | 'other';
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

interface StorageUsage {
  usedGB: string;
  limitGB: number;
  percentUsed: string;
}

const API = '';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function fileIcon(type: string): { icon: string; color: string; bg: string } {
  switch (type) {
    case 'pdf':   return { icon: 'picture_as_pdf', color: 'text-red-500',    bg: 'bg-red-500/10' };
    case 'image': return { icon: 'image',           color: 'text-violet-500', bg: 'bg-violet-500/10' };
    case 'excel': return { icon: 'table_chart',     color: 'text-green-500',  bg: 'bg-green-500/10' };
    case 'word':  return { icon: 'description',     color: 'text-blue-500',   bg: 'bg-blue-500/10' };
    case 'text':  return { icon: 'article',         color: 'text-gray-500',   bg: 'bg-gray-500/10' };
    default:      return { icon: 'insert_drive_file',color: 'text-orange-500',bg: 'bg-orange-500/10' };
  }
}

// ─── Folder Tree Node ─────────────────────────────────────────────────────────
function FolderNode({
  folder, allFolders, selected, onSelect, depth = 0
}: {
  folder: Folder; allFolders: Folder[]; selected: string;
  onSelect: (path: string) => void; depth?: number; key?: string | number;
}) {
  const children = allFolders.filter(f => f.parent === folder.path);
  const [open, setOpen] = useState(true);
  const isSelected = selected === folder.path;

  return (
    <div>
      <button
        onClick={() => { setOpen(!open); onSelect(folder.path); }}
        className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-left transition-all duration-200 text-sm group ${
          isSelected
            ? 'bg-primary/15 text-primary font-semibold'
            : 'hover:bg-white/10 text-on-surface-variant hover:text-on-surface'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {children.length > 0 ? (
          <span className="material-symbols-outlined text-[16px] opacity-60">
            {open ? 'arrow_drop_down' : 'arrow_right'}
          </span>
        ) : (
          <span className="w-4" />
        )}
        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {isSelected ? 'folder_open' : 'folder'}
        </span>
        <span className="truncate flex-1">{folder.name}</span>
      </button>
      {open && children.map(child => (
        <FolderNode
          key={child._id}
          folder={child}
          allFolders={allFolders}
          selected={selected}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function DocumentManager() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('root');
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewSignedUrl, setPreviewSignedUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadMode, setUploadMode] = useState<'files' | 'folder'>('files');
  // Cache signed URLs for 50 min (they expire in 1 hour)
  const signedUrlCache = useRef<Map<string, { url: string; fetchedAt: number }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Get signed URL (cached for 50 min) ──────────────────────────────
  const getSignedUrl = async (docId: string): Promise<string | null> => {
    const cached = signedUrlCache.current.get(docId);
    const CACHE_MS = 50 * 60 * 1000; // 50 minutes
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
      return cached.url;
    }
    const res = await fetch(`${API}/api/documents/${docId}/signed-url`);
    if (!res.ok) return null;
    const { url } = await res.json();
    signedUrlCache.current.set(docId, { url, fetchedAt: Date.now() });
    return url;
  };

  // ── Open preview with signed URL ──────────────────────────────────
  const openPreview = async (doc: Document) => {
    setPreviewDoc(doc);
    setPreviewSignedUrl(null);
    setPreviewLoading(true);
    const url = await getSignedUrl(doc._id);
    setPreviewSignedUrl(url);
    setPreviewLoading(false);
  };

  // ── Download with signed URL ──────────────────────────────────────
  const downloadDoc = async (doc: Document) => {
    const url = await getSignedUrl(doc._id);
    if (!url) { showToast('Download failed — try again', 'error'); return; }
    const a = window.document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };


  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load folders ──────────────────────────────────────────────────────────
  const loadFolders = async () => {
    const res = await fetch(`${API}/api/folders`);
    if (res.ok) setFolders(await res.json());
  };

  // ── Load documents ────────────────────────────────────────────────────────
  const loadDocuments = useCallback(async (folder: string) => {
    setLoading(true);
    const res = await fetch(`${API}/api/documents?folder=${encodeURIComponent(folder)}`);
    if (res.ok) setDocuments(await res.json());
    setLoading(false);
  }, []);

  // ── Load storage usage ────────────────────────────────────────────────────
  const loadUsage = async () => {
    const res = await fetch(`${API}/api/cloudinary/usage`);
    if (res.ok) setUsage(await res.json());
  };

  useEffect(() => {
    loadFolders();
    loadUsage();
  }, []);

  useEffect(() => {
    loadDocuments(selectedFolder);
  }, [selectedFolder, loadDocuments]);

  // ── Upload individual files ───────────────────────────────────────────────
  const handleUpload = async (files: FileList | null, baseFolderOverride?: string) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    let uploaded = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      setUploadingFileName(file.name);
      const targetFolder = baseFolderOverride || selectedFolder;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', targetFolder);
      fd.append('uploadedBy', 'User');

      const res = await fetch(`${API}/api/documents/upload`, { method: 'POST', body: fd });
      if (res.ok) {
        uploaded++;
        setUploadProgress(Math.round((uploaded / files.length) * 100));
      } else {
        failed++;
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`Upload failed for ${file.name}:`, err);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadingFileName('');
    if (uploaded > 0) {
      const msg = failed > 0
        ? `${uploaded} files upload hue, ${failed} fail hue`
        : `${uploaded} file(s) successfully upload ho gaye!`;
      showToast(msg, failed > 0 ? 'error' : 'success');
      loadDocuments(selectedFolder);
      loadFolders();
      loadUsage();
    } else {
      showToast('Upload fail ho gaya', 'error');
    }
  };

  // ── Upload entire folder with subfolder structure ─────────────────────────
  const handleFolderUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    const fileArray = Array.from(files);
    // Collect all unique subfolder paths from webkitRelativePath
    const folderPaths = new Set<string>();
    fileArray.forEach(file => {
      const parts = (file as any).webkitRelativePath.split('/');
      // Build all intermediate folder paths
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        if (folderPath) folderPaths.add(folderPath);
      }
    });

    // Sort so parent folders are created before children
    const sortedPaths = Array.from(folderPaths).sort((a, b) => a.split('/').length - b.split('/').length);

    // Create all folders in DB (relative to selectedFolder)
    const createdFolderPaths = new Set<string>();
    for (const relPath of sortedPaths) {
      const parts = relPath.split('/');
      const name = parts[parts.length - 1];
      const parentRelPath = parts.slice(0, -1).join('/');
      const parentFullPath = parentRelPath
        ? (selectedFolder === 'root' ? parentRelPath : `${selectedFolder}/${parentRelPath}`)
        : selectedFolder;
      const fullPath = selectedFolder === 'root' ? relPath : `${selectedFolder}/${relPath}`;

      if (!createdFolderPaths.has(fullPath)) {
        await fetch(`${API}/api/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parent: parentFullPath })
        }).catch(() => {}); // ignore if already exists
        createdFolderPaths.add(fullPath);
      }
    }

    // Upload files into their respective folders
    let uploaded = 0;
    let failed = 0;
    for (const file of fileArray) {
      setUploadingFileName(file.name);
      const relativePath = (file as any).webkitRelativePath as string;
      const parts = relativePath.split('/');
      const fileFolderRelPath = parts.slice(0, -1).join('/');
      const targetFolder = fileFolderRelPath
        ? (selectedFolder === 'root' ? fileFolderRelPath : `${selectedFolder}/${fileFolderRelPath}`)
        : selectedFolder;

      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', targetFolder);
      fd.append('uploadedBy', 'User');

      const res = await fetch(`${API}/api/documents/upload`, { method: 'POST', body: fd });
      if (res.ok) {
        uploaded++;
        setUploadProgress(Math.round((uploaded / fileArray.length) * 100));
      } else {
        failed++;
      }
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadingFileName('');

    if (uploaded > 0) {
      const msg = failed > 0
        ? `Folder upload: ${uploaded} files succeed, ${failed} fail`
        : `Folder successfully upload ho gaya! ${uploaded} files, ${sortedPaths.length} subfolders`;
      showToast(msg, failed > 0 ? 'error' : 'success');
      loadFolders();
      loadDocuments(selectedFolder);
      loadUsage();
    } else {
      showToast('Folder upload fail ho gaya', 'error');
    }
  };


  // ── Delete document ───────────────────────────────────────────────────────
  const handleDeleteDoc = async (id: string) => {
    const res = await fetch(`${API}/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('File delete ho gayi!');
      setDocuments(prev => prev.filter(d => d._id !== id));
      loadUsage();
    } else {
      showToast('Delete failed', 'error');
    }
    setDeleteConfirm(null);
  };

  // ── Delete folder ─────────────────────────────────────────────────────────
  const handleDeleteFolder = async (folder: Folder) => {
    const res = await fetch(`${API}/api/folders/${folder._id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      showToast(`Folder "${folder.name}" delete ho gaya!`);
      setFolders(prev => prev.filter(f => f._id !== folder._id));
      if (selectedFolder === folder.path) setSelectedFolder('root');
    } else {
      showToast(data.error || 'Delete failed', 'error');
    }
  };

  // ── Create folder ─────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await fetch(`${API}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim(), parent: selectedFolder })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Folder "${data.name}" create ho gaya!`);
      setFolders(prev => [...prev, data]);
      setNewFolderName('');
      setShowNewFolder(false);
    } else {
      showToast(data.error || 'Failed to create folder', 'error');
    }
  };

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const getBreadcrumb = () => {
    if (selectedFolder === 'root') return [{ label: 'Root', path: 'root' }];
    const parts = selectedFolder.split('/');
    return [
      { label: 'Root', path: 'root' },
      ...parts.map((p, i) => ({ label: p, path: parts.slice(0, i + 1).join('/') }))
    ];
  };

  const currentFolderInfo = folders.find(f => f.path === selectedFolder);
  const subFolders = folders.filter(f => f.parent === selectedFolder);

  return (
    <div className="flex flex-col gap-6 min-h-full">

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-20 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white font-semibold text-sm transition-all animate-fade-in-up ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
        }`}>
          <span className="material-symbols-outlined text-[20px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
            </span>
            Document Manager
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">Files aur folders manage karein — Cloudinary pe store hote hain</p>
        </div>

        {/* Storage Usage Bar */}
        {usage && (
          <div className="bg-white/60 dark:bg-white/5 rounded-2xl px-5 py-3 border border-white/30 min-w-[200px]">
            <div className="flex justify-between text-xs text-on-surface-variant mb-2">
              <span className="font-semibold">☁️ Cloudinary Storage</span>
              <span className="font-bold text-primary">{usage.usedGB} / {usage.limitGB} GB</span>
            </div>
            <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-700"
                style={{ width: `${Math.min(parseFloat(usage.percentUsed), 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-outline mt-1">{usage.percentUsed}% used — {(25 - parseFloat(usage.usedGB)).toFixed(2)} GB free</p>
          </div>
        )}
      </div>

      {/* ── Main Layout ───────────────────────────────────────────── */}
      <div className="flex gap-5 min-h-[600px]">

        {/* ── LEFT: Folder Tree ──────────────────────────────────── */}
        <div className="w-64 shrink-0 bg-white/60 dark:bg-white/5 rounded-2xl border border-white/30 flex flex-col overflow-hidden shadow-sm">
          {/* Tree Header */}
          <div className="p-4 border-b border-white/20 flex justify-between items-center">
            <span className="font-bold text-sm text-on-surface">Folders</span>
            <button
              onClick={() => setShowNewFolder(true)}
              className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all"
              title="New Folder"
            >
              <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
            </button>
          </div>

          {/* New Folder Input */}
          {showNewFolder && (
            <div className="p-3 border-b border-white/20 bg-primary/5">
              <input
                autoFocus
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); } }}
                placeholder="Folder naam likhein..."
                className="w-full text-sm px-3 py-2 rounded-lg bg-white/80 dark:bg-white/10 border border-primary/30 outline-none focus:border-primary text-on-surface"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleCreateFolder} className="flex-1 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all">Create</button>
                <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="flex-1 py-1.5 rounded-lg bg-surface-variant text-on-surface-variant text-xs hover:bg-surface-variant/70 transition-all">Cancel</button>
              </div>
            </div>
          )}

          {/* Root */}
          <div className="flex-1 overflow-y-auto p-2">
            <button
              onClick={() => setSelectedFolder('root')}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-left text-sm font-semibold transition-all duration-200 ${
                selectedFolder === 'root'
                  ? 'bg-primary/15 text-primary'
                  : 'hover:bg-white/10 text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
              Root
            </button>

            {folders.filter(f => f.parent === 'root').map(folder => (
              <FolderNode
                key={folder._id}
                folder={folder}
                allFolders={folders}
                selected={selectedFolder}
                onSelect={setSelectedFolder}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT: File Area ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Breadcrumb + Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm">
              {getBreadcrumb().map((crumb, i, arr) => (
                <React.Fragment key={crumb.path}>
                  <button
                    onClick={() => setSelectedFolder(crumb.path)}
                    className={`hover:text-primary transition-colors font-medium px-1 ${
                      i === arr.length - 1 ? 'text-primary font-bold' : 'text-on-surface-variant'
                    }`}
                  >
                    {crumb.label}
                  </button>
                  {i < arr.length - 1 && (
                    <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
                  )}
                </React.Fragment>
              ))}
            </nav>

            {/* View toggle + Delete folder */}
            <div className="flex items-center gap-2">
              {selectedFolder !== 'root' && currentFolderInfo && (
                <button
                  onClick={() => handleDeleteFolder(currentFolderInfo)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-error hover:bg-error/10 text-sm font-medium transition-all"
                  title="Delete this folder"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Delete Folder
                </button>
              )}
              <div className="flex rounded-xl overflow-hidden border border-white/30">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm transition-all ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white/40 text-on-surface-variant hover:bg-white/60'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">grid_view</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-sm transition-all ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white/40 text-on-surface-variant hover:bg-white/60'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">view_list</span>
                </button>
              </div>
            </div>
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setIsDragOver(false);
              if (uploadMode === 'folder') {
                handleFolderUpload(e.dataTransfer.files);
              } else {
                handleUpload(e.dataTransfer.files);
              }
            }}
            className={`relative border-2 border-dashed rounded-2xl p-5 transition-all duration-300 ${
              isDragOver
                ? 'border-primary bg-primary/10 scale-[1.01]'
                : 'border-white/30 bg-white/30 dark:bg-white/5 hover:border-primary/60 hover:bg-primary/5'
            }`}
          >
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx,.doc,.docx,.txt"
              onChange={e => { handleUpload(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              // @ts-ignore — webkitdirectory is non-standard but widely supported
              webkitdirectory="true"
              multiple
              onChange={e => { handleFolderUpload(e.target.files); e.target.value = ''; }}
            />

            {uploading ? (
              <div className="flex flex-col items-center gap-3 w-full max-w-sm mx-auto py-4">
                <span className="material-symbols-outlined text-primary text-[40px] animate-bounce">cloud_upload</span>
                <p className="text-sm font-semibold text-primary">Uploading... {uploadProgress}%</p>
                {uploadingFileName && (
                  <p className="text-xs text-on-surface-variant truncate max-w-full px-4 text-center">
                    📄 {uploadingFileName}
                  </p>
                )}
                <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Mode Toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-outline uppercase tracking-wider">Upload Mode</p>
                  <div className="flex rounded-xl overflow-hidden border border-white/30 text-xs">
                    <button
                      onClick={() => setUploadMode('files')}
                      className={`px-3 py-1.5 font-semibold flex items-center gap-1.5 transition-all ${
                        uploadMode === 'files' ? 'bg-primary text-white' : 'bg-white/40 text-on-surface-variant hover:bg-white/60'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">upload_file</span>
                      Files
                    </button>
                    <button
                      onClick={() => setUploadMode('folder')}
                      className={`px-3 py-1.5 font-semibold flex items-center gap-1.5 transition-all ${
                        uploadMode === 'folder' ? 'bg-violet-600 text-white' : 'bg-white/40 text-on-surface-variant hover:bg-white/60'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">folder_zip</span>
                      Folder
                    </button>
                  </div>
                </div>

                {/* Drop area */}
                <div
                  onClick={() => uploadMode === 'folder'
                    ? folderInputRef.current?.click()
                    : fileInputRef.current?.click()
                  }
                  className="flex items-center gap-4 cursor-pointer py-3"
                >
                  <span className={`material-symbols-outlined text-[40px] ${
                    uploadMode === 'folder' ? 'text-violet-500/60' : 'text-primary/60'
                  }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {uploadMode === 'folder' ? 'folder_open' : 'upload_file'}
                  </span>
                  <div>
                    {uploadMode === 'folder' ? (
                      <>
                        <p className="text-sm font-semibold text-on-surface">
                          Poora folder drop karein ya{' '}
                          <span className="text-violet-600 underline">click karein</span>
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Subfolders ke saath automatically structure maintain hoga ✅
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-on-surface">
                          Files yahan drop karein ya{' '}
                          <span className="text-primary underline">click karein</span>
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          PDF, Images, Excel, Word — max 50MB per file
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sub-folders */}
          {subFolders.length > 0 && (
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-widest mb-2">Sub-folders</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {subFolders.map(folder => (
                  <button
                    key={folder._id}
                    onDoubleClick={() => setSelectedFolder(folder.path)}
                    onClick={() => setSelectedFolder(folder.path)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-white/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                  >
                    <span className="material-symbols-outlined text-amber-500 text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{folder.name}</p>
                      <p className="text-[10px] text-outline">Double click to open</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <div>
            <p className="text-xs font-bold text-outline uppercase tracking-widest mb-2">
              Files ({documents.length})
            </p>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[56px] opacity-30">folder_open</span>
                <p className="text-sm font-medium">Is folder mein koi file nahi hai</p>
                <p className="text-xs opacity-60">Upar se files upload karein</p>
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {documents.map(doc => {
                  const fi = fileIcon(doc.type);
                  return (
                    <div key={doc._id} className="group relative bg-white/60 dark:bg-white/5 rounded-2xl border border-white/30 hover:border-primary/40 hover:shadow-lg transition-all duration-200 overflow-hidden">
                      {/* Preview area */}
                      <div
                        className={`h-32 flex items-center justify-center cursor-pointer ${fi.bg}`}
                        onClick={() => openPreview(doc)}
                      >
                        <span className={`material-symbols-outlined text-[48px] ${fi.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          {fi.icon}
                        </span>
                      </div>

                      {/* File info */}
                      <div className="p-3">
                        <p className="text-xs font-semibold text-on-surface truncate" title={doc.name}>{doc.name}</p>
                        <p className="text-[10px] text-outline mt-0.5">{formatSize(doc.size)}</p>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-2xl">
                        <button
                          onClick={() => openPreview(doc)}
                          className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-all"
                          title="Preview"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); downloadDoc(doc); }}
                          className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-all"
                          title="Download"
                        >
                          <span className="material-symbols-outlined text-[18px]">download</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(doc._id)}
                          className="w-9 h-9 rounded-full bg-red-500/60 hover:bg-red-500 flex items-center justify-center text-white transition-all"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="bg-white/60 dark:bg-white/5 rounded-2xl border border-white/30 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/20 bg-white/40 dark:bg-white/5 text-on-surface-variant text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3 font-semibold">File</th>
                      <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Type</th>
                      <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Size</th>
                      <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Uploaded</th>
                      <th className="text-right px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {documents.map(doc => {
                      const fi = fileIcon(doc.type);
                      return (
                        <tr key={doc._id} className="hover:bg-white/30 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${fi.bg} flex items-center justify-center flex-shrink-0`}>
                                <span className={`material-symbols-outlined text-[18px] ${fi.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{fi.icon}</span>
                              </div>
                              <span className="font-medium text-on-surface truncate max-w-[180px]" title={doc.name}>{doc.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${fi.bg} ${fi.color}`}>{doc.type}</span>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">{formatSize(doc.size)}</td>
                          <td className="px-4 py-3 text-on-surface-variant text-xs hidden lg:table-cell">{formatDate(doc.uploadedAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openPreview(doc)} className="p-2 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-all" title="Preview">
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                              </button>
                              <button onClick={() => downloadDoc(doc)}
                                className="p-2 rounded-lg hover:bg-green-500/10 text-on-surface-variant hover:text-green-600 transition-all" title="Download">
                                <span className="material-symbols-outlined text-[18px]">download</span>
                              </button>
                              <button onClick={() => setDeleteConfirm(doc._id)} className="p-2 rounded-lg hover:bg-red-500/10 text-on-surface-variant hover:text-error transition-all" title="Delete">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Confirm Modal ──────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-[28px]">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface text-lg">File Delete Karein?</h3>
                <p className="text-on-surface-variant text-sm">Yeh action undo nahi hoga</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">File Cloudinary aur database dono se delete ho jayegi.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-2xl bg-surface-variant text-on-surface-variant font-semibold hover:bg-surface-variant/70 transition-all">Cancel</button>
              <button onClick={() => handleDeleteDoc(deleteConfirm)} className="flex-1 py-3 rounded-2xl bg-error text-on-error font-semibold hover:bg-error/90 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ─────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => { setPreviewDoc(null); setPreviewSignedUrl(null); }}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-surface rounded-3xl overflow-hidden shadow-2xl border border-white/20" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 bg-white/40 dark:bg-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`material-symbols-outlined text-[22px] ${fileIcon(previewDoc.type).color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {fileIcon(previewDoc.type).icon}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface truncate">{previewDoc.name}</p>
                  <p className="text-xs text-on-surface-variant">{formatSize(previewDoc.size)} • {formatDate(previewDoc.uploadedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => downloadDoc(previewDoc)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download
                </button>
                <button onClick={() => { setPreviewDoc(null); setPreviewSignedUrl(null); }} className="p-2 rounded-xl hover:bg-black/10 text-on-surface-variant transition-all">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-hidden bg-black/20 min-h-[400px]">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                  <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-on-surface-variant">Secure link generate ho raha hai...</p>
                </div>
              ) : !previewSignedUrl ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                  <span className="material-symbols-outlined text-[48px] text-error opacity-60">error</span>
                  <p className="text-sm text-on-surface-variant">Preview load nahi hua. Dobara try karein.</p>
                </div>
              ) : previewDoc.type === 'image' ? (
                <img src={previewSignedUrl} alt={previewDoc.name} className="w-full h-full object-contain" />
              ) : previewDoc.type === 'pdf' ? (
                <div className="relative w-full h-full min-h-[500px] flex flex-col">
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewSignedUrl)}&embedded=true`}
                    title={previewDoc.name}
                    className="w-full flex-1 min-h-[500px]"
                    style={{ border: 'none' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                  <span className={`material-symbols-outlined text-[80px] ${fileIcon(previewDoc.type).color} opacity-60`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {fileIcon(previewDoc.type).icon}
                  </span>
                  <p className="text-on-surface-variant text-center">Is file type ka preview available nahi hai.<br />Download karein aur open karein.</p>
                  <button
                    onClick={() => downloadDoc(previewDoc)}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-semibold hover:bg-primary/90 transition-all"
                  >
                    <span className="material-symbols-outlined">download</span>
                    Download {previewDoc.name}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
