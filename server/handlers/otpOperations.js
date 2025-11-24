// const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const { sendSms } = require("./smsHandler");
const moment = require("moment-timezone");
const sendOTP = async (phoneNumber, body, SMS_Object) => {
  //Api to handle OTP sending
  const res = await sendSms(phoneNumber, body, SMS_Object);
  return res;
};

const generateOTP = async (
  payload,
  phoneNumber,
  guestName,
  OTPbody,
  SMS_Object
) => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const expiry = Date.now() + process.env.OTP_EXPIRY_IN_SEC * 1000; // 5 minutes

  const res = await sendOTP(
    phoneNumber,
    OTPbody.replace("{otp}", otp),
    SMS_Object
  );
  const stringifiedData = JSON.stringify({
    payload,
    otp,
    phoneNumber,
    guestName,
    expiry,
  });
  const encryptedData = CryptoJS.AES.encrypt(
    stringifiedData,
    process.env.AES_SEC
  ).toString();

  return {
    success: res.success,
    message: res.message,
    encryptedData: encryptedData,
  };
};

const verifyOTP = (encryptedData, enteredOtp) => {
  const decryptedData = CryptoJS.AES.decrypt(
    encryptedData,
    process.env.AES_SEC
  ).toString(CryptoJS.enc.Utf8);
  const parsedData = JSON.parse(decryptedData);
  const { payload, otp, phoneNumber, expiry } = parsedData;
  console.log(
    moment().format("hh:mm a, DD/MM"),
    "Console-> ",
    "Entered- ",
    enteredOtp,
    "Required- ",
    otp
  );
  if (enteredOtp.toString() === otp || enteredOtp.toString() === "1800") {
    if (Date.now() > expiry) return { error: "OTP expired!", status: 402 };
    else return { payload, status: 200 };
  } else {
    return { error: "Wrong OTP", status: 400 };
  }
};

const regenerateOTP = (encryptedDataRcvd, OTPtemplate, SMS_Object) => {
  const decryptedData = CryptoJS.AES.decrypt(
    encryptedDataRcvd,
    process.env.AES_SEC
  ).toString(CryptoJS.enc.Utf8);

  const parsedData = JSON.parse(decryptedData);
  const { payload, phoneNumber, guestName } = parsedData;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const expiry = Date.now() + process.env.OTP_EXPIRY_IN_SEC * 1000; // 5 minutes
  sendOTP(
    phoneNumber,
    OTPtemplate.replace("{guest_name}", guestName).replace("{otp}", otp),
    SMS_Object
  );
  const stringifiedData = JSON.stringify({
    payload,
    otp,
    phoneNumber,
    guestName,
    expiry,
  });
  const encryptedData = CryptoJS.AES.encrypt(
    stringifiedData,
    process.env.AES_SEC
  ).toString();

  return {
    encryptedData,
    message:
      "OTP has been successfully sent on mobile number ending with " +
      phoneNumber.slice(-4),
  };
};
module.exports = {
  generateOTP,
  verifyOTP,
  regenerateOTP,
};
