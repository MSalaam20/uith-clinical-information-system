import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Modal from "react-bootstrap/Modal";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { Link } from "react-router-dom";
import { RiHeartPulseLine, RiLoginCircleLine, RiUserHeartLine } from "react-icons/ri";
import { useSelector } from "react-redux";
import LoginForm from "../login/LoginForm";
import "./Header.css";

function Header() {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [showLogin, setShowLogin] = useState(false);
  const [portalType, setPortalType] = useState("staff");
  const openLogin = (type = "staff") => { setPortalType(type); setShowLogin(true); };

  useEffect(() => {
    const handleOpenLogin = (event) => openLogin(event.detail?.portalType || "staff");
    window.addEventListener("uith:open-login", handleOpenLogin);
    return () => window.removeEventListener("uith:open-login", handleOpenLogin);
  }, []);

  if (isAuthenticated) return null;

  return (
    <>
      <Navbar expand="lg" className="public-navbar" variant="dark">
        <Container>
          <Navbar.Brand as={Link} to="/" className="public-brand">
            <span className="public-brand-mark"><RiHeartPulseLine /></span>
            <span><strong>UITH School Complex Clinic</strong><small>Electronic Health Record</small></span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="public-navigation" />
          <Navbar.Collapse id="public-navigation">
            <Nav className="ms-auto public-links">
              <Nav.Link href="/#about">About</Nav.Link>
              <Nav.Link href="/#capabilities">Capabilities</Nav.Link>
              <Nav.Link href="/#security">Security</Nav.Link>
            </Nav>
            <div className="public-auth-actions">
              <Button variant="outline-light" onClick={() => openLogin("student")}><RiUserHeartLine /> Student portal</Button>
              <Button className="gold-button" onClick={() => openLogin("staff")}><RiLoginCircleLine /> Staff portal</Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Modal show={showLogin} onHide={() => setShowLogin(false)} centered className="clinic-login-modal">
        <Modal.Header closeButton><Modal.Title>{portalType === "student" ? "Student Patient Portal" : "Clinical Staff Portal"}</Modal.Title></Modal.Header>
        <Modal.Body><LoginForm onLoginSuccess={() => setShowLogin(false)} portalType={portalType} /></Modal.Body>
      </Modal>
    </>
  );
}

export default Header;
