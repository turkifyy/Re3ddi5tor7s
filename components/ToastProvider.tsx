import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastNotification } from '../types';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface ToastContextType {
  addToast: (type: ToastNotification['type'], message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((type: ToastNotification['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-24 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`pointer-events-auto min-w-[300px] p-4 rounded-xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-right-10 flex items-start gap-3
              ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-100' : 
                toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-100' : 
                'bg-blue-500/10 border-blue-500/20 text-blue-100'}`}
          >
            <div className="mt-0.5">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            </div>
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="opacity-50 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};