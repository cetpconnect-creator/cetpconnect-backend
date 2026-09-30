// middleware/upload.js

const multer = require("multer");
const {
  CloudinaryStorage,
} = require("multer-storage-cloudinary");

const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,

  params: async (req, file) => {
    const isPaymentQr =
      file.fieldname === "paymentQr";

    return {
      folder: isPaymentQr
        ? "cetpconnect/payment-qrs"
        : "cetpconnect/event-posters",

      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "webp",
      ],

      resource_type: "image",
    };
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, JPEG, PNG and WEBP images are allowed."
        )
      );
    }

    cb(null, true);
  },
});

module.exports = upload;