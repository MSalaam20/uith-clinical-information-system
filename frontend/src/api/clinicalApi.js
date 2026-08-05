import apiClient from "./apiClient";
import {
  APPOINTMENTS,
  AUDIT_LOGS,
  CLINICAL_NOTES,
  DIAGNOSES,
  ICD_CODES,
  MEDICATIONS,
  PRESCRIPTIONS,
  RECORDS,
  SCHEMAS,
  STAFF,
  TEMPLATES,
  VISITS,
  VITAL_SIGNS,
} from "./apiConfig";

const collection = (data) => (Array.isArray(data) ? data : data.results || []);

const queryString = (values = {}) => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      query.set(key, value);
    }
  });
  const output = query.toString();
  return output ? `?${output}` : "";
};

const list = async (endpoint, params) => {
  const response = await apiClient.get(`${endpoint}${queryString(params)}`);
  return {
    items: collection(response.data),
    count: response.data.count ?? collection(response.data).length,
    next: response.data.next || null,
    previous: response.data.previous || null,
  };
};

const create = async (endpoint, payload) => {
  const response = await apiClient.post(endpoint, payload);
  return response.data;
};

const update = async (endpoint, id, payload) => {
  const response = await apiClient.patch(`${endpoint}${id}/`, payload);
  return response.data;
};

const retrieve = async (endpoint, id) => {
  const response = await apiClient.get(`${endpoint}${id}/`);
  return response.data;
};

export const apiError = (error, fallback = "The request could not be completed.") => {
  const data = error.response?.data;
  if (typeof data === "string") return { message: data, fields: {} };
  if (!data || typeof data !== "object") {
    return { message: error.message || fallback, fields: {} };
  }
  const fields = {};
  Object.entries(data).forEach(([key, value]) => {
    fields[key] = Array.isArray(value) ? value.join(" ") : String(value);
  });
  return {
    message: fields.detail || fields.non_field_errors || fallback,
    fields,
  };
};

export const clinicalApi = {
  getPatientWorkspace: async (patientId) => {
    const common = { patient_id: patientId, page_size: 100 };
    const [visits, vitals, notes, diagnoses, prescriptions, appointments, records] =
      await Promise.all([
        list(VISITS, { ...common, ordering: "-visit_date" }),
        list(VITAL_SIGNS, { ...common, ordering: "-measured_at" }),
        list(CLINICAL_NOTES, { ...common, ordering: "-created_at" }),
        list(DIAGNOSES, { ...common, ordering: "-created_at" }),
        list(PRESCRIPTIONS, { ...common, ordering: "-prescribed_at" }),
        list(APPOINTMENTS, {
          patient: patientId,
          page_size: 100,
          ordering: "-scheduled_for",
        }),
        list(RECORDS, { patient_id: patientId, page_size: 100 }),
      ]);
    return { visits, vitals, notes, diagnoses, prescriptions, appointments, records };
  },
  createVisit: (payload) => create(VISITS, payload),
  updateVisit: (id, payload) => update(VISITS, id, payload),
  createVitalSign: (payload) => create(VITAL_SIGNS, payload),
  createClinicalNote: (payload) => create(CLINICAL_NOTES, payload),
  updateClinicalNote: (id, payload) => update(CLINICAL_NOTES, id, payload),
  createDiagnosis: (payload) => create(DIAGNOSES, payload),
  listIcdCodes: (search = "") => list(ICD_CODES, {
    search,
    page_size: 50,
    ordering: "code",
  }),
  listMedications: (search = "") => list(MEDICATIONS, {
    search,
    is_active: true,
    page_size: 100,
    ordering: "name",
  }),
  createMedication: (payload) => create(MEDICATIONS, payload),
  createPrescription: (payload) => create(PRESCRIPTIONS, payload),
  listSchemas: () => list(SCHEMAS, { page_size: 100 }),
  getSchema: (id) => retrieve(SCHEMAS, id),
  listTemplates: (schemaId) => list(TEMPLATES, {
    findings_schema: schemaId,
    page_size: 100,
  }),
  getTemplate: (id) => retrieve(TEMPLATES, id),
  createLegacyRecord: (payload) => create(RECORDS, payload),
  updateAppointment: (id, payload) => update(APPOINTMENTS, id, payload),
  updateAppointmentStatus: async (id, status) => {
    const response = await apiClient.patch(`${APPOINTMENTS}${id}/status/`, { status });
    return response.data;
  },
  cancelAppointment: async (id) => {
    const response = await apiClient.post(`${APPOINTMENTS}${id}/cancel/`);
    return response.data;
  },
  listStaff: (params) => list(STAFF, { page_size: 15, ...params }),
  updateStaffRole: async (id, role) => {
    const response = await apiClient.patch(`${STAFF}${id}/role/`, { role });
    return response.data;
  },
  updateStaffStatus: async (id, isActive) => {
    const response = await apiClient.patch(`${STAFF}${id}/status/`, {
      is_active: isActive,
    });
    return response.data;
  },
  listAuditLogs: (params) => list(AUDIT_LOGS, { page_size: 15, ...params }),
};
