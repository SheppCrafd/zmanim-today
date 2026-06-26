import React, { useState } from 'react';
import { ExternalLink, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import NavMenu from '@/components/NavMenu';
const SOURCE_URL = 'https://www.sefaria.org/Weekday_Siddur_Chabad';

export default function ChabadSiddur() {
    const [iframeError, setIframeError] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 flex flex-col">

            {/* Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center mb-3 min-h-[56px]">
                    <div className="shrink-0"><NavMenu /></div>
                    <div className="flex-1 text-center px-2">
                        <h1 className="text-2xl font-bold text-slate-800 leading-tight">Weekday Chabad Siddur</h1>
                        <p className="text-slate-500 text-sm">סידור חב״ד</p>
                    </div>
                    <div className="shrink-0 w-9"></div>
                </div>
                <div className="relative flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-slate-600">
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <div className="absolute left-1/2 -translate-x-1/2">
                        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5" />
                                Sefaria
                            </Button>
                        </a>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(1)} className="gap-2 text-slate-600">
                        Forward
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
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