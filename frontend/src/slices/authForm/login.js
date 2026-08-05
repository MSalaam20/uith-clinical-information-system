import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "../../api/apiClient";
import { handleError } from "../../components/error/handlerError";
import "react-toastify/dist/ReactToastify.css";
import { LOGIN_ENDPOINT, ME, PROFILE } from "../../api/apiConfig";

export const login = createAsyncThunk(
  "auth/login",
  async ({ username, password, portalType = "staff" }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.post(LOGIN_ENDPOINT, {
        username,
        password,
      });
      const token = response.data ? response.data.access : null;
      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("username", username);
      }
      const meResponse = await apiClient.get(ME);
      const id = meResponse.data.id;
      const profileResponse = await apiClient.get(`${PROFILE}${id}/`);
      const profile = profileResponse.data;
      if (profile) {
        localStorage.setItem("id", id);
        localStorage.setItem("profile", JSON.stringify(profile));
      }
      return { token, username, id, profile, portalType };
    } catch (error) {
      return handleError(error, dispatch, rejectWithValue);
    }
  }
);
