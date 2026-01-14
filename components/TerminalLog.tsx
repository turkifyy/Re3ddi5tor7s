
import React, { useEffect, useRef, useState, memo } from 'react';
import { INITIAL_LOGS } from './constants';
import { SystemLog } from '../types';
import { logger } from '../services/logger';

// Memoized to prevent re-renders when parent changes but logs don't (rare but good practice)
export const TerminalLog: React.FC = memo(() => {
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_LOGS);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to logger events
    const unsubscribe = logger.subscribe((newLog) => {
      setLogs(prev => {
        // Performance: Keep array size manageable (Max 50)
        const newLogs = [...prev, newLog];
        if (newLogs.length > 50) return newLogs.slice(-50);
        return newLogs;
      });
    });

    return () => {
        unsubscribe();
    };
  }, []);

  // Optimized Scroll: Only scroll if already near bottom or on new log
  useEffect(() => {
    if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-primary-400';
      case 'WARN': return 'text-orange-400';
      case 'ERROR': return 'text-red-500';
      case 'SUCCESS': return 'text-success-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="border-t border-white/10 h-56 flex flex-col font-mono text-[10px] bg-[#02050e] relative z-20 crt-overlay overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)]" dir="ltr">
      {/* Header */}
      <div className="bg-[#0f172a] px-4 py-1.5 text-slate-500 border-b border-white/5 flex justify-between items-center z-10" dir="rtl">
        <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
            <span className="tracking-widest font-bold opacity-60 mr-2">SYSTEM_KERNEL_V5.0_PROD</span>
        </div>
        <div className="flex gap-2 items-center">
            <span className="w-1.5 h-1.5 bg-success-500 animate-blink shadow-[0_0_5px_#22c55e]"></span>
            <span className="text-success-500 font-bold tracking-wider">بث حي</span>
        </div>
      </div>
      
      {/* Log Body */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-1 relative z-10 custom-scrollbar font-mono leading-relaxed" dir="ltr">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 hover:bg-white/5 px-2 py-0.5 rounded-sm transition-colors group">
            <span className="text-slate-600 min-w-[140px] opacity-70">[{log.timestamp.split('T')[1].replace('Z','')}]</span>
            <span className={`font-bold min-w-[50px] ${getLevelColor(log.level)}`}>{log.level}</span>
            <span className="text-slate-500 min-w-[30px] font-bold group-hover:text-white transition-colors">{log.module}::</span>
            <span className="text-slate-300 whitespace-pre-wrap break-all drop-shadow-sm font-medium tracking-tight group-hover:text-primary-300 transition-colors">
                <span className="mr-2 text-slate-600">{`>`}</span>
                {log.message}
            </span>
          </div>
        ))}
        
        {/* Blinking Cursor at bottom */}
        <div className="flex items-center gap-2 px-2 mt-2 animate-pulse text-primary-500">
            <span>_</span>
        </div>
        
        <div ref={endRef} />
      </div>
    </div>
  );
});
