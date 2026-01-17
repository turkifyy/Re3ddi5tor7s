
import React from 'react';
import { BookOpen, ShieldCheck, Link, AlertTriangle, Cpu } from 'lucide-react';

export const Documentation: React.FC = () => {
  return (
    <div className="container-fluid p-0">
        <h3 className="fw-bold text-white mb-4"><BookOpen size={28} className="me-2 text-info"/> System Manual</h3>
        
        <div className="row">
            <div className="col-12 mb-4">
                <div className="card border-primary border-opacity-25 bg-primary bg-opacity-10">
                    <div className="card-body">
                        <h5 className="card-title text-info fw-bold"><ShieldCheck size={20} className="me-2"/> 1. Initial Setup</h5>
                        <p className="card-text text-light">
                            The system relies on Firebase (Serverless). You must obtain a Project ID and API Key from the Firebase Console.
                            Enable Authentication (Email/Password) and Firestore Database (Test Mode) before starting.
                        </p>
                    </div>
                </div>
            </div>

            <div className="col-12 mb-4">
                 <div className="card">
                    <div className="card-header bg-dark border-bottom border-secondary border-opacity-25 fw-bold text-white">
                        <Link size={18} className="me-2"/> 2. Reddit API Linking
                    </div>
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item bg-transparent text-white border-secondary border-opacity-25">
                            1. Go to reddit.com/prefs/apps
                        </li>
                        <li className="list-group-item bg-transparent text-white border-secondary border-opacity-25">
                            2. Create a 'script' app.
                        </li>
                        <li className="list-group-item bg-transparent text-white border-secondary border-opacity-25 d-flex align-items-center flex-wrap">
                            3. Copy Client ID and Secret to Settings <span className="text-info fw-bold mx-2">&rarr;</span> Credential Pool.
                        </li>
                    </ul>
                 </div>
            </div>

            <div className="col-md-6 mb-4">
                <div className="card h-100 border-warning border-opacity-25">
                    <div className="card-body">
                        <h5 className="card-title text-warning fw-bold"><AlertTriangle size={20} className="me-2"/> 3. Limits</h5>
                        <p className="card-text text-secondary">Reddit API allows ~600 req/10 mins. The system auto-pauses when limits are hit to prevent IP bans.</p>
                    </div>
                </div>
            </div>

            <div className="col-md-6 mb-4">
                <div className="card h-100 border-info border-opacity-25">
                    <div className="card-body">
                        <h5 className="card-title text-info fw-bold"><Cpu size={20} className="me-2"/> 4. AI Engine</h5>
                        <p className="card-text text-secondary">Configure DeepSeek API Key in Settings to enable Auto-Reply, Sentiment Analysis, and Campaign Generation.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
