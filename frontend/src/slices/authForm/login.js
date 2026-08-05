import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "../../api/apiClient";
import { LOGIN_ENDPOINT, PROFILE_ME } from "../../api/apiConfig";
import { clearStoredAuth, saveAuthSession } from "../../api/authSession";
import { handleError } from "../../components/error/handlerError";

const STAFF_ROLES = new Set(["AD", "DC", "NS", "RC", "CO"]);
const STUDENT_ROLES = new Set(["PT"]);

export const login = createAsyncThunk(
  "auth/login",
  async ({ username, password, portalType = "staff" }, thunkApi) => {
    const { dispatch, rejectWithValue } = thunkApi;
    try {
      const response = await apiClient.post(LOGIN_ENDPOINT, {
        username,
        password,
        portal_type: portalType,
      });
      const { access, refresh } = response.data;
      saveAuthSession({ access, refresh, username, portalType });

      const profileResponse = await apiClient.get(PROFILE_ME);
      const profile = profileResponse.data;
      const allowedRoles = portalType === "student" ? STUDENT_ROLES : STAFF_ROLES;
      if (!allowedRoles.has(profile.role)) {
        clearStoredAuth();
        throw new Error(
          portalType === "student"
            ? "This account belongs to clinical staff. Use the Clinical Staff Portal."
            : "This account is not authorized for the Clinical Staff Portal."
        );
      }

      saveAuthSession({ access, refresh, username, profile, portalType });
      return { token: access, refreshToken: refresh, username, profile, portalType };
    } catch (error) {
      clearStoredAuth();
      return handleError(error, dispatch, rejectWithValue);
    }
  }
);
