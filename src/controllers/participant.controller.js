const mongoose = require("mongoose");

const Participant = require("../models/Participant");
const User = require("../models/User");

/* =========================================================
   HELPERS
========================================================= */

/*
 * Returns:
 *
 * null
 *   SUPER_ADMIN can access all events
 *
 * []
 *   User has no assigned events
 *
 * [eventId...]
 *   User can access these events
 */
async function getAccessibleEventIds(req) {
  if (!req.user) {
    const error = new Error(
      "Authentication required"
    );

    error.statusCode = 401;

    throw error;
  }

  /*
   * SUPER_ADMIN
   */
  if (req.user.role === "SUPER_ADMIN") {
    return null;
  }

  const user = await User.findById(
    req.user.userId
  ).select(
    "assignedEvents role isActive"
  );

  if (!user) {
    const error = new Error(
      "User account not found"
    );

    error.statusCode = 401;

    throw error;
  }

  if (!user.isActive) {
    const error = new Error(
      "User account is inactive"
    );

    error.statusCode = 403;

    throw error;
  }

  return (user.assignedEvents || []).map(
    (eventId) =>
      eventId.toString()
  );
}

/*
 * Check whether a user can access
 * a particular event.
 */
async function checkParticipantEventAccess(
  req,
  eventId
) {
  if (!eventId) {
    const error = new Error(
      "Participant event information is missing"
    );

    error.statusCode = 400;

    throw error;
  }

  const accessibleEventIds =
    await getAccessibleEventIds(req);

  /*
   * SUPER_ADMIN
   */
  if (accessibleEventIds === null) {
    return true;
  }

  const hasAccess =
    accessibleEventIds.includes(
      eventId.toString()
    );

  if (!hasAccess) {
    const error = new Error(
      "You do not have access to this participant"
    );

    error.statusCode = 403;

    throw error;
  }

  return true;
}

/* =========================================================
   GET PARTICIPANTS
========================================================= */

const getParticipants = async (
  req,
  res
) => {
  try {
    const {
      eventId,
      attendanceStatus,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

    /*
     * Get accessible events for current user.
     */
    const accessibleEventIds =
      await getAccessibleEventIds(req);

    const query = {};

    /* =====================================================
       EVENT ACCESS
    ===================================================== */

    if (accessibleEventIds === null) {
      /*
       * SUPER_ADMIN
       *
       * Can see all events.
       */
      if (eventId) {
        if (
          !mongoose.Types.ObjectId.isValid(
            eventId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid event ID",
          });
        }

        query.eventId = eventId;
      }
    } else {
      /*
       * Other roles can ONLY see
       * assigned events.
       */

      if (eventId) {
        if (
          !mongoose.Types.ObjectId.isValid(
            eventId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid event ID",
          });
        }

        if (
          !accessibleEventIds.includes(
            eventId.toString()
          )
        ) {
          return res.status(403).json({
            success: false,
            message:
              "You do not have access to this event",
          });
        }

        query.eventId = eventId;
      } else {
        /*
         * No event filter.
         *
         * Restrict MongoDB query to assigned
         * events instead of loading everything.
         */
        query.eventId = {
          $in: accessibleEventIds,
        };
      }
    }

    /* =====================================================
       ATTENDANCE FILTER
    ===================================================== */

    if (attendanceStatus) {
      const validStatuses = [
        "NOT_CHECKED_IN",
        "CHECKED_IN",
      ];

      if (
        !validStatuses.includes(
          attendanceStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid attendance status",
        });
      }

      query.attendanceStatus =
        attendanceStatus;
    }

    /* =====================================================
       SEARCH
    ===================================================== */

    if (search?.trim()) {
      const searchText =
        search.trim();

      const regex = new RegExp(
        searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        ),
        "i"
      );

      query.$or = [
        {
          registrationId:
            regex,
        },
        {
          name: regex,
        },
        {
          collegeId: regex,
        },
        {
          email: regex,
        },
        {
          phone: regex,
        },
      ];
    }

    /* =====================================================
       TOTAL
    ===================================================== */

    const total =
      await Participant.countDocuments(
        query
      );

    const totalPages = Math.max(
      Math.ceil(
        total / limitNumber
      ),
      1
    );

    /*
     * If requested page is beyond
     * available pages, normalize it.
     */
    const currentPage = Math.min(
      pageNumber,
      totalPages
    );

    const skip =
      (currentPage - 1) *
      limitNumber;

    /* =====================================================
       FETCH
    ===================================================== */

    const participants =
      await Participant.find(query)
        .populate(
          "eventId",
          "title slug category description imageUrl date startTime endTime venue fee registrationStart registrationEnd"
        )
        .populate(
          "teamId",
          "teamId name leaderId status"
        )
        .populate(
          "checkedInBy",
          "name username role"
        )
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean();

    return res.status(200).json({
      success: true,

      participants,

      pagination: {
        page: currentPage,
        limit: limitNumber,
        total,
        totalPages,

        hasNextPage:
          currentPage <
          totalPages,

        hasPreviousPage:
          currentPage > 1,
      },
    });
  } catch (error) {
    console.error(
      "Get participants error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Failed to load participants",
    });
  }
};

/* =========================================================
   GET PARTICIPANT BY ID
========================================================= */

const getParticipantById =
  async (req, res) => {
    try {
      const {
        participantId,
      } = req.params;

      if (!participantId) {
        return res.status(400).json({
          success: false,
          message:
            "Participant ID is required",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          participantId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid participant ID",
        });
      }

      const participant =
        await Participant.findById(
          participantId
        )
          .populate(
            "eventId",
            "title slug category description imageUrl date startTime endTime venue fee registrationStart registrationEnd"
          )
          .populate(
            "teamId",
            "teamId name leaderId status"
          )
          .populate(
            "checkedInBy",
            "name username role"
          )
          .lean();

      if (!participant) {
        return res.status(404).json({
          success: false,
          message:
            "Participant not found",
        });
      }

      /* ===================================================
         EVENT ACCESS CHECK
      =================================================== */

      await checkParticipantEventAccess(
        req,
        participant.eventId?._id
      );

      return res.status(200).json({
        success: true,
        participant,
      });
    } catch (error) {
      console.error(
        "Get participant by ID error:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.statusCode
            ? error.message
            : "Failed to load participant",
      });
    }
  };

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getParticipants,
  getParticipantById,
};