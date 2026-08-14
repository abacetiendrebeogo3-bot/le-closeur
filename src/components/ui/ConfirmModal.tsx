import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, onCancel, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-encre/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-sm rounded-2xl border border-graphite/10 p-6 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-encre flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span>{title}</span>
        </h3>
        <p className="text-xs text-encre/60">{message}</p>
        <div className="flex justify-end gap-3.5 mt-2">
          <button onClick={onCancel} className="px-3.5 py-2 bg-neige border border-graphite/10 rounded-xl text-xs font-semibold">
            Annuler
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};
