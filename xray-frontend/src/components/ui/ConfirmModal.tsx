import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

export default function ConfirmModal({ 
  isOpen, title, message, onConfirm, onCancel, 
  confirmText = "Подтвердить", cancelText = "Отмена", type = 'info' 
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop с размытием в твоем стиле */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-main/60 backdrop-blur-md"
          />
          
          {/* Сама карточка модалки */}
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-card border border-line rounded-[3rem] shadow-2xl overflow-hidden"
          >
            {/* Декоративная полоса сверху */}
            <div className={`h-1.5 w-full ${type === 'danger' ? 'bg-red-500' : 'bg-indigo-500'}`} />
            
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                  <AlertTriangle size={28} />
                </div>
                <button onClick={onCancel} className="p-2 text-muted hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <h3 className="text-xl font-black uppercase tracking-tight mb-3 text-white">
                {title}
              </h3>
              <p className="text-sm text-muted font-bold leading-relaxed mb-10">
                {message}
              </p>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={onConfirm}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all active:scale-95 shadow-xl ${
                    type === 'danger' 
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20'
                  }`}
                >
                  {confirmText}
                </button>
                <button 
                  onClick={onCancel}
                  className="w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] text-muted hover:text-white transition-colors"
                >
                  {cancelText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}