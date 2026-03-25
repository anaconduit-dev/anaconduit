import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import { toast } from 'react-hot-toast';
import { 
  Database, Download, Trash2, Plus, 
  X, HardDrive, Loader2, FileJson 
} from 'lucide-react';
import { useConfirm } from "../context/ConfirmContext";
import { 
  getBackupsList, createBackup, 
  deleteBackup, downloadBackupFile, type BackupFile 
} from "../api/backup"; // или твой путь к api

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BackupModal({ isOpen, onClose }: BackupModalProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBackupsList();
      setBackups(data);
    } catch (err) {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) fetchBackups();
  }, [isOpen, fetchBackups]);

  const handleCreate = async () => {
    setActionLoading('creating');
    try {
      await createBackup();
      toast.success(t("system.createSuccess"));
      fetchBackups();
    } catch (err) {
      toast.error(t("common.error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (filename: string) => {
    const isConfirmed = await confirm({
      title: t("common.delete"),
      message: t("system.deleteConfirm", { filename }),
      type: 'danger',
      confirmText: t("common.delete"),
      cancelText: t("common.cancel")
    });

    if (!isConfirmed) return;

    try {
      await deleteBackup(filename);
      toast.success(t("system.deleteSuccess"));
      fetchBackups();
    } catch (err) {
      toast.error(t("common.error"));
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await downloadBackupFile(filename);
    } catch (err) {
      toast.error(t("system.downloadError"));
    }
  };

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111111] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Database className="w-6 h-6 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-white">{t("system.backups")}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleCreate}
              disabled={!!actionLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition-all font-medium"
            >
              {actionLoading === 'creating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t("system.createBackup")}
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
            ) : backups.length > 0 ? (
              backups.map((b) => (
                <div key={b.filename} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/5 rounded-lg text-gray-400">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-gray-200 truncate max-w-[200px] sm:max-w-xs" title={b.filename}>
                        {b.filename}
                      </div>
                      <div className="text-xs text-gray-500 flex gap-3 mt-1">
                        <span>{new Date(b.created_at).toLocaleString()}</span>
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" /> {formatSize(b.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(b.filename)}
                      className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                      title={t("common.download")}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(b.filename)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                      title={t("common.delete")}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p>{t("system.noBackups")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}