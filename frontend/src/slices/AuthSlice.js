import { createSlice } from "@reduxjs/toolkit";
import "react-toastify/dist/ReactToastify.css";
import { login } from "./authForm/login";
import { logout } from "./authForm/logout";
import { getStoredAuth } from "../api/authSession";

const storedAuth = getStoredAuth();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    isAuthenticated: Boolean(storedAuth.token && storedAuth.profile),
    token: storedAuth.token,
    refreshToken: storedAuth.refreshToken,
    username: storedAuth.username,
    profile: storedAuth.profile,
    portalType: storedAuth.portalType,
    status: "idle",
  },
  reducers: {
    authSessionExpired: (state) => {
      state.isAuthenticated = false;
      state.token = null;
      state.username = null;
      state.refreshToken = null;
      state.profile = null;
      state.portalType = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(login.fulfilled, (state, action) => {
      state.isAuthenticated = true;
      state.token = action.payload.token;
      state.username = action.payload.username;
      state.refreshToken = action.payload.refreshToken;
      state.profile = action.payload.profile;
      state.portalType = action.payload.portalType;
      state.status = "succeeded";
    });
    builder.addCase(login.pending, (state) => {
      state.status = "loading";
    });
    builder.addCase(login.rejected, (state) => {
      state.isAuthenticated = false;
      state.token = null;
      state.refreshToken = null;
      state.profile = null;
      state.portalType = null;
      state.status = "failed";
    });
    builder.addCase(logout.fulfilled, (state) => {
      state.isAuthenticated = false;
      state.token = null;
      state.username = null;
      state.refreshToken = null;
      state.profile = null;
      state.portalType = null;
      state.status = "idle";
    });
  },
});

export const { authSessionExpired } = authSlice.actions;
export const token = (state) => state.auth.token;
export const isAuthenticated = (state) => state.auth.isAuthenticated;
export const username = (state) => state.auth.username;
export const me = (state) => state.auth.me;
export const profile = (state) => state.auth.profile;
export default authSlice.reducer;
