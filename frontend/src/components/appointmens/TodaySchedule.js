import React from "react";
import Calendar from "./Calendar";

export default function TodaySchedule() {
  return (
    <main className="appointment-workspace">
      <header><span>Clinic operations</span><h1>Appointment schedule</h1></header>
      <Calendar />
    </main>
  );
}
