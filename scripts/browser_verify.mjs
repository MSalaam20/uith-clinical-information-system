import fs from "node:fs/promises";
import path from "node:path";

const FRONTEND = process.env.EHR_FRONTEND_URL || "http://127.0.0.1:3001";
const CDP = process.env.EHR_CDP_URL || "http://127.0.0.1:9223";
const PASSWORD = process.env.EHR_BROWSER_PASSWORD;
const ROOT = process.cwd();
const SCREENSHOTS = path.join(ROOT, "docs", "screenshots");
const REPORT = path.join(ROOT, "docs", "BROWSER_VERIFICATION.json");
const TARGET_REASON = "Browser verified complete workflow";

if (!PASSWORD) throw new Error("EHR_BROWSER_PASSWORD is required.");

class DevTools {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const handler = this.pending.get(message.id);
      if (!handler) return;
      this.pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    });
  }

  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const output = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (output.exceptionDetails) {
      throw new Error(output.exceptionDetails.exception?.description || output.exceptionDetails.text);
    }
    return output.result.value;
  }
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const quote = (value) => JSON.stringify(value);

async function connect() {
  const targets = await (await fetch(`${CDP}/json/list`)).json();
  const target = targets.find((item) => item.type === "page");
  if (!target) throw new Error("No Edge page target is available.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const tools = new DevTools(socket);
  await tools.call("Page.enable");
  await tools.call("Runtime.enable");
  return tools;
}

const visibleElementExpression = `
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const normalized = (value) => String(value || "").replace(/\\s+/g, " ").trim();
`;

async function waitFor(tools, expression, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await tools.evaluate(expression)) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
}

async function navigate(tools, route) {
  await tools.call("Page.navigate", { url: `${FRONTEND}${route}` });
  await waitFor(tools, `document.readyState === "complete"`, `page ${route}`);
  await sleep(450);
}

async function waitText(tools, text, timeout = 15000) {
  await waitFor(
    tools,
    `document.body && document.body.innerText.includes(${quote(text)})`,
    `text ${text}`,
    timeout,
  );
}

async function bodyText(tools) {
  return tools.evaluate("document.body ? document.body.innerText : ''");
}

async function clickText(tools, text, selector = "button, a") {
  const clicked = await tools.evaluate(`(() => {
    ${visibleElementExpression}
    const wanted = normalized(${quote(text)}).toLowerCase();
    const candidates = [...document.querySelectorAll(${quote(selector)})].filter(visible);
    const element = candidates.find((item) => normalized(item.innerText).toLowerCase() === wanted)
      || candidates.find((item) => normalized(item.innerText).toLowerCase().includes(wanted));
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Visible control not found: ${text}`);
  await sleep(250);
}

