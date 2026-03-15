import { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism-tomorrow.css';
import { Save, FileCode, Plus, Trash2, RefreshCw } from 'lucide-react';

// Импортируем наши "чистые" функции
import { 
  getLandingFiles, 
  getFileContent, 
  saveFileContent, 
  deleteLandingFile 
} from '../api/nginx';

const LandingEditor = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState('index.html');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFileList = async () => {
    try {
      const fileList = await getLandingFiles();
      setFiles(fileList);
    } catch (e) { console.error("Ошибка списка файлов", e); }
  };

  const loadFile = async (filename: string) => {
    setLoading(true);
    setCurrentFile(filename);
    try {
      const content = await getFileContent(filename);
      setCode(content);
    } catch (e) { console.error("Ошибка загрузки файла", e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveFileContent(currentFile, code);
      // Если создали новый файл, обновим список
      if (!files.includes(currentFile)) await loadFileList();
    } finally { setSaving(false); }
  };

  const handleCreate = () => {
    const name = prompt("Имя нового файла (например, styles.css):");
    if (name && name.trim()) {
      setCurrentFile(name);
      setCode('');
    }
  };

  useEffect(() => {
    loadFileList();
    loadFile('index.html');
  }, []);

  return (
  <div className="flex bg-main border border-line rounded-[2rem] overflow-hidden h-[600px] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
    {/* Sidebar - File Explorer */}
    <div className="w-72 border-r border-line flex flex-col bg-main/40 backdrop-blur-xl">
      <div className="p-5 border-b border-line flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
          </div>
          <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Explorer</span>
        </div>
        <button 
          onClick={handleCreate} 
          className="p-2 hover:bg-indigo-500/10 rounded-xl text-indigo-500 transition-all active:scale-90"
          title="Новый файл"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {files.map(file => (
          <div key={file} className="group flex items-center justify-between w-full gap-1">
            <button 
              onClick={() => loadFile(file)} 
              className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all truncate border ${
                currentFile === file 
                ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400' 
                : 'text-muted border-transparent hover:bg-card hover:text-base'
              }`}
            >
              <FileCode size={14} className={currentFile === file ? 'text-indigo-400' : 'text-muted/50'} /> 
              <span className="truncate tracking-tight">{file}</span>
            </button>
            
            {file !== 'index.html' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm(`Удалить ${file}?`)) deleteLandingFile(file).then(loadFileList);
                }}
                className="opacity-0 group-hover:opacity-100 p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Main Editor Area */}
    <div className="flex-1 flex flex-col bg-card/20">
      {/* Editor Toolbar */}
      <div className="px-6 py-4 border-b border-line flex justify-between items-center bg-main/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40"></div>
          </div>
          <div className="h-4 w-px bg-line mx-1"></div>
          <span className="text-base font-mono text-xs tracking-tight opacity-80">{currentFile}</span>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
            saving 
            ? 'bg-main text-muted cursor-not-allowed' 
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
          }`}
        >
          {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      
      {/* Code Editor Surface */}
      <div className="flex-1 overflow-auto bg-[#0a0a0c] font-mono selection:bg-indigo-500/30">
        {loading ? (
           <div className="flex items-center justify-center h-full space-x-3">
             <RefreshCw className="animate-spin text-indigo-500" size={20} />
             <span className="text-xs font-black text-muted uppercase tracking-widest">Loading Source...</span>
           </div>
        ) : (
          <div className="relative min-h-full">
            <Editor
              value={code}
              onValueChange={setCode}
              highlight={code => Prism.highlight(code, Prism.languages.markup, 'markup')}
              padding={24}
              style={{ 
                fontSize: 13, 
                minHeight: '100%',
                fontFamily: '"Fira Code", "JetBrains Mono", monospace'
              }}
              className="text-slate-300 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default LandingEditor;