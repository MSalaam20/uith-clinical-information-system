import {
  clearStoredAuth,
  getStoredAuth,
  saveAuthSession,
} from "./authSession";

describe("auth session storage", () => {
  afterEach(() => clearStoredAuth());

  test("stores a complete session in sessionStorage", () => {
    saveAuthSession({
      access: "access-token",
      refresh: "refresh-token",
      username: "doctor",
      profile: { role: "DC" },
      portalType: "staff",
    });

    expect(getStoredAuth()).toEqual({
      token: "access-token",
      refreshToken: "refresh-token",
      username: "doctor",
      profile: { role: "DC" },
      portalType: "staff",
    });
  });

  test("logout cleanup removes current and legacy values", () => {
    localStorage.setItem("token", "legacy-token");
    saveAuthSession({ access: "access-token", refresh: "refresh-token" });
    clearStoredAuth();

    expect(getStoredAuth().token).toBeNull();
    expect(getStoredAuth().refreshToken).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
