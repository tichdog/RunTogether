import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, "Маршрут не найден"));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;
  const payload = {
    error: error.message || "Внутренняя ошибка сервера",
  };

  if (error.details) {
    payload.details = error.details;
  }

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json(payload);
}
