export const T = {
  bg: "#FAFAF9",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F4F1",
  border: "#E8E6E0",
  text: "#1A1915",
  textMuted: "#6B6861",
  textHint: "#9E9B93",
  accent: "#2563EB",
  accentLight: "#EFF4FF",
  accentHover: "#1D4ED8",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  success: "#16A34A",
  successLight: "#F0FDF4",
  warning: "#D97706",
  warningLight: "#FFFBEB",
  sidebar: "#1C1B18",
  sidebarText: "#E8E6E0",
  sidebarMuted: "#A8A59E",
  sidebarActive: "#2D2C28",
  radius: "8px",
  radiusSm: "7px",
  radiusLg: "8px",
};

export const ROLE_LABELS = {
  member: "Участник",
  admin: "Администратор",
};

export const ROLE_COLORS = {
  member: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  admin: { bg: "#FDF4FF", text: "#7E22CE", border: "#E9D5FF" },
};

export const STATUS_LABELS = {
  active: "Активен",
  blocked: "Блок",
  unverified: "Не подтвержден",
  phone_verified: "Телефон подтвержден",
  fully_verified: "Подтвержден",
  planned: "Планируется",
  open: "Набор открыт",
  full: "Набор завершен",
  in_progress: "В процессе",
  completed: "Завершена",
  cancelled: "Отменена",
};

export const STATUS_STYLES = {
  active: { bg: "#F0FDF4", text: "#15803D", dot: "#16A34A" },
  blocked: { bg: "#FEF2F2", text: "#DC2626", dot: "#DC2626" },
  planned: { bg: "#FFFBEB", text: "#D97706", dot: "#D97706" },
  open: { bg: "#EFF6FF", text: "#1D4ED8", dot: "#2563EB" },
  full: { bg: "#FFF7ED", text: "#C2410C", dot: "#EA580C" },
  in_progress: { bg: "#F0FDF4", text: "#15803D", dot: "#16A34A" },
  completed: { bg: "#F9FAFB", text: "#6B7280", dot: "#9CA3AF" },
  cancelled: { bg: "#FEF2F2", text: "#DC2626", dot: "#DC2626" },
};
