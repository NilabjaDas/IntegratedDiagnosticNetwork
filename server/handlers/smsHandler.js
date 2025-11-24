const axios = require("axios");
const moment = require("moment-timezone");
//Send SMS
const sendSms = async (phoneNumber, body,SMS_Object) => {
  const apiKey = process.env.FAST_2_SMS_API_KEY;

   // Guard clause for null/undefined phoneNumber
   if (!phoneNumber) {
    console.log(moment().format("hh:mm a, DD/MM"), "Console-> No phone number provided.");
    return {
      success: false,
      message: "The phone number is missing, SMS will not be sent; please contact hotel staff."
    };
  }

  function formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let digits = phoneNumber.replace(/\D/g, "");
    // If there are more than 10 digits, assume extra digits are the country code and take the last 10 digits
    if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    return digits;
  }

  console.log(moment().format("hh:mm a, DD/MM"), "Console-> ", "SMS will be sent to:", formatPhoneNumber(phoneNumber));
  console.log("SMS body:", body);

  const requestBody = {
    route: "dlt_manual",
    sender_id: SMS_Object?.sender_id,
    entity_id: SMS_Object?.entity_id,
    template_id: SMS_Object?.template_id,
    message: body,
    flash: 0,
    numbers: formatPhoneNumber(phoneNumber),
  };

  const requestConfig = {
    headers: {
      authorization: apiKey, // Your Fast2SMS API key from .env
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      requestBody,
      requestConfig
    );

    console.log("SMS sent successfully:", response.data);
    return {success: true, message: response.data.message}
  } catch (error) {
    console.error(
      "Error sending SMS:",
      error.response ? error.response.data : error.message
    );
    return {
      success: false,
      message: "OTP could not be sent because the phone number is invalid; please contact hotel staff."
    }
    
  }
};

module.exports = {
  sendSms,
};
