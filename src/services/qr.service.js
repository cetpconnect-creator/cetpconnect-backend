const QRCode = require("qrcode");

const generateParticipantQR = async (qrToken) => {
  return await QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "H",
    width: 500,
    margin: 2,
  });
};

module.exports = {
  generateParticipantQR,
};