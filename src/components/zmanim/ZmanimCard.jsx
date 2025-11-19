import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from 'framer-motion';

export default function ZmanimCard({ title, icon, color, times }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card className="shadow-lg border-0 overflow-hidden bg-white/80 backdrop-blur-sm">
                <CardHeader className={`bg-gradient-to-r ${color} p-4`}>
                    <CardTitle className="text-white flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        <span className="text-lg font-semibold">{title}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {times.map((time, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className={`p-4 hover:bg-slate-50 transition-colors ${
                                    time.highlight ? 'bg-amber-50/50' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className={`font-semibold ${
                                            time.highlight ? 'text-slate-900' : 'text-slate-700'
                                        }`}>
                                            {time.label}
                                        </p>
                                        <p className="text-sm text-slate-500">{time.description}</p>
                                    </div>
                                    <div className={`text-right font-mono text-lg font-bold ${
                                        time.highlight 
                                            ? 'text-blue-700 bg-blue-100 px-3 py-1 rounded-lg' 
                                            : 'text-slate-700'
                                    }`}>
                                        {time.value}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}