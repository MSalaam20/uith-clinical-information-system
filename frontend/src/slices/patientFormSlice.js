import { createSlice } from "@reduxjs/toolkit";
import { createPatient } from "./patientForm/createPatient";
import { archivePatient } from "./patientForm/deletePatient";
import { deletePhotoPatient } from "./patientForm/deletePhotoPatient";
import { updatePatient } from "./patientForm/updatePatient";
import { loadPatient } from "./patientForm/loadPatient";

const patientFormSlice = createSlice({
  name: "patientForm",
  initialState: {
    status: "idle",
    error: null,
    showForm: false,
    formMode: "create",
    patient: null,
    loadStatus: "idle",
    loadError: null,
  },
  reducers: {
    openCreateForm: (state) => {
      state.showForm = true;
      state.formMode = "create";
      state.patient = null;
    },
    openEditForm: (state) => {
      state.showForm = true;
      state.formMode = "edit";
    },
    closeForm: (state) => {
      state.showForm = false;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(createPatient.pending, (state) => {
      state.status = "loading";
    });
    builder.addCase(createPatient.fulfilled, (state, action) => {
      state.status = "succeeded";
      state.patient = action.payload;
    });
    builder.addCase(createPatient.rejected, (state, action) => {
      state.status = "failed";
      state.error = action.error.message;
    });
    builder.addCase(loadPatient.pending, (state) => {
      state.loadStatus = "loading";
      state.loadError = null;
    });
    builder.addCase(loadPatient.fulfilled, (state, action) => {
      state.patient = action.payload;
      state.loadStatus = "succeeded";
    });
    builder.addCase(loadPatient.rejected, (state, action) => {
      state.patient = null;
      state.loadStatus = "failed";
      state.loadError = action.payload || action.error.message;
    });
    builder.addCase(updatePatient.fulfilled, (state, action) => {
      state.status = "succeeded";
      state.patient = action.payload;
    });
    builder.addCase(archivePatient.fulfilled, (state) => {
      state.status = "archived";
    });
    builder.addCase(deletePhotoPatient.fulfilled, (state, action) => {
      state.status = "deleted";
    });
    builder.addDefaultCase((state) => state);
  },
});

export const { openCreateForm, openEditForm, closeForm } = patientFormSlice.actions;
export const status = (state) => state.patientForm.status;
export default patientFormSlice.reducer;
