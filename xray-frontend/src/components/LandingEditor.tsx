import { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/themes/prism-tomorrow.css';
import { 
  Save, FileCode, Plus, Trash2, RefreshCw, 
  Folder, ChevronRight, Home, ArrowLeft 
} from 'lucide-react';

import { 
  getLandingFiles, 
  getFileContent, 
  saveFileContent, 
  deleteLandingFile,
  type LandingFile // Импортируем новый интерфейс
} from '../api/nginx';

const LandingEditor = () => {
  const [files, setFiles] = useState<LandingFile[]>([]); // Теперь это объекты
  const [currentPath, setCurrentPath] = useState(""); // Текущая папка
  const [currentFile, setCurrentFile] = useState('index.html');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Загрузка списка файлов для конкретной папки
  const loadFileList = async (path = "") => {
    try {
      const fileList = await getLandingFiles(path);
      setFiles(fileList);
      setCurrentPath(path);
    } catch (e) { console.error("Ошибка списка файлов", e); }
  };

  const loadFile = async (filePath: string) => {
    setLoading(true);
    setCurrentFile(filePath);
    try {
      const content = await getFileContent(filePath);
      setCode(content);
    } catch (e) { 
      console.error("Ошибка загрузки файла", e);
      setCode("");
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveFileContent(currentFile, code);
      // Перезагружаем текущую папку, чтобы увидеть изменения
      await loadFileList(currentPath);
    } finally { setSaving(false); }
  };

  const handleCreate = () => {
    // Теперь можно вводить путь: "css/style.css"
    const name = prompt("Имя файла (можно с папкой, напр. assets/style.css):");
    if (name && name.trim()) {
      const fullPath = currentPath ? `${currentPath}/${name.trim()}` : name.trim();
      setCurrentFile(fullPath);
      setCode('');
    }
  };

  const handleDelete = async (file: LandingFile) => {
    // Формируем текст сообщения в зависимости от типа объекта
    let message = `Вы уверены, что хотите удалить файл "${file.name}"?`;
    
    if (file.is_dir) {
      message = `⚠️ ВНИМАНИЕ: Вы удаляете ПАПКУ "${file.name}". \n\nВсе файлы и подпапки внутри неё будут удалены БЕЗВОЗВРАТНО! Продолжить?`;
    }

    // Используем стандартный confirm (или твой кастомный модал, если он есть)
    if (!window.confirm(message)) return;

    try {
      setLoading(true); // Покажем спиннер во время удаления
      await deleteLandingFile(file.path);
      
      // Если мы удалили папку, в которой сейчас находимся, или выше по дереву
      if (file.is_dir && currentPath.startsWith(file.path)) {
        await loadFileList(""); // Возвращаемся в корень
        setCurrentFile("index.html"); // Сбрасываем редактор на главную
        await loadFile("index.html");
      } else {
        // Иначе просто обновляем текущий список
        await loadFileList(currentPath);
      }
      
      // Можно добавить тост об успехе
      // toast.success("Удалено успешно");
    } catch (e) {
      console.error("Ошибка при удалении", e);
      alert("Не удалось удалить: " + e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFileList(""); // Начинаем с корня
    loadFile('index.html');
  }, []);

  return (
    <div className="flex bg-main border border-line rounded-[2rem] overflow-hidden h-[700px] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
      
      {/* Sidebar - File Explorer */}
      <div className="w-80 border-r border-line flex flex-col bg-main/40 backdrop-blur-xl">
        <div className="p-5 border-b border-line space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">www root</span>
            </div>
            <button onClick={handleCreate} className="p-2 hover:bg-indigo-500/10 rounded-xl text-indigo-500 transition-all active:scale-90">
              <Plus size={18} />
            </button>
          </div>

          {/* Breadcrumbs - Навигация по папкам */}
          <div className="flex items-center gap-1 text-[10px] font-bold text-muted overflow-hidden">
             <button onClick={() => loadFileList("")} className="hover:text-indigo-500"><Home size={12}/></button>
             {currentPath.split('/').filter(Boolean).map((part, i, arr) => (
               <div key={part} className="flex items-center gap-1">
                 <ChevronRight size={10} className="opacity-30" />
                 <button 
                  onClick={() => loadFileList(arr.slice(0, i + 1).join('/'))}
                  className="hover:text-indigo-500 truncate max-w-[60px]"
                 >
                   {part}
                 </button>
               </div>
             ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {/* Кнопка "Назад", если мы в подпапке */}
          {currentPath && (
            <button 
              onClick={() => {
                const parts = currentPath.split('/');
                parts.pop();
                loadFileList(parts.join('/'));
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-xs font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-500/5 rounded-xl transition-all mb-2"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {files.map(file => (
            <div key={file.path} className="group flex items-center justify-between w-full gap-1">
              <button 
                onClick={() => file.is_dir ? loadFileList(file.path) : loadFile(file.path)} 
                className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all truncate border ${
                  currentFile === file.path 
                  ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 shadow-inner' 
                  : 'text-muted border-transparent hover:bg-card hover:text-base'
                }`}
              >
                {file.is_dir ? (
                  <Folder size={14} className="text-amber-500/60" />
                ) : (
                  <FileCode size={14} className={currentFile === file.path ? 'text-indigo-400' : 'text-muted/50'} />
                )}
                <span className="truncate tracking-tight">{file.name}</span>
              </button>
              
              {file.name !== 'index.html' && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    handleDelete(file);
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
      <div className="flex-1 flex flex-col bg-[#0d0d0f]">
        {/* Editor Toolbar */}
        <div className="px-6 py-4 border-b border-line flex justify-between items-center bg-main/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-indigo-500/50 uppercase tracking-widest">Editing</span>
            <div className="h-3 w-px bg-line"></div>
            <span className="font-mono text-[11px] text-muted tracking-tight">{currentFile}</span>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={saving || loading}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
              saving 
              ? 'bg-card text-muted cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40'
            }`}
          >
            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save File'}
          </button>
        </div>
        
        {/* Code Editor Surface */}
        <div className="flex-1 overflow-auto font-mono selection:bg-indigo-500/30">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-full gap-4">
               <RefreshCw className="animate-spin text-indigo-500" size={32} />
               <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Loading Source</span>
             </div>
          ) : (
            <div className="relative min-h-full py-4">
              <Editor
                value={code}
                onValueChange={setCode}
                highlight={code => Prism.highlight(code, Prism.languages.markup, 'markup')}
                padding={24}
                style={{ 
                  fontSize: 13, 
                  minHeight: '100%',
                  lineHeight: '1.5',
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