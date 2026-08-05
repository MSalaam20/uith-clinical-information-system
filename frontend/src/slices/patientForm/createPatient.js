import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest } from "../../api/apiRequest";
import { PATIENTS } from "../../api/apiConfig";

export const createPatient = createAsyncThunk(
  "patientForm/createPatient",
  async (patient, { dispatch, rejectWithValue }) => {
    const formData = new FormData();
    Object.entries(patient).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        formData.append(key, value);
      }
    });
    return apiRequest("post", PATIENTS, formData, { dispatch, rejectWithValue });
  }
);
