export const AUTH_EXPIRED_EVENT = "uith:auth-expired";

export const getAccessToken = () => localStorage.getItem("token");

export const clearStoredAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  localStorage.removeItem("id");
  localStorage.removeItem("profile");
};

export const handleAuthFailure = (status) => {
  if (![401, 403].includes(status)) {
    return;
  }

  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { status } }));

  if (window.location.pathname !== "/") {
    window.location.assign("/");
  }
};
