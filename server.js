const express = require("express");
const { ObjectId } = require("mongodb");
const connectDB = require("./db");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 8000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A valid ObjectId string is exactly 24 hex characters.
// (ObjectId.isValid alone also accepts any 12-character string, so it's too loose.)
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

// Fields a client is allowed to update.
const UPDATABLE_FIELDS = ["first_name", "last_name", "email"];

// Pagination defaults.
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Parses a query value like "2" into 2.
// Returns the fallback if the value is missing, or null if it is invalid.
function parsePositiveInt(value, fallback) {
  if (value === undefined) return fallback;

  // Must be a string of digits, no leading zero, no sign, at most 9 digits.
  if (typeof value !== "string" || !/^[1-9]\d{0,8}$/.test(value)) {
    return null;
  }

  return parseInt(value, 10);
}

// Escapes special regex characters so user input like "a.*" is treated as plain text.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Middleware: rejects the request with 400 if :id is not a valid ObjectId string.
// If it is valid, next() passes the request on to the route handler.
function validateObjectId(req, res, next) {
  if (!OBJECT_ID_REGEX.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  next();
}

async function startServer() {
  try {
    const db = await connectDB();
    const usersCollection = db.collection("users");

    // Unique index so the same email can't be inserted twice.
    await usersCollection.createIndex({ email: 1 }, { unique: true });

    app.get("/", (req, res) => {
      res.send("Express API is running!");
    });

       // Get users with pagination and optional search:
    // GET /api/users?page=2&limit=10&name=ari
    app.get("/api/users", async (req, res) => {
      try {
        const { name } = req.query;

        const page = parsePositiveInt(req.query.page, 1);
        const requestedLimit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT);

        if (page === null || requestedLimit === null) {
          return res.status(400).json({
            message: "page and limit must be positive whole numbers",
          });
        }

        // Never let a client ask for more than MAX_LIMIT documents.
        const limit = Math.min(requestedLimit, MAX_LIMIT);

        let filter = {};

        if (name !== undefined) {
          if (typeof name !== "string") {
            return res.status(400).json({ message: "name must be a string" });
          }

          const terms = name.trim().split(/\s+/).filter(Boolean);

          if (terms.length === 0) {
            return res.status(400).json({ message: "name cannot be empty" });
          }

          filter = {
            $and: terms.map((term) => {
              const regex = new RegExp(escapeRegex(term), "i");
              return {
                $or: [{ first_name: regex }, { last_name: regex }],
              };
            }),
          };
        }

        // Run both queries at the same time.
        const [users, total] = await Promise.all([
          usersCollection
            .find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray(),
          usersCollection.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
          data: users,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    });

    // Get one user by id.
    app.get("/api/users/:id", validateObjectId, async (req, res) => {
      try {
        const user = await usersCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    });

    // Create a user.
    app.post("/api/users", async (req, res) => {
      try {
        const { first_name, last_name, email } = req.body ?? {};

        if (
          typeof first_name !== "string" ||
          typeof last_name !== "string" ||
          typeof email !== "string" ||
          !first_name.trim() ||
          !last_name.trim() ||
          !email.trim()
        ) {
          return res.status(400).json({
            message: "first_name, last_name, and email are required strings",
          });
        }

        const cleanEmail = email.trim().toLowerCase();

        if (!EMAIL_REGEX.test(cleanEmail)) {
          return res.status(400).json({ message: "Invalid email format" });
        }

        const newUser = {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: cleanEmail,
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        res.status(201).json({
          message: "User created successfully",
          user: { _id: result.insertedId, ...newUser },
        });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ message: "Email already exists" });
        }

        console.error("Error creating user:", error);
        res.status(500).json({ message: "Failed to create user" });
      }
    });

    // Partially update a user by id.
    app.patch("/api/users/:id", validateObjectId, async (req, res) => {
      try {
        const body = req.body ?? {};
        const updates = {};

        // Copy only the allowed fields that the client actually sent.
        for (const field of UPDATABLE_FIELDS) {
          if (body[field] === undefined) continue;

          const value = body[field];

          if (typeof value !== "string" || !value.trim()) {
            return res.status(400).json({
              message: `${field} must be a non-empty string`,
            });
          }

          updates[field] = value.trim();
        }

        if (updates.email !== undefined) {
          updates.email = updates.email.toLowerCase();

          if (!EMAIL_REGEX.test(updates.email)) {
            return res.status(400).json({ message: "Invalid email format" });
          }
        }

        // Nothing valid was sent, so there is nothing to update.
        if (Object.keys(updates).length === 0) {
          return res.status(400).json({
            message: `Provide at least one of: ${UPDATABLE_FIELDS.join(", ")}`,
          });
        }

        updates.updatedAt = new Date();

        const updatedUser = await usersCollection.findOneAndUpdate(
          { _id: new ObjectId(req.params.id) },
          { $set: updates },
          { returnDocument: "after" }
        );

        // Driver v6+ returns the document directly, or null if nothing matched.
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
          message: "User updated successfully",
          user: updatedUser,
        });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ message: "Email already exists" });
        }

        console.error("Error updating user:", error);
        res.status(500).json({ message: "Failed to update user" });
      }
    });

    // Replace a user completely by id.
    app.put("/api/users/:id", validateObjectId, async (req, res) => {
      try {
        const { first_name, last_name, email } = req.body ?? {};

        // PUT replaces the whole user, so all three fields are required.
        if (
          typeof first_name !== "string" ||
          typeof last_name !== "string" ||
          typeof email !== "string" ||
          !first_name.trim() ||
          !last_name.trim() ||
          !email.trim()
        ) {
          return res.status(400).json({
            message: "first_name, last_name, and email are required strings",
          });
        }

        const cleanEmail = email.trim().toLowerCase();

        if (!EMAIL_REGEX.test(cleanEmail)) {
          return res.status(400).json({ message: "Invalid email format" });
        }

        const _id = new ObjectId(req.params.id);

        // Fetch the existing user so createdAt can be kept.
        const existing = await usersCollection.findOne({ _id });

        if (!existing) {
          return res.status(404).json({ message: "User not found" });
        }

        const replacement = {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: cleanEmail,
          updatedAt: new Date(),
        };

        // Keep the original creation date if the old document had one.
        if (existing.createdAt) {
          replacement.createdAt = existing.createdAt;
        }

        const updatedUser = await usersCollection.findOneAndReplace(
          { _id },
          replacement,
          { returnDocument: "after" }
        );

        // Null only if the user was deleted between the two calls.
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
          message: "User replaced successfully",
          user: updatedUser,
        });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ message: "Email already exists" });
        }

        console.error("Error replacing user:", error);
        res.status(500).json({ message: "Failed to replace user" });
      }
    });

    // Delete a user by id.
    app.delete("/api/users/:id", validateObjectId, async (req, res) => {
      try {
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        // deletedCount is 0 when no document matched the id.
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
          message: "User deleted successfully",
          deletedId: req.params.id,
        });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
      }
    });

    // Handles invalid JSON bodies.
    app.use((err, req, res, next) => {
      if (err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON body" });
      }
      next(err);
    });

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB Atlas:", error);
    process.exit(1);
  }
}

startServer();