import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { RiArrowLeftLine, RiLockPasswordLine, RiMailSendLine } from "react-icons/ri";
import { toast } from "react-toastify";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { logout } from "../../slices/authForm/logout";
import "./PasswordPages.css";

const PasswordField = ({ label, name, value, onChange, error, autoComplete }) => (
  <Form.Group className="mb-3" controlId={name}>
    <Form.Label>{label}</Form.Label>
    <Form.Control type="password" name={name} value={value} onChange={onChange} isInvalid={Boolean(error)} autoComplete={autoComplete} required />
    {error && <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>}
  </Form.Group>
);

export function ChangePasswordPage({ temporary = false }) {
  const [values, setValues] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setFields({});
    setError("");
    if (values.new_password !== values.confirm_password) {
      setFields({ confirm_password: "The password confirmation does not match." });
      return;
    }
    setLoading(true);
    try {
      await clinicalApi.changePassword(values);
      await dispatch(logout());
      toast.success("Password changed. Sign in again with your new password.");
      navigate("/", { replace: true });
    } catch (requestError) {
      const parsed = apiError(requestError, "The password could not be changed.");
      setFields(parsed.fields);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`account-page ${temporary ? "temporary-password-page" : ""}`}>
      <section className="account-panel">
        <div className="account-icon"><RiLockPasswordLine /></div>
        <span className="eyebrow">Account security</span>
        <h1>{temporary ? "Create your permanent password" : "Change password"}</h1>
        <p>{temporary ? "Your temporary credential worked. Choose a private password before entering the clinic portal." : "Changing your password signs out existing sessions on this account."}</p>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form onSubmit={submit} noValidate>
          <PasswordField label="Current password" name="current_password" value={values.current_password} onChange={change} error={fields.current_password} autoComplete="current-password" />
          <PasswordField label="New password" name="new_password" value={values.new_password} onChange={change} error={fields.new_password} autoComplete="new-password" />
          <PasswordField label="Confirm new password" name="confirm_password" value={values.confirm_password} onChange={change} error={fields.confirm_password} autoComplete="new-password" />
          <p className="password-guidance">Use at least 6 characters. Words, numbers or a memorable phrase are accepted.</p>
          <Button type="submit" className="w-100" disabled={loading}>{loading && <Spinner size="sm" />}{loading ? "Updating password" : "Update password"}</Button>
        </Form>
      </section>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [portalType, setPortalType] = useState("staff");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await clinicalApi.requestPasswordReset({ email, portal_type: portalType });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="account-page public-account-page"><section className="account-panel">
      <div className="account-icon"><RiMailSendLine /></div>
      <span className="eyebrow">Account recovery</span><h1>Reset your password</h1>
      {sent ? <Alert variant="success">If an active account matches that email address, a password-reset link has been sent.</Alert> : <><p>Enter the email address registered on your clinic portal account.</p><Form onSubmit={submit}>
        <Form.Group className="mb-3" controlId="reset-portal"><Form.Label>Portal</Form.Label><Form.Select value={portalType} onChange={(event) => setPortalType(event.target.value)}><option value="staff">Clinical Staff Portal</option><option value="student">Student Patient Portal</option></Form.Select></Form.Group>
        <Form.Group className="mb-3" controlId="reset-email"><Form.Label>Email address</Form.Label><Form.Control type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></Form.Group>
        <Button type="submit" className="w-100" disabled={loading}>{loading && <Spinner size="sm" />}{loading ? "Sending" : "Send reset link"}</Button>
      </Form></>}
      <Link className="account-back-link" to="/"><RiArrowLeftLine /> Return to clinic home</Link>
    </section></main>
  );
}

export function ResetPasswordPage() {
  const { uid, token } = useParams();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState({ new_password: "", confirm_password: "" });
  const [fields, setFields] = useState({});
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (values.new_password !== values.confirm_password) {
      setFields({ confirm_password: "The password confirmation does not match." });
      return;
    }
    setLoading(true);
    setFields({});
    try {
      await clinicalApi.confirmPasswordReset({ uid, token, ...values });
      setComplete(true);
    } catch (requestError) {
      setFields(apiError(requestError, "This reset link could not be used.").fields);
    } finally {
      setLoading(false);
    }
  };
  return <main className="account-page public-account-page"><section className="account-panel"><div className="account-icon"><RiLockPasswordLine /></div><span className="eyebrow">Secure reset</span><h1>Choose a new password</h1>{complete ? <><Alert variant="success">Your password has been reset. You can now sign in through the {searchParams.get("portal") === "student" ? "Student Patient" : "Clinical Staff"} Portal.</Alert><Button as={Link} to="/" className="w-100">Return to sign in</Button></> : <Form onSubmit={submit}><PasswordField label="New password" name="new_password" value={values.new_password} onChange={change} error={fields.new_password || fields.token || fields.uid} autoComplete="new-password" /><PasswordField label="Confirm new password" name="confirm_password" value={values.confirm_password} onChange={change} error={fields.confirm_password} autoComplete="new-password" /><Button type="submit" className="w-100" disabled={loading}>{loading && <Spinner size="sm" />}{loading ? "Resetting" : "Reset password"}</Button></Form>}</section></main>;
}
