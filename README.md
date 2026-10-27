# Express MongoDB Learning API

A beginner-friendly REST API built with Express.js and MongoDB Atlas using the
native `mongodb` driver (no Mongoose), to learn backend fundamentals.

## Features

- Create, read, update (PATCH), and delete users
- Search users by name (`GET /api/users?name=ari`)
- Input validation and sanitization
- Unique email index with duplicate handling (`409`)
- Proper status codes and error handling

## Endpoints

| Method | Route            | Description                            |
| ------ | ---------------- | -------------------------------------- |
| GET    | `/api/users`     | Get all users, or search with `?name=` |
| GET    | `/api/users/:id` | Get one user                           |
| POST   | `/api/users`     | Create a user                          |
| PATCH  | `/api/users/:id` | Partially update a user                |
| DELETE | `/api/users/:id` | Delete a user                          |

## Setup

1. `npm install`
2. Create a `.env` file:
