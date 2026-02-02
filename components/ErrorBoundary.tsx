
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
        <div className="d-flex vh-100 align-items-center justify-content-center bg-dark p-4 text-center font-sans" dir="rtl">
            <div className="card bg-black border border-danger border-opacity-25 shadow-lg" style={{maxWidth: '500px', width: '100%'}}>
                <div className="card-body p-5">
                    <div className="rounded-circle bg-danger bg-opacity-10 d-flex align-items-center justify-content-center mx-auto mb-4" style={{width: '64px', height: '64px'}}>
                        <AlertTriangle className="text-danger" size={32} />
                    </div>
                    <h2 className="h4 fw-bold text-white mb-2">حدث خطأ غير متوقع</h2>
                    <p className="text-muted small mb-4">
                        واجه النظام مشكلة أثناء معالجة العرض. تم تسجيل الخطأ في السجلات.
                    </p>
                    <div className="bg-dark p-3 rounded text-start text-danger font-monospace mb-4 border border-secondary border-opacity-10 overflow-auto" style={{fontSize: '0.75rem', maxHeight: '150px'}}>
                        {this.state.error?.message}
                    </div>
                    <div className="d-flex gap-3 justify-content-center">
                        <button 
                            onClick={() => window.location.reload()}
                            className="btn btn-outline-light d-flex align-items-center"
                        >
                            <RefreshCw className="me-2" size={16} /> إعادة التشغيل
                        </button>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="btn btn-primary d-flex align-items-center"
                        >
                            <Home className="me-2" size={16} /> الرئيسية
                        </button>
                    </div>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
