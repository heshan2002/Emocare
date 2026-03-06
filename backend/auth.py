from pydantic import BaseModel, EmailStr
import uuid

class User(BaseModel):
    name: str
    age: int
    email: EmailStr
    password: str
    medical: list[str] = []
    family: str = ""
    habits: list[str] = []
    hobbies: list[str] = []

def prepare_user_data(user: User):
    return {
        "_id": str(uuid.uuid4()),
        "name": user.name,
        "age": user.age,
        "email": user.email,
        "password": user.password,  # hashed later
        "medical": user.medical or [],          # ensure list
        "family": user.family or "",
        "habits": user.habits or [],
        "hobbies": user.hobbies or []
    }