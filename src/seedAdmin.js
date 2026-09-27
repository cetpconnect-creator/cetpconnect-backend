require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existingAdmin = await User.findOne({
      username: "admin",
    });

    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash("Admin@12345", 12);

    const admin = await User.create({
      username: "admin",
      passwordHash,
      name: "System Administrator",
      role: "SUPER_ADMIN",
      assignedEvents: [],
      isActive: true,
    });

    console.log("Admin created successfully");
    console.log("Username:", admin.username);
    console.log("Password: Admin@12345");

    process.exit(0);
  } catch (error) {
    console.error("Failed to create admin:", error);
    process.exit(1);
  }
};

createAdmin();