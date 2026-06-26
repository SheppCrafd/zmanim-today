import React, { useState } from 'react';
import { ExternalLink, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import NavMenu from '../components/NavMenu';

const SOURCE_URL = 'https://www.sefaria.org/Siddur_Edot_HaMizrach';

export default function SephardicSiddur() {
    const [iframeError, setIframeError] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-amber-50 flex flex-col">
            <NavMenu />

            {/* Back button */}
            <div className="pt-16 px-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-slate-600">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>
            </div>

            {/* Header */}
            <div className="text-center pb-4 px-4">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-1">Sephardic Siddur</h1>
                <p className="text-slate-500 text-sm mb-3">סידור עדות המזרח</p>
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Open in Sefaria
                    </Button>
                </a>
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
                        title="Sephardic Siddur"
                        onError={() => setIframeError(true)}
                    />
                )}
            </div>
        </div>
    );
}