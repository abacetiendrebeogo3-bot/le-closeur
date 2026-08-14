import React from "react";

interface ToastProps {
  message: string;
  type: "success" | "warning" | "info";
}

export const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div className="fixed bottom-6 right-6 bg-encre text-neige px-4 py-3 rounded-xl border border-graphite shadow-2xl flex items-center gap-3 z-50 transition-all duration-300">
      <span className={`w-2 h-2 rounded-full ${type === "success" ? 'bg-green-500' : type === "warning" ? 'bg-menthe' : 'bg-blue-500'}`} />
      <span className="text-xs font-semibold">{message}</span>
    </div>
  );
};
