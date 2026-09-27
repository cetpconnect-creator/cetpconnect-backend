require("dotenv").config();

const mongoose = require("mongoose");

const User = require("./models/User");
const Event = require("./models/Event");

const createEvents = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const admin = await User.findOne({
      username: "admin",
    });

    if (!admin) {
      throw new Error("Admin user not found. Run seedAdmin.js first.");
    }

    let hackathon = await Event.findOne({
      slug: "hackathon",
    });

    if (!hackathon) {
      hackathon = await Event.create({
        title: "Hackathon",
        slug: "hackathon",
        category: "YUKTHIX",
        description: "Technology Hackathon",
        rules: "Teams of 2-4 members.",
        date: new Date("2026-10-13"),
        startTime: "09:00",
        endTime: "18:00",
        venue: "Main Block",
        registrationStart: new Date("2026-09-27"),
        registrationEnd: new Date("2026-10-12"),
        fee: 100,
        capacity: 100,
        registrationType: "TEAM",
        minTeamSize: 2,
        maxTeamSize: 4,
        status: "PUBLISHED",
        createdBy: admin._id,
      });
    }

    let photography = await Event.findOne({
      slug: "photography",
    });

    if (!photography) {
      photography = await Event.create({
        title: "Photography",
        slug: "photography",
        category: "VAAGA",
        description: "Photography Competition",
        rules: "Individual participation.",
        date: new Date("2026-10-14"),
        startTime: "10:00",
        endTime: "13:00",
        venue: "Arts Block",
        registrationStart: new Date("2026-09-27"),
        registrationEnd: new Date("2026-10-13"),
        fee: 50,
        capacity: 50,
        registrationType: "INDIVIDUAL",
        status: "PUBLISHED",
        createdBy: admin._id,
      });
    }

    console.log("Events ready:");
    console.log("Hackathon:", hackathon._id.toString());
    console.log("Photography:", photography._id.toString());

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
};

createEvents();