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
    <div className="flex bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden h-[600px] shadow-2xl">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-800 flex flex-col bg-slate-900/40">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Explorer</span>
          <button onClick={handleCreate} className="p-1.5 hover:bg-slate-800 rounded-md text-blue-400 transition-colors">
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {files.map(file => (
              <div key={file} className="group flex items-center justify-between w-full pr-2">
                <button 
                  onClick={() => loadFile(file)} 
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all truncate ${
                    currentFile === file 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <FileCode size={14} /> 
                  <span className="truncate">{file}</span>
                </button>
                
                {file !== 'index.html' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // Чтобы не сработал выбор файла
                      if(confirm(`Удалить ${file}?`)) deleteLandingFile(file).then(loadFileList);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-white font-mono text-sm">{currentFile}</span>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
        
        <div className="flex-1 overflow-auto bg-slate-950 font-mono scrollbar-hide">
          {loading ? (
             <div className="p-10 text-slate-600 italic">Читаем файл...</div>
          ) : (
            <Editor
              value={code}
              onValueChange={setCode}
              highlight={code => Prism.highlight(code, Prism.languages.markup, 'markup')}
              padding={20}
              style={{ fontSize: 13, minHeight: '100%' }}
              className="text-slate-300 focus:outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingEditor;