import apiClient from "./apiClient";
import { handleError } from "../components/error/handlerError";

const normalizeMethod = (method) => {
  if (method === "postForm") return "post";
  if (method === "putForm") return "put";
  if (method === "patchForm") return "patch";
  return method;
};

export const apiRequest = async (
  method,
  url,
  data = null,
  { dispatch, rejectWithValue } = {}
) => {
  try {
    const requestMethod = normalizeMethod(method);

    const response =
      requestMethod === "get" || requestMethod === "delete"
        ? await apiClient[requestMethod](url)
        : await apiClient[requestMethod](url, data);
    return response.data;
  } catch (error) {
    return handleError(error, dispatch, rejectWithValue);
  }
};
