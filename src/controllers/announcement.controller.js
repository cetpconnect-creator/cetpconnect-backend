const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");

const getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate("createdBy", "name username role")
      .sort({ publishedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      announcements,
    });
  } catch (error) {
    console.error("Get announcements error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load announcements",
    });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const {
      title,
      content,
      publishedAt,
      expiresAt,
      isPublished = true,
    } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      publishedAt: publishedAt
        ? new Date(publishedAt)
        : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isPublished: Boolean(isPublished),
      createdBy: req.user.userId,
    });

    const result = await Announcement.findById(announcement._id)
      .populate("createdBy", "name username role")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      announcement: result,
    });
  } catch (error) {
    console.error("Create announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create announcement",
    });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const {
      title,
      content,
      publishedAt,
      expiresAt,
      isPublished,
    } = req.body;

    if (title !== undefined) {
      announcement.title = title.trim();
    }

    if (content !== undefined) {
      announcement.content = content.trim();
    }

    if (publishedAt !== undefined) {
      announcement.publishedAt = publishedAt
        ? new Date(publishedAt)
        : new Date();
    }

    if (expiresAt !== undefined) {
      announcement.expiresAt = expiresAt
        ? new Date(expiresAt)
        : null;
    }

    if (isPublished !== undefined) {
      announcement.isPublished = Boolean(isPublished);
    }

    await announcement.save();

    const result = await Announcement.findById(id)
      .populate("createdBy", "name username role")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      announcement: result,
    });
  } catch (error) {
    console.error("Update announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update announcement",
    });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement =
      await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    console.error("Delete announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement",
    });
  }
};

module.exports = {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};