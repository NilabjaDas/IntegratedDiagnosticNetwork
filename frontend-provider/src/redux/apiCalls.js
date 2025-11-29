import { publicRequest, userRequest } from "../requestMethods";
import {
  getDesignation,
  getModules,
  getName,
  getProperties,
  getTokenFailure,
  getTokenStart,
  getTokenSuccess,
  setKey,
  setUsername,
  tokenFailureMessage,
} from "./tokenRedux";
import { setInstitutionDetails } from "./InstitutionRedux";

//Get Encryption Key
export const getKey = async (dispatch) => {
  try {
    const res = await userRequest.get("/authenticate/connect");
    dispatch(setKey(res.data));
  } catch (error) {
    console.error("Failed to get key:", error);
  }
};

//Ping for Token Validity Check
export const getPing = async () => {
  try {
    const res = await userRequest.get("/authenticate/ping");
    return res.status;
  } catch (error) {
    return error.status;
  }
};

//Staff Login
export const staffLogin = async (dispatch, username, password) => {
  dispatch(getTokenStart());
  try {
    const res = await publicRequest.post("/authenticate/login-staff", {
      username,
      password,
    });

    dispatch(setUsername(username));
    dispatch(getTokenSuccess(res?.data?.token));
    dispatch(getModules(res?.data?.modules));
    dispatch(getName(res?.data?.user?.fullName));
    getKey(dispatch);
    return { status: 200 };
  } catch (error) {
    dispatch(getTokenFailure());
    dispatch(tokenFailureMessage(error.response?.data.message));
    return { status: 400, message: error.response?.data.message };
  }
};

//Get Brand Details
export const getInstitutionDetails = async (dispatch) => {
  try {
    const response = await publicRequest.get("/institutions/details");

    dispatch(setInstitutionDetails(response.data));
  } catch (error) {
    console.error("Error fetching brand details:", error);
  }
};
