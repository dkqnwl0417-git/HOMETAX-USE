export type AppUser = {
  username: string;
  role?: "admin" | "user";
};

const CURRENT_USER_KEY = "hometax-current-user";
const LAST_ACTIVITY_KEY = "hometax-last-activity";
const SESSION_LIMIT_MS = 3 * 60 * 60 * 1000;

export const AUTH_CHANGED_EVENT = "hometax-auth-changed";
export const OPEN_LOGIN_EVENT = "hometax-open-login";

function emitAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
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

export async function login(username: string, password: string) {
  const response = await fetch("/api/trpc/auth.login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      json: {
        username: username.trim(),
        password,
      },
    }),
  });

  const result = await response.json();

  const data =
    result?.result?.data?.json ||
    result?.result?.data ||
    result;

  if (!data?.success) {
    return {
      success: false,
      message:
        data?.message ||
        "로그인에 실패했습니다.",
    };
  }

  sessionStorage.setItem(
    CURRENT_USER_KEY,
    JSON.stringify(data.user)
  );

  touchActivity();
  emitAuthChanged();

  return data;
}

export async function updatePassword(
  username: string,
  newPassword: string
) {
  const password = newPassword.trim();

  if (!password) {
    return {
      success: false,
      message: "비밀번호를 입력해주세요.",
    };
  }

  const response = await fetch(
    "/api/trpc/auth.changePassword",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        json: {
          username,
          password,
        },
      }),
    }
  );

  const result = await response.json();

  const data =
    result?.result?.data?.json ||
    result?.result?.data ||
    result;

  return {
    success: !!data?.success,
  };
}

export function logout() {
  sessionStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  emitAuthChanged();
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
