# Express MongoDB Learning API

A beginner-friendly REST API built with Express.js and MongoDB Atlas using the
native `mongodb` driver (no Mongoose), to learn backend fundamentals.

## Setup

1. `npm install`
2. Create a `.env` file:

# API Endpoints

Base URL: `http://localhost:8000`

## Endpoints

| #   | Method   | Route                 | Description                        | Success | Errors                     |
| --- | -------- | --------------------- | ---------------------------------- | ------- | -------------------------- |
| 1   | `GET`    | `/`                   | Health check                       | `200`   | none                       |
| 2   | `GET`    | `/api/users`          | Get all users (latest 50)          | `200`   | `500`                      |
| 3   | `GET`    | `/api/users?name=ari` | Search users by first or last name | `200`   | `400`, `500`               |
| 4   | `GET`    | `/api/users/:id`      | Get one user by id                 | `200`   | `400`, `404`, `500`        |
| 5   | `POST`   | `/api/users`          | Create a user                      | `201`   | `400`, `409`, `500`        |
| 6   | `PUT`    | `/api/users/:id`      | Replace a user completely          | `200`   | `400`, `404`, `409`, `500` |
| 7   | `PATCH`  | `/api/users/:id`      | Partially update a user            | `200`   | `400`, `404`, `409`, `500` |
| 8   | `DELETE` | `/api/users/:id`      | Delete a user                      | `200`   | `400`, `404`, `500`        |

## Request Bodies

| Route                  | Body                                                     |
| ---------------------- | -------------------------------------------------------- |
| `POST /api/users`      | `first_name`, `last_name`, `email` (all required)        |
| `PUT /api/users/:id`   | `first_name`, `last_name`, `email` (all required)        |
| `PATCH /api/users/:id` | any of `first_name`, `last_name`, `email` (at least one) |
| `GET`, `DELETE`        | no body                                                  |

## PUT vs PATCH

|                 | PUT                    | PATCH                          |
| --------------- | ---------------------- | ------------------------------ |
| Purpose         | Replace the whole user | Update only the sent fields    |
| Required fields | All three              | At least one                   |
| MongoDB method  | `findOneAndReplace`    | `findOneAndUpdate` with `$set` |

## Status Codes

| Code  | Meaning                                               |
| ----- | ----------------------------------------------------- |
| `200` | OK (read, update, delete)                             |
| `201` | Created                                               |
| `400` | Bad input (invalid id, invalid field, malformed JSON) |
| `404` | User not found                                        |
| `409` | Email already exists                                  |
| `500` | Server or database error                              |

## Examples

**Create**

```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Arijit","last_name":"Khan","email":"arijit@example.com"}'
```

**Search by name**

```bash
curl "http://localhost:8000/api/users?name=ari"
```

**Replace (PUT)**

```bash
curl -X PUT http://localhost:8000/api/users/<id> \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Ari","last_name":"Khan","email":"ari@example.com"}'
```

**Partial update (PATCH)**

```bash
curl -X PATCH http://localhost:8000/api/users/<id> \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Ari"}'
```

**Delete**

```bash
curl -X DELETE http://localhost:8000/api/users/<id>
```

## User Document

```json
{
  "_id": "66f1a2b3c4d5e6f7a8b9c0d1",
  "first_name": "Arijit",
  "last_name": "Khan",
  "email": "arijit@example.com",
  "createdAt": "2026-10-20T08:15:30.000Z",
  "updatedAt": "2026-10-28T09:30:00.000Z"
}
```

`updatedAt` is added after the first PUT or PATCH.

## Database

- MongoDB Atlas, `users` collection, native `mongodb` driver (no Mongoose)
- Unique index on `email`

## Not Implemented Yet

- [ ] Pagination (`?page=2&limit=10`)
- [ ] Authentication and authorization (JWT)
