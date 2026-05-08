export type AppUser = {
  username: string;
};

type LoginUser = {
  username: string;
  password: string;
};

// GitHub에서 계정 추가/수정/삭제는 여기만 관리하면 됩니다.
// GitHub에서 계정 추가/수정/삭제는 여기만 관리하면 됩니다.
// username = 로그인 아이디이자 등록자 이름
// password = 초기 비밀번호
//
// 계정 추가 예시:
// { username: "홍길동", password: "1" },
export const LOGIN_USERS: LoginUser[] = [
  { username: "김지웅", password: "1" },
  { username: "이영철", password: "1" },
  { username: "전열", password: "1" },
  { username: "하해인", password: "1" },
  { username: "이영수", password: "1" },
  { username: "강우영", password: "1" },
  { username: "김용휘", password: "1" },
  { username: "이건희", password: "1" },
  { username: "정성희", password: "1" },
  { username: "김지현", password: "1" },
  { username: "김도연", password: "1" },
  { username: "권은진", password: "1" },
  { username: "문영숙", password: "1" },
  { username: "빈나리", password: "1" },
  { username: "이성봉", password: "1" },
  { username: "조은진", password: "1" },
  { username: "장혜연", password: "1" },
  { username: "이은수", password: "1" },
  { username: "지동근", password: "1" },
  { username: "이태호", password: "1" },
  { username: "김명순", password: "1" },
  { username: "우가영", password: "1" },
  { username: "이하연", password: "1" },
  { username: "이준원", password: "1" },
  { username: "장지훈", password: "1" },
  { username: "노동현", password: "1" },
  { username: "박현욱", password: "1" },
  { username: "이지수", password: "1" },
  { username: "강주은", password: "1" },
  { username: "이수빈", password: "1" },
];

const CURRENT_USER_KEY = "hometax-current-user";
const PASSWORD_OVERRIDES_KEY = "hometax-password-overrides";
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

  return {
    success: true,
    user: loginUser,
    isInitialPassword: effectivePassword === "1",
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
