import { createAsyncThunk } from "@reduxjs/toolkit";
import { PAGE_SIZE, SCHEMAS } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";
import { handleError } from "../../components/error/handlerError";

export const fetchSchemas = createAsyncThunk(
  "schema/fetchSchemas",
  async (arg, { dispatch, rejectWithValue }) => {
    const { page, filters, page_size = PAGE_SIZE } =
      typeof arg === "object" ? arg : { page: arg, filters: {} };
    const filterParams = new URLSearchParams(filters).toString();

    try {
      return await apiFetch(
        `${SCHEMAS}?page=${page}&page_size=${page_size}&${filterParams}`
      );
    } catch (error) {
      return handleError(error, dispatch, rejectWithValue);
    }
  }
);
