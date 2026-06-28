import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from 'framer-motion';
import { formatTime } from '@/lib/timeUtils';

export default function ZmanimCard({ title, icon, color, times, use24Hour }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card className="shadow-lg border-0 overflow-hidden bg-card">
                <CardHeader className={`bg-gradient-to-r ${color} p-4`}>
                    <CardTitle className="text-white flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        <span className="text-lg font-semibold">{title}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {times.map((time, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                                    time.highlight ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className={`font-semibold ${
                                            time.highlight ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {time.label}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{time.description}</p>
                                    </div>
                                    <div className={`text-right font-mono text-lg font-bold ${
                                        time.highlight 
                                            ? 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-3 py-1 rounded-lg' 
                                            : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                        {formatTime(time.value, use24Hour)}
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