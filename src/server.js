require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

// Register all Mongoose models
require("./models/User");
require("./models/Event");
require("./models/Team");
require("./models/Participant");
require("./models/Payment");
require("./models/Announcement");
require("./models/Registration");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();