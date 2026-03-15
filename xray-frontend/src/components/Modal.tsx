
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-main/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-main border border-line w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] flex flex-col shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] dark:shadow-[0_0_50px_-12px_rgba(99,102,241,0.1)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-line bg-card/30">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
            <h3 className="text-sm font-black text-base uppercase tracking-[0.2em]">{title}</h3>
          </div>
          
          <button 
            onClick={onClose} 
            className="group p-2.5 hover:bg-red-500/10 rounded-2xl text-muted hover:text-red-500 transition-all active:scale-90"
          >
            <X size={20} className="transition-transform group-hover:rotate-90" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>

        {/* Optional: Footer Hint */}
        <div className="px-8 py-3 bg-card/20 border-t border-line flex justify-end">
          <span className="text-[9px] font-bold text-muted/40 uppercase tracking-widest">
            Anaconduit Management Interface
          </span>
        </div>
      </div>
    </div>
  );
};

export default Modal;