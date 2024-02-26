from typing import Literal

TimeUnit = (
    Literal["second"]
    | Literal["seconds"]
    | Literal["minute"]
    | Literal["minutes"]
    | Literal["hour"]
    | Literal["hours"]
    | Literal["day"]
    | Literal["days"]
)


class Duration:
    def __init__(self, amount: int, unit: TimeUnit) -> None:
        self.amount = amount
        self.unit = unit


def duration(amount: int, unit: TimeUnit) -> Duration:
    return Duration(amount, unit)
