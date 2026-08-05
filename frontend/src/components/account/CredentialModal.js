import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { RiCheckboxCircleLine, RiFileCopyLine } from "react-icons/ri";

export default function CredentialModal({ credential, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!credential) return null;

  const copy = async () => {
    const text = `Username: ${credential.username}\nTemporary password: ${credential.temporary_password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <Modal show onHide={onClose} centered backdrop="static" className="credential-modal">
      <Modal.Header closeButton><Modal.Title>Temporary credentials</Modal.Title></Modal.Header>
      <Modal.Body>
        <Alert variant="warning">
          Share these credentials securely. The temporary password will not be displayed again after this window closes.
        </Alert>
        <dl className="credential-summary">
          <div><dt>Username</dt><dd><code>{credential.username}</code></dd></div>
          <div><dt>Temporary password</dt><dd><code>{credential.temporary_password}</code></dd></div>
        </dl>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-primary" onClick={copy}>{copied ? <RiCheckboxCircleLine /> : <RiFileCopyLine />}{copied ? "Copied" : "Copy credentials"}</Button>
        <Button onClick={onClose}>I have stored them securely</Button>
      </Modal.Footer>
    </Modal>
  );
}
