import React from "react";
import Card from "react-bootstrap/Card";
import Calendar from "./Calendar";

const TodaySchedule = () => {
  return (
    <div>
      <Card className="m-1">
        <Card.Body>
          <Card.Title>Today Schedule</Card.Title>
          <Card.Text>
            Appointment blocks are loaded from the backend and rendered in the
            calendar below.
          </Card.Text>
          <Calendar />
        </Card.Body>
      </Card>
    </div>
  );
};

export default TodaySchedule;
