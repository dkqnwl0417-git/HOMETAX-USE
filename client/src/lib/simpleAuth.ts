export type AppUser = {
  username: string;
  role?: "admin" | "user";
};

export type AppTheme =
  | "blue"
  | "navy"
  | "green"
  | "mint"
  | "sky"
  | "lavender"
  | "beige"
  | "coral"
  | "pink";

export const THEME_OPTIONS: { value: AppTheme; label: string; description: string }[] = [
  { value: "blue", label: "기본 블루", description: "깔끔하고 무난한 기본 업무용 테마" },
  { value: "navy", label: "네이비", description: "차분하고 전문적인 문서관리 느낌" },
  { value: "green", label: "그린", description: "편안하고 안정적인 느낌" },
  { value: "mint", label: "민트", description: "밝고 부드러운 업무 화면" },
  { value: "sky", label: "스카이", description: "시원하고 가벼운 느낌" },
  { value: "lavender", label: "라벤더", description: "부드럽고 차분한 보라 계열" },
  { value: "beige", label: "베이지", description: "따뜻하고 눈이 편한 색감" },
  { value: "coral", label: "코랄", description: "밝고 산뜻한 포인트 테마" },
  { value: "pink", label: "핑크", description: "부드럽고 화사한 색감" },
];

const CURRENT_USER_KEY = "hometax-current-user";
const LAST_ACTIVITY_KEY = "hometax-last-activity";
const SESSION_LIMIT_MS = 3 * 60 * 60 * 1000;
const USER_THEME_PREFIX = "hometax-user-theme-";
const THEME_CLASS_PREFIX = "theme-";

export const AUTH_CHANGED_EVENT = "hometax-auth-changed";
export const OPEN_LOGIN_EVENT = "hometax-open-login";

function emitAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function getThemeKey(username: string) {
  return `${USER_THEME_PREFIX}${username}`;
}

export function getUserTheme(username?: string): AppTheme {
  const targetUsername = username || getCurrentUser()?.username;

  if (!targetUsername) {
    return "blue";
  }

  const savedTheme = localStorage.getItem(getThemeKey(targetUsername)) as AppTheme | null;

  if (savedTheme && THEME_OPTIONS.some((theme) => theme.value === savedTheme)) {
    return savedTheme;
  }

  return "blue";
}

export function applyTheme(theme: AppTheme) {
  document.documentElement.classList.remove(
    ...THEME_OPTIONS.map((item) => `${THEME_CLASS_PREFIX}${item.value}`)
  );

  document.documentElement.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
}

export function saveUserTheme(theme: AppTheme, username?: string) {
  const targetUsername = username || getCurrentUser()?.username;

  if (!targetUsername) {
    return;
  }

  localStorage.setItem(getThemeKey(targetUsername), theme);
  applyTheme(theme);
  emitAuthChanged();
}

export function applyCurrentUserTheme() {
  const user = getCurrentUser();
  const theme = getUserTheme(user?.username);

  applyTheme(theme);
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

  applyTheme(getUserTheme(data.user.username));

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

export async function updatePasswordWithCurrent(
  username: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  const current = currentPassword.trim();
  const password = newPassword.trim();
  const confirm = confirmPassword.trim();

  if (!current) {
    return { success: false, message: "현재 비밀번호를 입력해주세요." };
  }

  if (!password) {
    return { success: false, message: "새 비밀번호를 입력해주세요." };
  }

  if (password !== confirm) {
    return { success: false, message: "새 비밀번호와 비밀번호 확인이 일치하지 않습니다." };
  }

  const response = await fetch("/api/trpc/auth.changePasswordWithCurrent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      json: {
        username,
        currentPassword: current,
        newPassword: password,
      },
    }),
  });

  const result = await response.json();

  const data =
    result?.result?.data?.json ||
    result?.result?.data ||
    result;

  return {
    success: !!data?.success,
    message: data?.message || "비밀번호 변경에 실패했습니다.",
  };
}

export function logout() {
  sessionStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  applyTheme("blue");
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
