const Event = require("../models/Event");

// ==========================================
// CREATE EVENT
// ==========================================
const createEvent = async (req, res) => {
  try {
    const {
      title,
      slug,
      category,
      description,
      rules,
      date,
      startTime,
      endTime,
      venue,
      registrationStart,
      registrationEnd,
      fee,
      capacity,
      registrationType,
      minTeamSize,
      maxTeamSize,
      paymentQrUrl,
      registrationFields,
      status,
    } = req.body;

    // Check duplicate slug
    const existingEvent = await Event.findOne({ slug });

    if (existingEvent) {
      return res.status(409).json({
        success: false,
        message: "Event with this slug already exists",
      });
    }

    // Cloudinary uploaded image URL
    const imageUrl = req.file ? req.file.path : "";

    const event = await Event.create({
      title,
      slug,
      category,
      description,
      imageUrl,
      rules,
      date,
      startTime,
      endTime,
      venue,
      registrationStart,
      registrationEnd,
      fee,
      capacity,
      registrationType,
      minTeamSize,
      maxTeamSize,
      paymentQrUrl,
      registrationFields,
      status: status || "DRAFT",
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==========================================
// UPDATE EVENT
// ==========================================
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const allowedFields = [
      "title",
      "slug",
      "category",
      "description",
      "rules",
      "date",
      "startTime",
      "endTime",
      "venue",
      "registrationStart",
      "registrationEnd",
      "fee",
      "capacity",
      "registrationType",
      "minTeamSize",
      "maxTeamSize",
      "paymentQrUrl",
      "registrationFields",
      "status",
    ];

    // Update normal fields
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    // Update poster if a new image was uploaded
    if (req.file) {
      event.imageUrl = req.file.path;
    }

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event,
    });
  } catch (error) {
    console.error("Update event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==========================================
// DELETE EVENT
// ==========================================
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    await Event.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==========================================
// GET ALL PUBLISHED EVENTS
// ==========================================
const getPublishedEvents = async (req, res) => {
  try {
    const events = await Event.find({
      status: "PUBLISHED",
    })
      .select(
        "title slug category description imageUrl date startTime endTime venue fee capacity registrationType minTeamSize maxTeamSize registrationStart registrationEnd"
      )
      .sort({ date: 1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Get events error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==========================================
// GET SINGLE EVENT BY SLUG
// ==========================================
const getEventBySlug = async (req, res) => {
  try {
    const event = await Event.findOne({
      slug: req.params.slug,
      status: "PUBLISHED",
    }).select("-createdBy -__v");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Get event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ADMIN: GET ALL EVENTS
const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "username name role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Get all events error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ==========================================
// EXPORT
// ==========================================
module.exports = {
  createEvent,
  updateEvent,
  deleteEvent,
  getPublishedEvents,
  getEventBySlug,
  getAllEvents,
};