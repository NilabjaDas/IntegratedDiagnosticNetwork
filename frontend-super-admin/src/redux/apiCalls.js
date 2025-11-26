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

import {
  getInstitutionsStart,
  getInstitutionsSuccess,
  getInstitutionsFailure,
} from "./institutionRedux";

import { setBrandDetails } from "./brandRedux";

//Get Encryption Key
export const getKey = async (dispatch) => {
  try {
    const res = await userRequest.get("/authenticate/connect");
    dispatch(setKey(res.data));
  } catch (error) {}
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

//Admin Login
export const adminLogin = async (dispatch, username, password) => {
  dispatch(getTokenStart());
  try {
    const res = await publicRequest.post("/authenticate/login-super-admin", {
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




export const getAllInstitutions = async (dispatch, page = 1, limit = 10, search = "") => {
  dispatch(getInstitutionsStart());
  try {
    const res = await userRequest.get(
      `/admin-master/institutions?page=${page}&limit=${limit}&search=${search}`
    );
    dispatch(getInstitutionsSuccess(res.data));
  } catch (error) {
    dispatch(getInstitutionsFailure());
  }
};

// For Create/Delete, we still return status so the Component knows to close the Modal/Drawer
// But we ALSO trigger a fetch or update the store manually if we wanted to be fancy.
// For now, simple Re-fetch strategy is safest.
export const createInstitution = async (institutionData) => {
  try {
    const res = await userRequest.post("/admin-master/institutions", institutionData);
    return { status: 201, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Creation failed" 
    };
  }
};

export const deactivateInstitution = async (id) => {
  try {
    const res = await userRequest.put(`/admin-master/institutions/${id}/deactivate`);
    return { status: 200, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Deactivation failed" 
    };
  }
};

export const deleteInstitution = async (id) => {
  try {
    const res = await userRequest.delete(`/admin-master/institutions/${id}`);
    return { status: 200, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Deletion failed" 
    };
  }
};