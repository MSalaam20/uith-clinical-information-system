import React from "react";
import { RiInformationLine } from "react-icons/ri";

export default function StatePanel({ icon, title, message, children }) {
  return (
    <div className="state-panel">
      {icon || <RiInformationLine />}
      <h1>{title}</h1>
      {message && <p>{message}</p>}
      {children}
    </div>
  );
}
