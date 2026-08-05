import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest } from "../../api/apiRequest";
import { PATIENTS } from "../../api/apiConfig";

export const archivePatient = createAsyncThunk(
  "patientForm/archivePatient",
  async ({ patientId, reason }, { dispatch, rejectWithValue }) => {
    return apiRequest(
      "post",
      `${PATIENTS}${patientId}/archive/`,
      { reason },
      { dispatch, rejectWithValue }
    );
  }
);
