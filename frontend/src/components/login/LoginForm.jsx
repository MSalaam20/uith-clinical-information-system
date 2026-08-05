import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { Link, useNavigate } from "react-router-dom";
import { RiEyeLine, RiEyeOffLine, RiLoginCircleLine } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../../slices/authForm/login";
import "./LoginForm.css";

const LoginForm = ({ onLoginSuccess, portalType = "staff" }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isStudentPortal = portalType === "student";
  const loginStatus = useSelector((state) => state.auth.status);

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    if (!identifier.trim() || !password) {
      setErrorMessage("Login identifier and password are required.");
      return;
    }
    try {
      const session = await dispatch(login({ username: identifier.trim(), password, portalType })).unwrap();
      onLoginSuccess?.();
      navigate(session.profile?.must_change_password ? "/change-temporary-password" : "/dashboard");
    } catch (error) {
      setErrorMessage(String(error || "Login failed. Check the account status and credentials."));
    }
  };

  return (
    <div className="login-form-wrap">
      <div className="login-context"><span>{isStudentPortal ? "Linked student health access" : "Authorized clinic workforce access"}</span><p>{isStudentPortal ? "Your portal account must be linked to your clinic patient record." : "New staff accounts are created by the clinic administrator."}</p></div>
      {errorMessage && <Alert variant="danger" role="alert">{errorMessage}</Alert>}
      <Form onSubmit={handleLogin}>
        <Form.Group className="mb-3" controlId={`login-identifier-${portalType}`}>
          <Form.Label>{isStudentPortal ? "Matriculation number or username" : "Username or email"}</Form.Label>
          <Form.Control type="text" value={identifier} placeholder={isStudentPortal ? "Enter matriculation number or username" : "Enter username or email"} autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} autoFocus />
        </Form.Group>
        <Form.Group className="mb-2" controlId={`login-password-${portalType}`}>
          <Form.Label>Password</Form.Label>
          <div className="password-input"><Form.Control type={showPassword ? "text" : "password"} value={password} placeholder="Enter password" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <RiEyeOffLine /> : <RiEyeLine />}</button></div>
        </Form.Group>
        <div className="login-help"><Link to="/forgot-password" onClick={() => onLoginSuccess?.()}>Forgot password?</Link></div>
        <Button className="w-100" type="submit" disabled={loginStatus === "loading"}>{loginStatus === "loading" ? <Spinner size="sm" /> : <RiLoginCircleLine />}{loginStatus === "loading" ? "Signing in" : `Sign in to ${isStudentPortal ? "student" : "staff"} portal`}</Button>
      </Form>
    </div>
  );
};

export default LoginForm;
