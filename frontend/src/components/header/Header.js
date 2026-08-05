import React, { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import NavDropdown from "react-bootstrap/NavDropdown";
import Modal from "react-bootstrap/Modal";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  RiLoginCircleLine,
  RiLogoutCircleRLine,
  RiSettingsLine,
  RiCalendarLine,
  RiUser3Line,
  RiDashboard3Line,
  RiStethoscopeLine,
  RiAdminLine,
  RiFileSearchLine,
} from "react-icons/ri";
import LoginForm from "../login/LoginForm";
import "./Header.css";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../../slices/authForm/logout";

const HospitalBadge = () => (
  <span className="hospital-badge" aria-hidden="true">
    <svg viewBox="0 0 48 48" role="img" focusable="false">
      <path
        d="M24 4 40 10v12c0 10.8-6.8 18.3-16 22C14.8 40.3 8 32.8 8 22V10L24 4Z"
        className="hospital-badge-shield"
      />
      <path d="M21 13h6v8h8v6h-8v8h-6v-8h-8v-6h8v-8Z" />
    </svg>
  </span>
);

function Header() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const profileState = useSelector((state) => state.auth.profile);
  const profile = profileState;
  const isStudent = profile?.role === "PT";
  const isAdministrator = profile?.role === "AD";
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [portalType, setPortalType] = useState("staff");

  const handleCloseLogin = () => setShowLogin(false);
  const handleShowLogin = (type = "staff") => {
    setPortalType(type);
    setShowLogin(true);
  };

  const handleLogout = () => {
    dispatch(logout());
    setShowLogin(false);
    navigate("/");
  };

  useEffect(() => {
    const handleOpenLogin = (event) => {
      handleShowLogin(event.detail?.portalType || "staff");
    };

    window.addEventListener("uith:open-login", handleOpenLogin);

    return () => {
      window.removeEventListener("uith:open-login", handleOpenLogin);
    };
  }, []);

  return (
    <>
      <Navbar expand="lg" className="clinic-navbar">
        <Container fluid>
          <Navbar.Brand as={Link} to="/" className="uith-brand">
            <HospitalBadge />
            <span>
              UITH School Complex Clinic
              <small>Electronic Health Record System</small>
            </span>
          </Navbar.Brand>
          <Navbar.Toggle
            aria-controls="basic-navbar-nav"
            className="clinic-navbar-toggle"
          />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto clinic-nav-links">
              {isAuthenticated && (
                <>
                  <Nav.Link as={Link} to="/dashboard">
                    <RiDashboard3Line />
                    Clinic Dashboard
                  </Nav.Link>
                  <Nav.Link as={Link} to="/patients">
                    <RiUser3Line />
                    {isStudent ? "My Health Record" : "Student Patients"}
                  </Nav.Link>
                  <NavDropdown
                    title={
                      <>
                        <RiCalendarLine /> Appointments
                      </>
                    }
                    id="appointments-nav-dropdown"
                  >
                    <NavDropdown.Item as={Link} to="/today-schedule">
                      Today
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/today-schedule?range=week">
                      This week
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/today-schedule?range=month">
                      This month
                    </NavDropdown.Item>
                  </NavDropdown>
                  {!isStudent && (
                    <>
                      <Nav.Link as={Link} to="/setup">
                        <RiSettingsLine />
                        Clinic Setup
                      </Nav.Link>
                      <Nav.Link as={Link} to="/icd-11">
                        <RiStethoscopeLine />
                        ICD-11
                      </Nav.Link>
                    </>
                  )}
                  {isAdministrator && (
                    <>
                      <Nav.Link as={Link} to="/staff"><RiAdminLine /> Staff</Nav.Link>
                      <Nav.Link as={Link} to="/audit-logs"><RiFileSearchLine /> Audit log</Nav.Link>
                    </>
                  )}
                </>
              )}
            </Nav>

            <Nav className="clinic-auth-nav">
              {isAuthenticated ? (
                <Navbar.Text onClick={handleLogout} className="clinic-user-chip">
                  <span>
                    Welcome, {profile?.role_display} {profile?.first_name} {profile?.last_name}
                  </span>
                  <RiLogoutCircleRLine />
                </Navbar.Text>
              ) : (
                  <Navbar.Text
                  onClick={() => handleShowLogin("staff")}
                  className="clinic-login-button"
                >
                  <RiLoginCircleLine />
                  Sign In to Clinic Portal
                </Navbar.Text>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Outlet />
      <Modal
        show={showLogin}
        onHide={handleCloseLogin}
        centered
        className="clinic-login-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {portalType === "student"
              ? "Student Patient Portal"
              : "Clinical Staff Portal"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <LoginForm
            onLoginSuccess={handleCloseLogin}
            portalType={portalType}
          />
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Header;
