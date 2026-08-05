export const AUTH_EXPIRED_EVENT = "uith:auth-expired";

const KEYS = {
  access: "uith.accessToken",
  refresh: "uith.refreshToken",
  username: "uith.username",
  profile: "uith.profile",
  portal: "uith.portal",
};

const legacyKeys = ["token", "refresh", "username", "id", "profile"];

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getAccessToken = () => sessionStorage.getItem(KEYS.access);
export const getRefreshToken = () => sessionStorage.getItem(KEYS.refresh);
export const getStoredProfile = () =>
  safeJsonParse(sessionStorage.getItem(KEYS.profile));

export const getStoredAuth = () => ({
  token: getAccessToken(),
  refreshToken: getRefreshToken(),
  username: sessionStorage.getItem(KEYS.username),
  profile: getStoredProfile(),
  portalType: sessionStorage.getItem(KEYS.portal),
});

export const saveAuthSession = ({
  access,
  refresh,
  username,
  profile = null,
  portalType,
}) => {
  clearStoredAuth();
  if (access) sessionStorage.setItem(KEYS.access, access);
  if (refresh) sessionStorage.setItem(KEYS.refresh, refresh);
  if (username) sessionStorage.setItem(KEYS.username, username);
  if (profile) sessionStorage.setItem(KEYS.profile, JSON.stringify(profile));
  if (portalType) sessionStorage.setItem(KEYS.portal, portalType);
};

export const updateAccessToken = (access, refresh = null) => {
  if (access) sessionStorage.setItem(KEYS.access, access);
  if (refresh) sessionStorage.setItem(KEYS.refresh, refresh);
};

export const updateStoredProfile = (profile) => {
  sessionStorage.setItem(KEYS.profile, JSON.stringify(profile));
};

export const clearStoredAuth = () => {
  Object.values(KEYS).forEach((key) => sessionStorage.removeItem(key));
  legacyKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

export const handleAuthFailure = (status) => {
  if (status !== 401) return;

  clearStoredAuth();
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { status } }));

  if (window.location.pathname !== "/") {
    window.location.assign("/");
  }
};
