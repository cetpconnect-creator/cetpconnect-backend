// routes/admin.routes.js

const express = require("express");

const authenticate = require("../middleware/auth");
const authorizeRoles = require("../middleware/roles");
const checkEventAccess = require("../middleware/eventAccess");
const upload = require("../middleware/upload");

const router = express.Router();

const {
  getUsers,
  createUser,
  updateUser,
} = require("../controllers/user.controller");

const {
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getAdminEvent,
} = require("../controllers/event.controller");

const {
  verifyPayment,
  rejectPayment,
  getPaymentByRegistration,
} = require("../controllers/payment.controller");

const {
  getRegistrations,
  getRegistrationById,
  exportRegistrations,
} = require("../controllers/registration.controller");

const {
  getDashboard,
} = require("../controllers/admin.controller");

const {
  getParticipants,
  getParticipantById,
} = require("../controllers/participant.controller");

const {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcement.controller");

// =====================================================
// EVENTS
// =====================================================

router.post(
  "/events",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  upload.fields([
    {
      name: "poster",
      maxCount: 1,
    },
    {
      name: "paymentQr",
      maxCount: 1,
    },
  ]),
  createEvent
);

router.get(
  "/events",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getAllEvents
);

router.get(
  "/events/:id",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getAdminEvent
);

router.patch(
  "/events/:id",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY"
  ),
  upload.fields([
    {
      name: "poster",
      maxCount: 1,
    },
    {
      name: "paymentQr",
      maxCount: 1,
    },
  ]),
  updateEvent
);

router.delete(
  "/events/:id",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  deleteEvent
);

// =====================================================
// REGISTRATION PAYMENT
// =====================================================

router.get(
  "/registrations/:id/payment",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getPaymentByRegistration
);

router.patch(
  "/registrations/:id/payment",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER"
  ),
  verifyPayment
);

router.patch(
  "/registrations/:id/payment/reject",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER"
  ),
  rejectPayment
);

// =====================================================
// REGISTRATIONS
// =====================================================

router.get(
  "/registrations",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getRegistrations
);

router.get(
  "/registrations/export",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER"
  ),
  exportRegistrations
);

router.get(
  "/registrations/:id",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getRegistrationById
);

// =====================================================
// DASHBOARD
// =====================================================

router.get(
  "/dashboard",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getDashboard
);

// =====================================================
// PARTICIPANTS
// =====================================================

router.get(
  "/participants",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getParticipants
);

router.get(
  "/participants/:participantId",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  getParticipantById
);

// =====================================================
// USERS
// =====================================================

router.get(
  "/users",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  getUsers
);

router.post(
  "/users",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  createUser
);

router.patch(
  "/users/:id",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  updateUser
);

// =====================================================
// ANNOUNCEMENTS
// =====================================================

router.get(
  "/announcements",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  getAnnouncements
);

router.post(
  "/announcements",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  createAnnouncement
);

router.patch(
  "/announcements/:id",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  updateAnnouncement
);

router.delete(
  "/announcements/:id",
  authenticate,
  authorizeRoles("SUPER_ADMIN"),
  deleteAnnouncement
);

// =====================================================
// EVENT ACCESS TEST
// =====================================================

router.get(
  "/events/:eventId/test",
  authenticate,
  authorizeRoles(
    "SUPER_ADMIN",
    "FACULTY",
    "EVENT_MANAGER",
    "STUDENT_COORDINATOR"
  ),
  checkEventAccess,
  (req, res) => {
    if (!req.event) {
      return res.status(500).json({
        success: false,
        message:
          "Event was not attached by authorization middleware",
      });
    }

    return res.json({
      success: true,
      message: "Event access granted",

      event: {
        id: req.event._id,
        title: req.event.title,
        category: req.event.category,
      },

      user: {
        userId: req.user.userId,
        role: req.user.role,
      },
    });
  }
);

module.exports = router;