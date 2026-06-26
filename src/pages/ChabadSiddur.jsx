import React, { useState } from 'react';
import { ExternalLink, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
const SOURCE_URL = 'https://www.sefaria.org/Weekday_Siddur_Chabad';

export default function ChabadSiddur() {
    const [iframeError, setIframeError] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 flex flex-col">

            {/* Header */}
            <div className="text-center pt-8 pb-4 px-4">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-1">Weekday Chabad Siddur</h1>
                <p className="text-slate-500 text-sm mb-3">סידור חב״ד</p>
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Open in Sefaria
                    </Button>
                </a>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center mx-4 mb-2">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-slate-600">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(1)} className="gap-2 text-slate-600">
                    Forward
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Iframe or fallback */}
            <div className="flex-1 mx-4 mb-4 rounded-xl overflow-hidden shadow-lg border border-slate-200 bg-white min-h-[70vh]">
                {iframeError ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                        <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
                        <p className="text-slate-700 font-semibold mb-2">Unable to load inline</p>
                        <p className="text-slate-500 text-sm mb-4">Sefaria cannot be embedded. Please open it directly.</p>
                        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
                            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                                <ExternalLink className="w-4 h-4" />
                                Open Sefaria
                            </Button>
                        </a>
                    </div>
                ) : (
                    <iframe
                        src={SOURCE_URL}
                        className="w-full h-full min-h-[70vh]"
                        title="Weekday Chabad Siddur"
                        onError={() => setIframeError(true)}
                    />
                )}
            </div>
        </div>
    );
}