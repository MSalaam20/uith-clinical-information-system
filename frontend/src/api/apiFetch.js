import apiClient from "./apiClient";

export const apiFetch = async (endpoint, options = {}) => {
  const headers = options.headers instanceof Headers
    ? Object.fromEntries(options.headers.entries())
    : options.headers;
  const response = await apiClient.request({
    url: endpoint,
    method: options.method || "GET",
    data: options.body,
    headers,
  });
  return response.data;
};
