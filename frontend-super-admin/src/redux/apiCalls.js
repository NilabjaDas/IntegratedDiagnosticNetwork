import { message } from "antd";
import { adminRequest, publicRequest, userRequest } from "../requestMethods";
import CryptoJS from "crypto-js";
import {
  getDesignation,
  getModules,
  getName,
  getProperties,
  getTokenFailure,
  getTokenStart,
  getTokenSuccess,
  setKey,
  setPropertyNames,
  setRatePlans,
  setRoomTypes,
  setUsername,
  setAnalyticsData,
  tokenFailureMessage,
  setMasterReportsData,
} from "./tokenRedux";
import { viewPortData } from "./uiRedux";
import { setBrandDetails } from "./brandRedux";
import { persistor } from "./store";

const decryptFunction = (payload, passKey) => {
  const bytes = CryptoJS.AES.decrypt(payload, passKey);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

//Get Encryption Key
export const getKey = async (dispatch) => {
  try {
    const res = await userRequest.get("/auth/connect");
    dispatch(setKey(res.data));
  } catch (error) {}
};

//Ping for Token Validity Check
export const getPing = async () => {
  try {
    const res = await userRequest.get("/auth/brand-ping");
    return res.status;
  } catch (error) {
    return error.status;
  }
};

//Admin Login
export const adminLogin = async (dispatch, username, password) => {
  dispatch(getTokenStart());
  try {
    const res = await publicRequest.post("/admin-master/login", {
      username,
      password,
    });

    dispatch(setUsername(username));
    dispatch(getTokenSuccess(res?.data?.accessToken));
    dispatch(getProperties(res?.data?.properties));
    dispatch(getModules(res?.data?.modules));
    dispatch(getName(res?.data?.name));
    dispatch(getDesignation(res?.data?.designation));
    getKey(dispatch);
    return { status: 200 };
  } catch (error) {
    dispatch(getTokenFailure());
    dispatch(tokenFailureMessage(error.response?.data.message));
    return { status: 400, message: error.response?.data.message };
  }
};

//Get Brand Details
export const getBrandDetails = async (dispatch) => {
  try {
    const response = await publicRequest.get("/admin/brand-details");

    dispatch(setBrandDetails(response.data));
  } catch (error) {
    console.error("Error fetching brand details:", error);
  }
};


