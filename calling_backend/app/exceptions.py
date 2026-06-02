from fastapi import HTTPException, status


class AppError(HTTPException):
    """Base class for domain errors."""


class LeadNotFound(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")


class LeadDoNotCall(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail="Lead is marked do-not-call")


class CallAlreadyInProgress(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail="Call already in progress for this lead")


class CallbackNotFound(AppError):
    def __init__(self) -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail="Callback not found")


class InvalidPhoneNumber(AppError):
    def __init__(self, phone: str) -> None:
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid phone number: {phone}",
        )


class DuplicatePhone(AppError):
    def __init__(self, phone: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A lead with phone {phone} already exists",
        )
