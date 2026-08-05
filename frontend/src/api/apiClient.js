import axios from "axios";
import { BASE_URL, LOGIN_ENDPOINT, REFRESH_ENDPOINT } from "./apiConfig";
import {
  getAccessToken,
  getRefreshToken,
  handleAuthFailure,
  updateAccessToken,
} from "./authSession";

const apiClient = axios.create({ baseURL: BASE_URL });
const refreshClient = axios.create({ baseURL: BASE_URL });
let refreshRequest = null;

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;
    const requestUrl = originalRequest.url || "";
    const isAuthRequest =
      requestUrl.includes(LOGIN_ENDPOINT) || requestUrl.includes(REFRESH_ENDPOINT);
    const refreshToken = getRefreshToken();

    if (status === 401 && refreshToken && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      try {
        if (!refreshRequest) {
          refreshRequest = refreshClient
            .post(REFRESH_ENDPOINT, { refresh: refreshToken })
            .finally(() => {
              refreshRequest = null;
            });
        }
        const response = await refreshRequest;
        updateAccessToken(response.data.access, response.data.refresh);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        handleAuthFailure(401);
        return Promise.reject(refreshError);
      }
    }

    if (!isAuthRequest) handleAuthFailure(status);
    return Promise.reject(error);
  }
);

export default apiClient;
