import axios from "axios";
import { BASE_URL } from "./apiConfig";
import { getAccessToken, handleAuthFailure } from "./authSession";

const apiClient = axios.create({
  baseURL: BASE_URL,
});

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
  (error) => {
    handleAuthFailure(error.response?.status);
    return Promise.reject(error);
  }
);

export default apiClient;
