import { BASE_URL } from "./apiConfig";
import { getAccessToken, handleAuthFailure } from "./authSession";

const buildUrl = (endpoint) =>
  endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

export const apiFetch = async (endpoint, options = {}) => {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(endpoint), {
    ...options,
    headers,
  });

  if (!response.ok) {
    handleAuthFailure(response.status);
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? response.json()
    : response.text();
};
