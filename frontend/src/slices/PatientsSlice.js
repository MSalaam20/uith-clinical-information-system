import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PAGE_SIZE, PATIENTS } from "../api/apiConfig";
import { apiFetch } from "../api/apiFetch";
import { handleError } from "../components/error/handlerError";

export const fetchPatients = createAsyncThunk(
  "patients/fetchPatients",
  async (arg, { dispatch, rejectWithValue }) => {
    const { page, filters } =
      typeof arg === "object" ? arg : { page: arg, filters: {} };
    const filterParams = new URLSearchParams(filters).toString();

    try {
      return await apiFetch(
        `${PATIENTS}?page=${page}&page_size=${PAGE_SIZE}&${filterParams}`
      );
    } catch (error) {
      return handleError(error, dispatch, rejectWithValue);
    }
  }
);

export const patientsSlice = createSlice({
  name: "patients",
  initialState: { patients: [], totalPages: 0, currentPage: 1 },
  reducers: {
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchPatients.fulfilled, (state, action) => {
      state.patients = action.payload.results;
      state.totalPages = Math.ceil(action.payload.count / PAGE_SIZE);
    });
  },
});

export const { setCurrentPage } = patientsSlice.actions;
export default patientsSlice.reducer;
