
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

  const getStyles = (type: string) => {
      switch(type) {
          case 'success': return 'bg-success bg-opacity-10 border-success text-success';
          case 'error': return 'bg-danger bg-opacity-10 border-danger text-danger';
          default: return 'bg-info bg-opacity-10 border-info text-info';
      }
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'success': return <CheckCircle size={18} className="text-success me-2" />;
          case 'error': return <AlertCircle size={18} className="text-danger me-2" />;
          default: return <Info size={18} className="text-info me-2" />;
      }
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="position-fixed top-0 end-0 p-3" style={{zIndex: 9999, pointerEvents: 'none'}}>
        <div className="d-flex flex-column gap-2">
            {toasts.map(toast => (
            <div 
                key={toast.id}
                className={`toast show align-items-center border mb-2 ${getStyles(toast.type)}`}
                role="alert" 
                aria-live="assertive" 
                aria-atomic="true"
                style={{pointerEvents: 'auto', backdropFilter: 'blur(10px)', minWidth: '300px'}}
            >
                <div className="d-flex">
                <div className="toast-body d-flex align-items-start">
                    {getIcon(toast.type)}
                    <span className="fw-bold small">{toast.message}</span>
                </div>
                <button 
                    type="button" 
                    className="btn-close me-2 m-auto" 
                    onClick={() => removeToast(toast.id)}
                    style={{filter: 'invert(1)'}}
                ></button>
                </div>
            </div>
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};
