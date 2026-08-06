import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  RiAdminLine,
  RiAccountCircleLine,
  RiCalendarLine,
  RiCloseLine,
  RiDashboard3Line,
  RiFileSearchLine,
  RiFlowChart,
  RiHeartPulseLine,
  RiLockPasswordLine,
  RiLogoutCircleRLine,
  RiMenuLine,
  RiSettingsLine,
  RiStethoscopeLine,
  RiTeamLine,
  RiUserAddLine,
  RiUser3Line,
} from "react-icons/ri";
import { logout } from "../../slices/authForm/logout";
import { roleConfig } from "../../config/roleCapabilities";
import "./AppShell.css";

const icons = {
  dashboard: RiDashboard3Line,
  overview: RiFlowChart,
  intakes: RiUserAddLine,
  patients: RiUser3Line,
  appointments: RiCalendarLine,
  doctor: RiStethoscopeLine,
  nurse: RiHeartPulseLine,
  staff: RiTeamLine,
  audit: RiFileSearchLine,
  icd: RiStethoscopeLine,
  settings: RiSettingsLine,
  account: RiAccountCircleLine,
  history: RiFileSearchLine,
  journey: RiFlowChart,
  clinical: RiHeartPulseLine,
  admin: RiAdminLine,
};

const ClinicMark = () => <span className="clinic-mark" aria-hidden="true">+</span>;

export default function AppShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useSelector((state) => state.auth.profile);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const configuration = roleConfig(profile?.role);
  const links = configuration.navigation;

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/");
  };

  return (
    <div className="portal-shell">
      <button
        className={`portal-scrim ${menuOpen ? "is-open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-label="Close navigation"
        tabIndex={menuOpen ? 0 : -1}
      />
      <aside className={`portal-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <ClinicMark />
          <div><strong>School Complex Clinic</strong><span>Electronic Health Record</span></div>
          <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><RiCloseLine /></button>
        </div>
        <div className="sidebar-context">
          <span>{configuration.displayName}</span>
          <strong>{profile?.first_name} {profile?.last_name}</strong>
        </div>
        <nav className="sidebar-navigation" aria-label="Clinic portal navigation">
          {links.map(([to, label, icon]) => {
            const Icon = icons[icon] || RiDashboard3Line;
            return (
            <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon /><span>{label}</span>
            </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/change-password" onClick={() => setMenuOpen(false)}><RiLockPasswordLine /><span>Change password</span></NavLink>
          <button onClick={handleLogout}><RiLogoutCircleRLine /><span>Sign out</span></button>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar">
          <Button variant="link" className="menu-command" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><RiMenuLine /></Button>
          <div className="portal-topbar-title"><strong>UITH School Complex Clinic</strong><span>Clinical portal</span></div>
          <div className="topbar-identity" title={profile?.email || profile?.username}>
            <span>{profile?.first_name?.[0]}{profile?.last_name?.[0]}</span>
            <div><strong>{profile?.first_name} {profile?.last_name}</strong><small>{configuration.displayName}</small></div>
          </div>
        </header>
        <div className="portal-content">{children}</div>
      </div>
    </div>
  );
}
