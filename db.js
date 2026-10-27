// This loads the connection string and database name from .env.
require("dotenv").config();

//MongoClient is the official driver class used to connect to MongoDB.
const { MongoClient } = require("mongodb");

//This configures the client with your Atlas connection string.
const client = new MongoClient(process.env.MONGODB_URI);

async function connectDB() {
  //This opens the connection to Atlas.
  await client.connect();

  // The ping command checks whether the server responds.
  await client.db("admin").command({ ping: 1 });

  console.log("MongoDB Atlas connected successfully!");

  //This tells the driver which database you want to use.
  return client.db(process.env.MONGODB_DB);
}

module.exports = connectDB;