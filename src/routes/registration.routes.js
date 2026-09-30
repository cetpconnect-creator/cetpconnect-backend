const express = require("express");

const {
  createRegistration,
  getRegistration,
} = require("../controllers/registration.controller");

const {
  createTeamRegistration,
} = require("../controllers/team.controller");

const router = express.Router();

// =====================================================
// PUBLIC REGISTRATION
// =====================================================

router.post("/", createRegistration);

router.post("/team", createTeamRegistration);

router.get("/:registrationId", getRegistration);

module.exports = router;