/** Обліковий запис студента (як його повертає API; хеш пароля на клієнт не потрапляє). */
export interface User {
  id: string;
  email: string;
  fullName: string;
  group: string;
  studentCard: string;
  createdAt: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}
