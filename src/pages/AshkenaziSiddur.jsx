import React from 'react';
import SiddurView from '@/components/siddur/SiddurView';

export default function AshkenaziSiddur() {
    return (
        <SiddurView
            title="Ashkenazi Siddur"
            subtitle="סידור אשכנז"
            bookRef="Siddur_Ashkenaz"
            sefariaUrl="https://www.sefaria.org/Siddur_Ashkenaz"
        />
    );
}