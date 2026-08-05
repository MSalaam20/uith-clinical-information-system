import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PAGE_SIZE, RECORDS } from "../api/apiConfig";
import { apiFetch } from "../api/apiFetch";
import { handleError } from "../components/error/handlerError";

export const fetchRecords = createAsyncThunk(
  "records/fetchRecords",
  async (arg, { dispatch, rejectWithValue }) => {
    const { page, filters, patient_id } =
      typeof arg === "object"
        ? arg
        : { page: arg, filters: {}, patient_id: null };
    const filterParams = new URLSearchParams(filters).toString();

    try {
      return await apiFetch(
        `${RECORDS}?patient_id=${patient_id}&page=${page}&page_size=${PAGE_SIZE}&${filterParams}`
      );
    } catch (error) {
      return handleError(error, dispatch, rejectWithValue);
    }
  }
);

export const recordsSlice = createSlice({
  name: "records",
  initialState: { records: [], totalPages: 0, currentPage: 1 },
  reducers: {
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchRecords.fulfilled, (state, action) => {
      state.records = action.payload.results;
      state.totalPages = Math.ceil(action.payload.count / PAGE_SIZE);
    });
  },
});

export const { setCurrentPage } = recordsSlice.actions;
export default recordsSlice.reducer;