async function setField(tools, label, value) {
  const changed = await tools.evaluate(`(() => {
    ${visibleElementExpression}
    const wanted = normalized(${quote(label)}).toLowerCase();
    const labels = [...document.querySelectorAll("label")].filter(visible);
    const fieldLabel = labels.find((item) => normalized(item.innerText).toLowerCase() === wanted)
      || labels.find((item) => normalized(item.innerText).toLowerCase().includes(wanted));
    if (!fieldLabel) return false;
    const element = (fieldLabel.htmlFor && document.getElementById(fieldLabel.htmlFor))
      || fieldLabel.parentElement.querySelector("input, textarea, select");
    if (!element) return false;
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    setter.call(element, ${quote(value)});
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error(`Field not found: ${label}`);
  await sleep(100);
}

async function selectOption(tools, label, optionText) {
  const changed = await tools.evaluate(`(() => {
    ${visibleElementExpression}
    const wanted = normalized(${quote(label)}).toLowerCase();
    const labels = [...document.querySelectorAll("label")].filter(visible);
    const fieldLabel = labels.find((item) => normalized(item.innerText).toLowerCase() === wanted)
      || labels.find((item) => normalized(item.innerText).toLowerCase().includes(wanted));
    if (!fieldLabel) return false;
    const linked = fieldLabel.htmlFor && document.getElementById(fieldLabel.htmlFor);
    const element = linked instanceof HTMLSelectElement ? linked : fieldLabel.parentElement.querySelector("select");
    if (!element) return false;
    const optionWanted = normalized(${quote(optionText)}).toLowerCase();
    const option = [...element.options].find((item) => normalized(item.text).toLowerCase().includes(optionWanted));
    if (!option) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(element, option.value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error(`Option not found: ${optionText} in ${label}`);
  await sleep(100);
}

async function setCheckbox(tools, label, checked = true) {
  const changed = await tools.evaluate(`(() => {
    ${visibleElementExpression}
    const wanted = normalized(${quote(label)}).toLowerCase();
    const fieldLabel = [...document.querySelectorAll("label")].find((item) => visible(item) && normalized(item.innerText).toLowerCase().includes(wanted));
    if (!fieldLabel) return false;
    const element = (fieldLabel.htmlFor && document.getElementById(fieldLabel.htmlFor)) || fieldLabel.parentElement.querySelector("input");
    if (!element) return false;
    if (element.checked !== ${checked}) element.click();
    return true;
  })()`);
  if (!changed) throw new Error(`Checkbox not found: ${label}`);
}

async function setViewport(tools, width, height) {
  await tools.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await sleep(200);
}

async function screenshot(tools, name) {
  const output = await tools.call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await fs.writeFile(path.join(SCREENSHOTS, name), Buffer.from(output.data, "base64"));
}

async function assertContains(tools, values) {
  const text = await bodyText(tools);
  for (const value of values) {
    if (!text.includes(value)) throw new Error(`Expected visible text is missing: ${value}`);
  }
}

async function assertExcludes(tools, values) {
  const text = await bodyText(tools);
  for (const value of values) {
    if (text.includes(value)) throw new Error(`Forbidden visible text is present: ${value}`);
  }
}

async function assertResponsive(tools, role, checks) {
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await setViewport(tools, width, width < 768 ? 844 : 900);
    const overflow = await tools.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
    checks.push({ step: `${role} responsive ${width}px`, passed: !overflow });
    if (overflow) throw new Error(`${role} dashboard overflows horizontally at ${width}px.`);
  }
  await setViewport(tools, 1440, 900);
}

async function login(tools, portal, username) {
  await navigate(tools, "/");
  await tools.evaluate("localStorage.clear(); sessionStorage.clear(); true");
  await tools.call("Page.reload", { ignoreCache: true });
  await waitText(tools, "UITH School Complex Clinic");
  await tools.evaluate(`window.dispatchEvent(new CustomEvent("uith:open-login", { detail: { portalType: ${quote(portal)} } })); true`);
  await waitText(tools, portal === "student" ? "Student Patient Portal" : "Clinical Staff Portal");
  await setField(tools, portal === "student" ? "Matriculation number or username" : "Username or email", username);
  await setField(tools, "Password", PASSWORD);
  await clickText(tools, portal === "student" ? "Sign in to student portal" : "Sign in to staff portal");
  await waitText(tools, "Sign out", 20000);
}

async function logout(tools) {
  await clickText(tools, "Sign out");
  await waitText(tools, "Staff portal");
}

async function forbiddenRoute(tools, route) {
  await navigate(tools, route);
  await waitText(tools, "Access not available");
}

async function main() {
  await fs.mkdir(SCREENSHOTS, { recursive: true });
  const checks = [];
  const tools = await connect();
  await setViewport(tools, 1440, 900);

  const record = async (step, work) => {
    try {
      await work();
      checks.push({ step, passed: true });
      console.log(`PASS: ${step}`);
    } catch (error) {
      checks.push({ step, passed: false, error: error.message });
      throw error;
    }
  };

  await record("Doctor-in-Charge login and full navigation", async () => {
    await login(tools, "staff", "doctor.in.charge");
    await navigate(tools, "/dashboard");
    await waitText(tools, "Doctor-in-Charge / Clinic Administrator dashboard");
    await assertContains(tools, ["Clinic Overview", "Staff Management", "Audit Logs", "System Overview"]);
    await assertResponsive(tools, "Doctor-in-Charge", checks);
    await screenshot(tools, "doctor-in-charge-dashboard.png");
    await navigate(tools, "/staff");
    await waitText(tools, "Staff");
    await navigate(tools, "/audit-logs");
    await waitText(tools, "Audit");
    await logout(tools);
  });

  await record("Receptionist creates and submits intake", async () => {
    await login(tools, "staff", "mr.ibrahim");
    await navigate(tools, "/dashboard");
    await waitText(tools, "Receptionist dashboard");
    await assertContains(tools, ["New Intake", "Student Directory", "Today's Intakes"]);
    await assertExcludes(tools, ["Staff Management", "Audit Logs", "ICD-11"]);
    await assertResponsive(tools, "Receptionist", checks);
    await screenshot(tools, "receptionist-dashboard.png");
    await navigate(tools, "/reception/intakes");
    await waitText(tools, "Today's clinic intakes");
    if (!(await bodyText(tools)).includes(TARGET_REASON)) {
      await navigate(tools, "/reception/intake");
      await waitText(tools, "Create clinic intake");
      await waitFor(tools, "[...document.querySelectorAll('option')].some((item) => item.innerText.includes('Amina Sulaiman'))", "Amina student option");
      await selectOption(tools, "Student patient", "Amina Sulaiman");
      await setField(tools, "Reason for visit", TARGET_REASON);
      await setField(tools, "Presenting Complaint as Reported by Student", "Student reports a recurring headache during browser verification.");
      await clickText(tools, "Create and Send to Nurse");
      await waitText(tools, "Intake sent to nursing", 20000);
    }
    await forbiddenRoute(tools, "/staff");
    await logout(tools);
  });

  await record("Student sees sent-to-nurse status and ownership guard", async () => {
    await login(tools, "student", "uith_2021_52HL034");
    await waitFor(tools, `document.body.innerText.includes(${quote(TARGET_REASON)})`, "student care request", 20000);
    await assertExcludes(tools, ["Staff Management", "Audit Logs", "Student Directory"]);
    await assertResponsive(tools, "Student", checks);
    if ((await bodyText(tools)).includes("Your information has been sent to the nurse.")) {
      await screenshot(tools, "student-care-journey-sent.png");
    }
    await forbiddenRoute(tools, "/patients/2");
    await logout(tools);
  });

  await record("Nurse reviews, assigns doctor and schedules appointment", async () => {
    await login(tools, "staff", "nurse.fatima");
    await waitText(tools, "Intake and scheduling queue", 20000);
    await assertContains(tools, ["Intake Queue", "Appointments"]);
    await assertExcludes(tools, ["Patients", "ICD-11", "Staff Management", "Audit Logs"]);
    await waitText(tools, TARGET_REASON, 20000);
    const nurseCardText = await tools.evaluate(`([...document.querySelectorAll(".intake-card")].find((item) => item.innerText.includes(${quote(TARGET_REASON)})) || {}).innerText || ""`);
    if (!["Waiting for doctor", "Doctor confirmed", "In consultation", "Completed", "Follow-up required"].some((status) => nurseCardText.includes(status))) {
      if (nurseCardText.includes("Begin Review")) {
        await clickText(tools, "Begin Review");
      }
      await waitText(tools, "Schedule Appointment", 20000);
      const scheduleFormOpen = await tools.evaluate(`[...document.querySelectorAll("label")].some((item) => item.innerText.includes("Available doctor"))`);
      if (!scheduleFormOpen) await clickText(tools, "Schedule Appointment");
      await waitFor(tools, `[...document.querySelectorAll("label")].some((item) => item.innerText.includes("Available doctor"))`, "nurse scheduling form");
      await selectOption(tools, "Available doctor", "Jeremiah");
      const scheduledFor = new Date(Date.now() + 2 * 60 * 60 * 1000);
      scheduledFor.setMinutes(scheduledFor.getMinutes() - scheduledFor.getTimezoneOffset());
      await setField(tools, "Date and time", scheduledFor.toISOString().slice(0, 16));
      await setField(tools, "Scheduling note", "Browser verified nursing assignment.");
      await clickText(tools, "Save Appointment");
      await waitText(tools, "Waiting for doctor", 20000);
    }
    await assertResponsive(tools, "Nurse", checks);
    await screenshot(tools, "nurse-queue.png");
    await forbiddenRoute(tools, "/patients");
    await logout(tools);
  });

  await record("Student sees scheduled appointment", async () => {
    await login(tools, "student", "uith_2021_52HL034");
    await waitFor(tools, `document.body.innerText.includes(${quote(TARGET_REASON)}) && document.body.innerText.includes("Jeremiah Adebayo")`, "student appointment details", 20000);
    await assertContains(tools, ["Jeremiah Adebayo", TARGET_REASON]);
    await logout(tools);
  });

  await record("Doctor confirms, documents and completes consultation", async () => {
    await login(tools, "staff", "dr.jeremiah");
    await waitText(tools, "My consultation queue", 20000);
    await waitText(tools, TARGET_REASON, 20000);
    await assertContains(tools, ["My Queue", "My Appointments", "ICD-11"]);
    await assertExcludes(tools, ["Staff Management", "Audit Logs"]);
    const doctorCardText = await tools.evaluate(`([...document.querySelectorAll(".intake-card")].find((item) => item.innerText.includes(${quote(TARGET_REASON)})) || {}).innerText || ""`);
    const targetIsTerminal = ["Completed", "Follow-up required"].some((status) => doctorCardText.includes(status));
    await assertResponsive(tools, "Doctor", checks);
    await screenshot(tools, "doctor-queue.png");
    if (!targetIsTerminal) {
      if (doctorCardText.includes("Confirm Appointment")) {
        await clickText(tools, "Confirm Appointment");
        await waitText(tools, "Start Consultation", 20000);
      }
      if ((await bodyText(tools)).includes("Start Consultation")) {
        await clickText(tools, "Start Consultation");
      }
      await waitText(tools, "Open Clinical Workspace", 20000);
      await clickText(tools, "Open Clinical Workspace");
      await waitText(tools, "2021/52HL034", 20000);
      await clickText(tools, "Visits", "a, button");
      await waitText(tools, "Add note");

      if (!(await bodyText(tools)).includes("Synthetic browser-verified progress note")) {
        await clickText(tools, "Add note");
        await waitText(tools, "Clinical note");
        await setField(tools, "Clinical note", "Synthetic browser-verified progress note. Student is alert and stable.");
        await setCheckbox(tools, "Visible in the student patient portal", true);
        await clickText(tools, "Save note");
        await waitFor(tools, "![...document.querySelectorAll('.modal.show')].length", "note modal to close", 20000);
      }

      if (!(await bodyText(tools)).includes("Synthetic browser-verified headache assessment")) {
        await clickText(tools, "Add diagnosis");
        await setField(tools, "ICD-11 code or diagnosis", "headache");
        await waitText(tools, "9C83", 10000);
        await clickText(tools, "9C83");
        await setField(tools, "Description", "Synthetic browser-verified headache assessment");
        await clickText(tools, "Save diagnosis");
        await waitFor(tools, "![...document.querySelectorAll('.modal.show')].length", "diagnosis modal to close", 20000);
      }

      if ((await bodyText(tools)).includes("No prescriptions for this visit.")) {
        await clickText(tools, "Prescribe");
        await waitFor(tools, "[...document.querySelectorAll('option')].some((item) => item.innerText.includes('Paracetamol'))", "medication catalogue", 15000);
        await selectOption(tools, "Medication", "Paracetamol");
        await setField(tools, "Dose", "500 mg");
        await setField(tools, "Frequency", "Twice daily");
        await setField(tools, "Duration", "3 days");
        await setField(tools, "Instructions", "Take after meals.");
        await clickText(tools, "Add item");
        await clickText(tools, "Save prescription");
        await waitFor(tools, "![...document.querySelectorAll('.modal.show')].length", "prescription modal to close", 20000);
      }

      await navigate(tools, "/doctor-queue");
      await waitText(tools, "Complete Consultation", 20000);
      await clickText(tools, "Complete Consultation");
      await setField(tools, "Approved visit summary", "Browser-verified consultation completed; student was stable and received treatment advice.");
      await setField(tools, "Follow-up instructions", "Return to clinic if symptoms persist after three days.");
      await clickText(tools, "Mark Consultation Complete");
      await waitText(tools, "Follow-up required", 20000);
    }
    await forbiddenRoute(tools, "/staff");
    await forbiddenRoute(tools, "/audit-logs");
    await logout(tools);
  });

  await record("Student sees completed care and approved prescription", async () => {
    await login(tools, "student", "uith_2021_52HL034");
    await waitFor(tools, `document.body.innerText.includes("This clinic visit has been completed.") || document.body.innerText.includes("A follow-up visit has been recommended.")`, "completed student care state", 20000);
    await assertContains(tools, ["Browser-verified consultation completed", "Paracetamol", "Return to clinic if symptoms persist"]);
    await screenshot(tools, "student-care-journey-completed.png");
    await logout(tools);
  });

  await record("Repeat intake reuses student account and patient", async () => {
    await login(tools, "staff", "mr.ibrahim");
    await navigate(tools, "/reception/intakes");
    await waitText(tools, "Today's clinic intakes");
    if (!(await bodyText(tools)).includes("Browser verified repeat intake")) {
      await navigate(tools, "/reception/intake");
      await waitFor(tools, "[...document.querySelectorAll('option')].some((item) => item.innerText.includes('Amina Sulaiman'))", "repeat student option");
      await selectOption(tools, "Student patient", "Amina Sulaiman");
      await setField(tools, "Reason for visit", "Browser verified repeat intake");
      await setField(tools, "Presenting Complaint as Reported by Student", "Student returned for a separate synthetic follow-up request.");
      await clickText(tools, "Create and Send to Nurse");
      await waitText(tools, "Intake sent to nursing", 20000);
    }
    await logout(tools);
  });

  await record("Landing page desktop and mobile visual checks", async () => {
    await setViewport(tools, 1440, 1000);
    await navigate(tools, "/");
    await waitText(tools, "How Care Moves Through the Clinic");
    await tools.evaluate("document.querySelector('#workflow').scrollIntoView({ block: 'start' }); true");
    await sleep(500);
    await screenshot(tools, "landing-workflow-desktop.png");
    await setViewport(tools, 390, 844);
    await navigate(tools, "/");
    const overflow = await tools.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
    if (overflow) throw new Error("Mobile landing page overflows horizontally at 390px.");
    await screenshot(tools, "landing-mobile.png");
  });

  await fs.writeFile(REPORT, `${JSON.stringify({ generated_at: new Date().toISOString(), frontend: FRONTEND, checks }, null, 2)}\n`);
  console.log(JSON.stringify({ passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length, report: REPORT }));
  tools.socket.close();
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
