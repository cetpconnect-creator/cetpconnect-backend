const mongoose = require("mongoose");
const Event = require("../models/Event");
const User = require("../models/User");

const checkEventAccess = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }

    // Validate MongoDB ObjectId first
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // SUPER_ADMIN can access every event
    if (req.user.role === "SUPER_ADMIN") {
      req.event = event;
      return next();
    }

    const user = await User.findById(req.user.userId).select(
      "assignedEvents role isActive"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive",
      });
    }

    const hasAccess = user.assignedEvents.some(
      (assignedEvent) =>
        assignedEvent.toString() === event._id.toString()
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this event",
      });
    }

    req.event = event;

    return next();
  } catch (error) {
    console.error("Event access error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = checkEventAccess;