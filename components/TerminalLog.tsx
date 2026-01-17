
import React, { useEffect, useRef, useState, memo } from 'react';
import { INITIAL_LOGS } from './constants';
import { SystemLog } from '../types';
import { logger } from '../services/logger';

export const TerminalLog: React.FC = memo(() => {
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_LOGS);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLog) => {
      setLogs(prev => {
        const newLogs = [...prev, newLog];
        if (newLogs.length > 50) return newLogs.slice(-50);
        return newLogs;
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-info';
      case 'WARN': return 'text-warning';
      case 'ERROR': return 'text-danger fw-bold';
      case 'SUCCESS': return 'text-success';
      default: return 'text-secondary';
    }
  };

  return (
    <div className="bg-dark bg-opacity-75 border border-secondary border-opacity-25 shadow-lg d-flex flex-column" style={{height: '200px', width: '100%'}}>
        <div className="bg-black bg-opacity-50 px-3 py-1 d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25">
             <span className="text-secondary font-monospace" style={{fontSize: '0.75rem'}}>SYSTEM_KERNEL_V6.0</span>
             <span className="text-success" style={{fontSize: '0.75rem'}}>● ONLINE</span>
        </div>
        <div className="flex-grow-1 p-2 overflow-auto font-monospace" style={{fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem'}}>
            {logs.map((log) => (
                <div key={log.id} className="mb-1 text-nowrap">
                    <span className="text-muted opacity-50 me-2">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                    <span className={`fw-bold me-2 ${getLevelColor(log.level)}`}>{log.level}</span>
                    <span className="text-secondary opacity-75">{log.module} :: </span>
                    <span className="text-light opacity-75">{log.message}</span>
                </div>
            ))}
            <div ref={endRef} />
        </div>
    </div>
  );
});
