require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const Event = require("./models/Event");

const createStaff = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const hackathon = await Event.findOne({
      slug: "hackathon",
    });

    const photography = await Event.findOne({
      slug: "photography",
    });

    if (!hackathon || !photography) {
      throw new Error(
        "Events not found. Run: node src/seedEvents.js"
      );
    }

    const passwordHash = await bcrypt.hash("Staff@12345", 12);

    const staff = [
      {
        username: "faculty",
        name: "Faculty User",
        role: "FACULTY",
        assignedEvents: [hackathon._id, photography._id],
      },
      {
        username: "eventmanager",
        name: "Hackathon Manager",
        role: "EVENT_MANAGER",
        assignedEvents: [hackathon._id],
      },
      {
        username: "coordinator",
        name: "Hackathon Coordinator",
        role: "STUDENT_COORDINATOR",
        assignedEvents: [hackathon._id],
      },
    ];

    for (const data of staff) {
      const existingUser = await User.findOne({
        username: data.username,
      });

      if (existingUser) {
        console.log(`${data.username} already exists`);
        continue;
      }

      await User.create({
        ...data,
        passwordHash,
        isActive: true,
      });

      console.log(`${data.username} created`);
    }

    console.log("\nStaff seeding complete.");
    console.log("Password for all staff: Staff@12345");

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
};

createStaff();