import type { AuthResponse } from "./types";

export type UserRole = AuthResponse["role"];

export const ADMIN_HOME_PATH = "/admin";
export const ADMIN_HR_USERS_PATH = "/admin/hr-users";
export const ADMIN_PROFILES_PATH = "/admin/assessment-profiles";
export const HR_HOME_PATH = "/dashboard";

const TOKEN_KEY = "hr_token";
const USERNAME_KEY = "hr_username";
const ROLE_KEY = "hr_role";
const IS_SUPERUSER_KEY = "hr_is_superuser";

export const getAuthToken = (): string | null => window.localStorage.getItem(TOKEN_KEY);

export const hasAuthToken = (): boolean => Boolean(getAuthToken());

export const resolveAuthRole = (auth: Pick<AuthResponse, "is_superuser" | "role">): UserRole =>
  auth.role === "admin" || auth.is_superuser ? "admin" : "hr";

export const getStoredUserRole = (): UserRole => {
  const storedRole = window.localStorage.getItem(ROLE_KEY);
  if (storedRole === "admin" || storedRole === "hr") {
    return storedRole;
  }

  return window.localStorage.getItem(IS_SUPERUSER_KEY) === "true" ? "admin" : "hr";
};

export const getHomePathForRole = (role: UserRole = getStoredUserRole()): string =>
  role === "admin" ? ADMIN_HOME_PATH : HR_HOME_PATH;

export const saveAuth = (auth: AuthResponse): UserRole => {
  const role = resolveAuthRole(auth);
  window.localStorage.setItem(TOKEN_KEY, auth.token);
  window.localStorage.setItem(USERNAME_KEY, auth.username);
  window.localStorage.setItem(ROLE_KEY, role);
  window.localStorage.setItem(IS_SUPERUSER_KEY, String(auth.is_superuser));
  return role;
};

export const clearAuth = (): void => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USERNAME_KEY);
  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(IS_SUPERUSER_KEY);
};
