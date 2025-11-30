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
  processStart,
  processFailure,
  getMasterTestsSuccess,
  getTestsSuccess,
  addTestSuccess,
  updateTestSuccess,
  deleteTestSuccess,
  getPackagesSuccess,
  addPackageSuccess,
  updatePackageSuccess,
  deletePackageSuccess,
} from "./testRedux";

import {
  orderProcessStart,
  orderProcessFailure,
  getOrdersSuccess,
  patientSearchSuccess,
  createOrderSuccess,
} from "./orderRedux";

import { setInstitutionDetails, setInstitutionStatus } from "./InstitutionRedux";

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

export const getInstitutionStatus = async (dispatch) => {
  try {
    const response = await publicRequest.get("/institutions/status");

    dispatch(setInstitutionStatus(response.data));
  } catch (error) {
    console.error("Error fetching brand details:", error);
  }
};

// --- MASTER CATALOG ---
export const searchMasterCatalog = async (dispatch, query) => {
  dispatch(processStart());
  try {
    const res = await userRequest.get(`/tests/master-catalog?search=${query}`);
    dispatch(getMasterTestsSuccess(res.data));
  } catch (err) {
    dispatch(processFailure());
  }
};

// --- LOCAL TESTS ---
export const getMyTests = async (dispatch) => {
  dispatch(processStart());
  try {
    const res = await userRequest.get("/tests");
    dispatch(getTestsSuccess(res.data));
  } catch (err) {
    dispatch(processFailure());
  }
};

export const addTestFromMaster = async (dispatch, testData) => {
  dispatch(processStart());
  try {
    const res = await userRequest.post("/tests", testData);
    dispatch(addTestSuccess(res.data));
    return { status: 201 };
  } catch (err) {
    dispatch(processFailure());
    return { status: err.response?.status, message: err.response?.data?.message };
  }
};

export const updateMyTest = async (dispatch, id, updates) => {
  dispatch(processStart());
  try {
    const res = await userRequest.put(`/tests/${id}`, updates);
    dispatch(updateTestSuccess(res.data));
    return { status: 200 };
  } catch (err) {
    dispatch(processFailure());
    return { status: 500 };
  }
};

export const deleteMyTest = async (dispatch, id) => {
  dispatch(processStart());
  try {
    await userRequest.delete(`/tests/${id}`);
    dispatch(deleteTestSuccess(id));
  } catch (err) {
    dispatch(processFailure());
  }
};

// --- PACKAGES ---
export const getPackages = async (dispatch) => {
  dispatch(processStart());
  try {
    const res = await userRequest.get("/tests/packages");
    dispatch(getPackagesSuccess(res.data));
  } catch (err) {
    dispatch(processFailure());
  }
};

export const createPackage = async (dispatch, packageData) => {
  dispatch(processStart());
  try {
    const res = await userRequest.post("/tests/packages", packageData);
    dispatch(addPackageSuccess(res.data));
    return { status: 201 };
  } catch (err) {
    dispatch(processFailure());
    return { status: err.response?.status, message: err.response?.data?.message };
  }
};

export const updatePackage = async (dispatch, id, packageData) => {
  dispatch(processStart());
  try {
    const res = await userRequest.put(`/tests/packages/${id}`, packageData);
    dispatch(updatePackageSuccess(res.data));
    return { status: 200 };
  } catch (err) {
    dispatch(processFailure());
  }
};

export const deletePackage = async (dispatch, id) => {
  dispatch(processStart());
  try {
    await userRequest.delete(`/tests/packages/${id}`);
    dispatch(deletePackageSuccess(id));
  } catch (err) {
    dispatch(processFailure());
  }
};


export const createCustomTest = async (dispatch, testData) => {
  dispatch(processStart());
  try {
    const res = await userRequest.post("/tests/custom", testData);
    dispatch(addTestSuccess(res.data));
    return { status: 201, data: res.data };
  } catch (err) {
    dispatch(processFailure());
    return {
      status: err.response?.status || 500,
      message: err.response?.data?.message || "Creation failed"
    };
  }
};

// --- GET SINGLE TEST DETAILS ---
export const getTestDetails = async (id) => {
  try {
    const res = await userRequest.get(`/tests/${id}`);
    return { status: 200, data: res.data };
  } catch (err) {
    return { 
      status: err.response?.status || 500, 
      message: err.response?.data?.message || "Fetch failed" 
    };
  }
};

// --- ORDERS ---
export const getOrders = async (dispatch, filters = {}) => {
  dispatch(orderProcessStart());
  try {
    let qs = "";
    if (filters.search) qs += `&search=${filters.search}`;
    if (filters.startDate) qs += `&startDate=${filters.startDate}`;
    if (filters.endDate) qs += `&endDate=${filters.endDate}`;

    const res = await userRequest.get(`/orders?${qs}`);
    dispatch(getOrdersSuccess(res.data));
  } catch (err) {
    dispatch(orderProcessFailure());
  }
};

export const createOrder = async (dispatch, orderData) => {
  dispatch(orderProcessStart());
  try {
    const res = await userRequest.post("/orders", orderData);
    dispatch(createOrderSuccess(res.data));
    return { status: 201, data: res.data };
  } catch (err) {
    dispatch(orderProcessFailure());
    return { status: 500, message: err.response?.data?.message || "Error" };
  }
};

// --- PATIENTS ---
export const searchPatients = async (dispatch, query) => {
  try {
    const res = await userRequest.get(`/patients/search?query=${query}`);
    dispatch(patientSearchSuccess(res.data));
    return res.data;
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const createGlobalPatient = async (patientData) => {
  try {
    const res = await userRequest.post("/patients", patientData);
    return { status: 201, data: res.data };
  } catch (err) {
    return { 
        status: err.response?.status || 500, 
        message: err.response?.data?.message || "Failed to create patient" 
    };
  }
};