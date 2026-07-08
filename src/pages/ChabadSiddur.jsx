import React from "react";
import SiddurView from "@/components/siddur/SiddurView";

export default function ChabadSiddur() {
  return (
    <SiddurView
      title="Weekday Chabad Siddur"
      subtitle='סידור חב"ד'
      bookRef="Weekday_Siddur_Chabad"
      sefariaUrl="https://www.sefaria.org/Weekday_Siddur_Chabad"
    />
  );
}
