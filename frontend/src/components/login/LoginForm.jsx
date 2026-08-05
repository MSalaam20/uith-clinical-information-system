import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Card from "react-bootstrap/Card";
import "bootstrap/dist/css/bootstrap.min.css";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { login } from "../../slices/authForm/login";

const LoginForm = ({ onLoginSuccess, portalType = "staff" }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isStudentPortal = portalType === "student";
  const loginStatus = useSelector((state) => state.auth.status);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    if (identifier && password) {
      try {
        await dispatch(
          login({ username: identifier, password, portalType })
        ).unwrap();
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        navigate("/dashboard");
      } catch (error) {
        setErrorMessage(String(error || "Login failed."));
      }
    } else {
      setErrorMessage("Login identifier and password are required.");
    }
  };

  return (
    <Card className="clinic-login-card">
      <Card.Body>
        <Form onSubmit={handleLogin}>
          <Form.Group as={Row} className="mb-3" controlId="formPlaintextEmail">
            <Form.Label column sm="3">
              {isStudentPortal ? "Matric No." : "Staff ID"}
            </Form.Label>
            <Col sm="9">
              <Form.Control
                type="text"
                placeholder={
                  isStudentPortal
                    ? "Enter matric number or student username"
                    : "dr.jeremiah, nurse.fatima, mr.ibrahim"
                }
                autoComplete="username"
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </Col>
          </Form.Group>

          <Form.Group
            as={Row}
            className="mb-3"
            controlId="formPlaintextPassword"
          >
            <Form.Label column sm="3">
              Access Code
            </Form.Label>
            <Col sm="9">
              <Form.Control
                type="password"
                placeholder={
                  isStudentPortal
                    ? "Enter student portal password"
                    : "Enter clinic password"
                }
                autoComplete="password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Col>
          </Form.Group>

          <Form.Group as={Row} className="mb-3" controlId="submitLoginButton">
            {errorMessage && (
              <p className="text-danger" role="alert">{errorMessage}</p>
            )}
            <Button
              className="clinic-login-submit"
              type="submit"
              disabled={loginStatus === "loading"}
            >
              {loginStatus === "loading"
                ? "Signing in..."
                : isStudentPortal
                  ? "Sign in as student"
                  : "Sign in to clinic"}
            </Button>
          </Form.Group>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default LoginForm;
