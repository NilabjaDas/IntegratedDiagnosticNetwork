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

import {
  getTestsStart,
  getTestsSuccess,
  getTestsFailure,
} from "./baseTestRedux";

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

export const activateInstitution = async (id) => {
  try {
    const res = await userRequest.put(`/admin-master/institutions/${id}/activate`);
    return { status: 200, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Activation failed" 
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

export const editInstitution = async (id, institutionData) => {
  try {
    const res = await userRequest.put(`/admin-master/institutions/${id}`,institutionData);
    return { status: 200, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Edit failed" 
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

export const getInstitutionUsers = async (institutionId) => {
  try {
    // Note: Route is /admin-master/institutions/:id/users
    const res = await userRequest.get(`/admin-master/institutions/${institutionId}/users`);
    return { status: 200, data: res.data.data };
  } catch (error) {
    return {
      status: error.response?.status || 500,
      message: error.response?.data?.message || "Fetch users failed"
    };
  }
};

export const createInstitutionUser = async (institutionId, userData) => {
  try {
    const res = await userRequest.post(`/admin-master/institutions/${institutionId}/users`, userData);
    return { status: 201, data: res.data.data };
  } catch (error) {
    return {
      status: error.response?.status || 500,
      message: error.response?.data?.message || "Create user failed"
    };
  }
};

export const updateInstitutionUser = async (institutionId, userId, userData) => {
  try {
    const res = await userRequest.put(`/admin-master/institutions/${institutionId}/users/${userId}`, userData);
    return { status: 200, data: res.data.data };
  } catch (error) {
    return {
      status: error.response?.status || 500,
      message: error.response?.data?.message || "Update user failed"
    };
  }
};

export const deleteInstitutionUser = async (institutionId, userId) => {
  try {
    const res = await userRequest.delete(`/admin-master/institutions/${institutionId}/users/${userId}`);
    return { status: 200, data: res.data };
  } catch (error) {
    return {
      status: error.response?.status || 500,
      message: error.response?.data?.message || "Delete user failed"
    };
  }
};


export const getAllBaseTests = async (dispatch, page = 1, limit = 20, search = "", department = "") => {
  dispatch(getTestsStart());
  try {
    let url = `/admin-master/base-tests?page=${page}&limit=${limit}`;
    if (search) url += `&search=${search}`;
    if (department) url += `&department=${department}`;
    
    const res = await userRequest.get(url);
    dispatch(getTestsSuccess(res.data));
  } catch (error) {
    dispatch(getTestsFailure());
  }
};

export const createBaseTest = async (testData) => {
  try {
    const res = await userRequest.post("/admin-master/base-tests", testData);
    return { status: 201, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Creation failed" 
    };
  }
};

export const updateBaseTest = async (id, testData) => {
  try {
    const res = await userRequest.put(`/admin-master/base-tests/${id}`, testData);
    return { status: 200, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Update failed" 
    };
  }
};

export const deleteBaseTest = async (id) => {
  try {
    const res = await userRequest.delete(`/admin-master/base-tests/${id}`);
    return { status: 200, data: res.data };
  } catch (error) {
    return { 
      status: error.response?.status || 500, 
      message: error.response?.data?.message || "Deletion failed" 
    };
  }
};