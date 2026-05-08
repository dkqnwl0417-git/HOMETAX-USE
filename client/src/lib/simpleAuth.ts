export type AppUser = {
  username: string;
};

const CURRENT_USER_KEY = "hometax-current-user";
const LAST_ACTIVITY_KEY = "hometax-last-activity";
const SESSION_LIMIT_MS = 3 * 60 * 60 * 1000;

export const AUTH_CHANGED_EVENT = "hometax-auth-changed";
export const OPEN_LOGIN_EVENT = "hometax-open-login";

function emitAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function getPasswordOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PASSWORD_OVERRIDES_KEY) || "{}");
  } catch {
    return {};
  }
}

function getPasswordSetupDone(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(PASSWORD_SETUP_DONE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getEffectivePassword(username: string) {
  const baseUser = LOGIN_USERS.find((user) => user.username === username);
  if (!baseUser) return null;

  const overrides = getPasswordOverrides();
  return overrides[username] || baseUser.password;
}

export function getCurrentUser(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function touchActivity() {
  if (!getCurrentUser()) return;
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function login(username: string, password: string) {
  const trimmedUsername = username.trim();
  const user = LOGIN_USERS.find((item) => item.username === trimmedUsername);

  if (!user) {
    return { success: false, message: "등록되지 않은 아이디입니다." };
  }

  const effectivePassword = getEffectivePassword(trimmedUsername);

  if (effectivePassword !== password) {
    return { success: false, message: "비밀번호가 일치하지 않습니다." };
  }

  const loginUser = { username: trimmedUsername };
  sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(loginUser));
  touchActivity();
  emitAuthChanged();

  const passwordSetupDone = getPasswordSetupDone();

  return {
    success: true,
    user: loginUser,
    isInitialPassword: effectivePassword === "1" && !passwordSetupDone[trimmedUsername],
  };
  }

export function logout() {
  sessionStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  emitAuthChanged();
}

export function updatePassword(username: string, newPassword: string) {
  const password = newPassword.trim();

  if (!password) {
    return { success: false, message: "비밀번호를 입력해주세요." };
  }

  const overrides = getPasswordOverrides();
  overrides[username] = password;
  localStorage.setItem(PASSWORD_OVERRIDES_KEY, JSON.stringify(overrides));
  
  const setupDone = getPasswordSetupDone();
  setupDone[username] = true;
  localStorage.setItem(PASSWORD_SETUP_DONE_KEY, JSON.stringify(setupDone));

  return { success: true };
}

export function requireLogin() {
  window.dispatchEvent(new Event(OPEN_LOGIN_EVENT));
}

export function initAuthActivityTracking() {
  const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];

  const handleActivity = () => {
    touchActivity();
  };

  const checkExpired = () => {
    const user = getCurrentUser();
    if (!user) return;

    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || "0");

    if (!lastActivity || Date.now() - lastActivity > SESSION_LIMIT_MS) {
      logout();
      alert("3시간 동안 작업이 없어 자동 로그아웃되었습니다.");
    }
  };

  events.forEach((eventName) => {
    window.addEventListener(eventName, handleActivity);
  });

  const timer = window.setInterval(checkExpired, 60 * 1000);

  return () => {
    events.forEach((eventName) => {
      window.removeEventListener(eventName, handleActivity);
    });
    window.clearInterval(timer);
  };
}
