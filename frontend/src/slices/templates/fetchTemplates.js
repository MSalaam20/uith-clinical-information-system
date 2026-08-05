import { createAsyncThunk } from "@reduxjs/toolkit";
import { PAGE_SIZE, TEMPLATES } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";
import { handleError } from "../../components/error/handlerError";

export const fetchTemplates = createAsyncThunk(
  "template/fetchTemplates",
  async (arg, { dispatch, rejectWithValue }) => {
    const { page, page_size = PAGE_SIZE, filters } =
      typeof arg === "object" ? arg : { page: arg, filters: {} };
    const filterParams = new URLSearchParams(filters).toString();

    try {
      return await apiFetch(
        `${TEMPLATES}?page=${page}&page_size=${page_size}&${filterParams}`
      );
    } catch (error) {
      return handleError(error, dispatch, rejectWithValue);
    }
  }
);
