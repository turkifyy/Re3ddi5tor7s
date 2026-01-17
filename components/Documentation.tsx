
import React from 'react';
import { BookOpen, ShieldCheck, Link, AlertTriangle, Cpu } from 'lucide-react';

export const Documentation: React.FC = () => {
  return (
    <div className="section">
        <h4 className="white-text"><BookOpen size={32} style={{verticalAlign: 'bottom'}}/> System Manual</h4>
        
        <div className="row">
            <div className="col s12">
                <div className="card-panel blue-grey darken-3">
                    <h5 className="white-text"><ShieldCheck size={20}/> 1. Initial Setup</h5>
                    <p className="grey-text text-lighten-2">
                        The system relies on Firebase (Serverless). You must obtain a Project ID and API Key from the Firebase Console.
                        Enable Authentication (Email/Password) and Firestore Database (Test Mode) before starting.
                    </p>
                </div>
            </div>

            <div className="col s12">
                 <ul className="collection with-header border-none" style={{border: 'none'}}>
                    <li className="collection-header blue-grey darken-4 white-text"><h6><Link size={18}/> 2. Reddit API Linking</h6></li>
                    <li className="collection-item blue-grey darken-3 white-text">
                        1. Go to reddit.com/prefs/apps
                    </li>
                    <li className="collection-item blue-grey darken-3 white-text">
                        2. Create a 'script' app.
                    </li>
                    <li className="collection-item blue-grey darken-3 white-text">
                        3. Copy Client ID and Secret to Settings > Credential Pool.
                    </li>
                 </ul>
            </div>

            <div className="col s12 m6">
                <div className="card blue-grey darken-3">
                    <div className="card-content white-text">
                        <span className="card-title"><AlertTriangle size={20}/> 3. Limits</span>
                        <p>Reddit API allows ~600 req/10 mins. The system auto-pauses when limits are hit.</p>
                    </div>
                </div>
            </div>

            <div className="col s12 m6">
                <div className="card blue-grey darken-3">
                    <div className="card-content white-text">
                        <span className="card-title"><Cpu size={20}/> 4. AI Engine</span>
                        <p>Configure DeepSeek API Key in Settings to enable Auto-Reply and Sentiment Analysis.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
