import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { APPOINTMENTS } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";
import "./Calendar.css";

export default function Calendar() {
  const [appointments, setAppointments] = useState([]);
  const [visibleRange, setVisibleRange] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadAppointments = async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        if (visibleRange.start) query.set("start", visibleRange.start);
        if (visibleRange.end) query.set("end", visibleRange.end);
        const data = await apiFetch(`${APPOINTMENTS}?${query.toString()}`);
        if (!mounted) {
          return;
        }
        const results = Array.isArray(data) ? data : data.results || [];
        setAppointments(results);
      } catch (error) {
        console.error("Failed to load appointments:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAppointments();

    return () => {
      mounted = false;
    };
  }, [visibleRange.start, visibleRange.end]);

  const events = useMemo(
    () =>
      appointments.map((appointment) => ({
        id: appointment.id,
        title: `${appointment.patient_matric_number || "Patient"} - ${appointment.reason}`,
        start: appointment.scheduled_for,
        backgroundColor:
          appointment.status === "completed"
            ? "#2f855a"
            : appointment.status === "missed"
              ? "#c53030"
              : appointment.status === "cancelled"
                ? "#718096"
                : "#0ea5e9",
        borderColor:
          appointment.status === "completed"
            ? "#2f855a"
            : appointment.status === "missed"
              ? "#c53030"
              : appointment.status === "cancelled"
                ? "#718096"
                : "#0284c7",
      })),
    [appointments]
  );

  const handleDateClick = (arg) => {
    alert(arg.dateStr);
  };

  return (
    <>
      {loading && <p className="calendar-loading">Loading clinic appointments...</p>}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        dateClick={handleDateClick}
        datesSet={(dateInfo) =>
          setVisibleRange({ start: dateInfo.startStr, end: dateInfo.endStr })
        }
        initialView="dayGridMonth"
        height="auto"
        events={events}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,dayGridWeek",
        }}
      />
    </>
  );
}
