import { createAsyncThunk } from "@reduxjs/toolkit";
import "react-toastify/dist/ReactToastify.css";
import { handleError } from "../../components/error/handlerError";
import { clearStoredAuth } from "../../api/authSession";

export const logout = createAsyncThunk(
  "auth/logout",
  (_, { dispatch, rejectWithValue }) => {
    try {
      clearStoredAuth();
      return {};
    } catch (error) {
      return handleError(error, dispatch, rejectWithValue);
    }
  }
);
