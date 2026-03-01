class AppException(Exception):
    def __init__(
        self, message: str, status_code: int = 400, error_code: str = "APP_ERROR"
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code


class NotFound(AppException):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found", 404, "NOT_FOUND")


class Unauthorized(AppException):
    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message, 401, "UNAUTHORIZED")


class Forbidden(AppException):
    def __init__(self, message: str = "Access denied"):
        super().__init__(message, 403, "FORBIDDEN")


class Conflict(AppException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message, 409, "CONFLICT")


class RateLimited(AppException):
    def __init__(self, message: str = "Too many requests"):
        super().__init__(message, 429, "RATE_LIMITED")
