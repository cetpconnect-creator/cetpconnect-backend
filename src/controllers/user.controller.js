const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("../models/User");
const Event = require("../models/Event");

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash")
      .populate("assignedEvents", "title slug category")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load users",
    });
  }
};

// POST /api/admin/users
const createUser = async (req, res) => {
  try {
    const {
      username,
      password,
      name,
      role,
      assignedEvents = [],
      isActive = true,
    } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: "Username, password, name and role are required",
      });
    }

    const allowedRoles = [
      "SUPER_ADMIN",
      "FACULTY",
      "EVENT_MANAGER",
      "STUDENT_COORDINATOR",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    const normalizedUsername = username.toLowerCase().trim();

    const existingUser = await User.findOne({
      username: normalizedUsername,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    if (!Array.isArray(assignedEvents)) {
      return res.status(400).json({
        success: false,
        message: "assignedEvents must be an array",
      });
    }

    const validEventIds = [];

    for (const eventId of assignedEvents) {
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid event ID: ${eventId}`,
        });
      }

      const eventExists = await Event.exists({ _id: eventId });

      if (!eventExists) {
        return res.status(404).json({
          success: false,
          message: `Event not found: ${eventId}`,
        });
      }

      validEventIds.push(eventId);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: normalizedUsername,
      passwordHash,
      name: name.trim(),
      role,
      assignedEvents: validEventIds,
      isActive: Boolean(isActive),
    });

    const safeUser = await User.findById(user._id)
      .select("-passwordHash")
      .populate("assignedEvents", "title slug category")
      .lean();

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("Create user error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

// PATCH /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const {
      username,
      password,
      name,
      role,
      assignedEvents,
      isActive,
    } = req.body;

    if (username !== undefined) {
      const normalizedUsername = username.toLowerCase().trim();

      const duplicate = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }

      user.username = normalizedUsername;
    }

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (role !== undefined) {
      const allowedRoles = [
        "SUPER_ADMIN",
        "FACULTY",
        "EVENT_MANAGER",
        "STUDENT_COORDINATOR",
      ];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role",
        });
      }

      user.role = role;
    }

    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
    }

    if (assignedEvents !== undefined) {
      if (!Array.isArray(assignedEvents)) {
        return res.status(400).json({
          success: false,
          message: "assignedEvents must be an array",
        });
      }

      for (const eventId of assignedEvents) {
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid event ID: ${eventId}`,
          });
        }

        const exists = await Event.exists({ _id: eventId });

        if (!exists) {
          return res.status(404).json({
            success: false,
            message: `Event not found: ${eventId}`,
          });
        }
      }

      user.assignedEvents = assignedEvents;
    }

    if (password) {
      user.passwordHash = await bcrypt.hash(password, 12);
    }

    await user.save();

    const safeUser = await User.findById(user._id)
      .select("-passwordHash")
      .populate("assignedEvents", "title slug category")
      .lean();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("Update user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
};