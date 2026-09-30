// routes/event.routes.js

const express = require("express");

const {
  getPublishedEvents,
  getEventBySlug,
} = require("../controllers/event.controller");

const router = express.Router();

// Public event list
router.get("/", getPublishedEvents);

// Public single event
router.get("/:slug", getEventBySlug);

module.exports = router;