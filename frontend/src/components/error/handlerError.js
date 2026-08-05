import { toast } from "react-toastify";
import { setError } from "../../slices/errorSlice";

export async function handleError(error, dispatch, rejectWithValue) {
  const message =
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.message ||
    "Request failed";

  if (dispatch) {
    dispatch(setError(message));
  }

  toast.error(`Error: ${message}`);

  if (rejectWithValue) {
    return rejectWithValue(message);
  }

  throw error;
}
