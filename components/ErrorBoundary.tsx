import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // Explicitly define props to satisfy TypeScript if generic inference fails
  readonly props: Readonly<Props>;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 text-center font-sans" dir="rtl">
            <div className="max-w-md w-full bg-[#0f172a] border border-red-500/20 rounded-2xl p-8 shadow-2xl shadow-red-500/10">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-white mb-2">حدث خطأ غير متوقع</h1>
                <p className="text-slate-400 text-sm mb-6">
                    واجه النظام مشكلة أثناء معالجة العرض. تم تسجيل الخطأ في السجلات.
                </p>
                <div className="bg-black/30 p-4 rounded-lg text-left text-[10px] font-mono text-red-300 mb-6 overflow-x-auto border border-white/5">
                    {this.state.error?.message}
                </div>
                <div className="flex gap-3 justify-center">
                    <button 
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-bold"
                    >
                        <RefreshCw className="w-4 h-4" /> إعادة التشغيل
                    </button>
                    <button 
                        onClick={() => window.location.href = '/'}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-lg transition-colors text-sm font-bold"
                    >
                        <Home className="w-4 h-4" /> الرئيسية
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}