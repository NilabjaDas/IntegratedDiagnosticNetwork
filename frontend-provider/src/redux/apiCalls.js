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

import { getInstitutionSuccess, setInstitutionDetails, setInstitutionStatus } from "./InstitutionRedux";

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

    dispatch(setInstitutionStatus(response.data.status));
  } catch (error) {
    console.error("Error fetching brand details:", error);
  }
};

// --- MASTER CATALOG ---
export const searchMasterCatalog = async (dispatch, query, page = 1, limit = 10) => {
  dispatch(processStart());
  try {
    // Ensure empty query is handled
    const q = query ? `&search=${query}` : "";
    const res = await userRequest.get(`/tests/master-catalog?page=${page}&limit=${limit}${q}`);
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
    return { status: 500, message: err.response?.data?.message || "Error", requiresOverride: err.response?.data?.requiresOverride || false  };
  }
};

export const getOrderDetails = async (id) => {
  try {
    const res = await userRequest.get(`/orders/${id}`);
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: "Fetch failed" };
  }
};

export const cancelOrder = async (id, reason) => {
  try {
    const res = await userRequest.put(`/orders/${id}/cancel`, { reason });
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: err.response?.data?.message || "Cancellation failed" };
  }
};

export const modifyOrderItems = async (id, items) => {
  try {
    // items should be array of { _id, type }
    const res = await userRequest.put(`/orders/${id}/items`, { items });
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: err.response?.data?.message || "Modification failed" };
  }
};

export const updateOrderNotes = async (id, notes) => {
  try {
    const res = await userRequest.put(`/orders/${id}`, { notes });
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: "Update failed" };
  }
};

// --- PAYMENTS ---

// 1. Record Manual (Cash/Card)
export const recordManualPayment = async (payload) => {
  try {
    const res = await userRequest.post("/payments/record-manual", payload);
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: err.response?.status || 500, message: err.response?.data?.message || "Payment failed" };
  }
};

// 2. Initialize Online (Razorpay)
export const createRazorpayOrder = async (payload) => {
  try {
    const res = await userRequest.post("/payments/create-razorpay-order", payload);
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: "Gateway error" };
  }
};

// 3. Verify Online
export const verifyOnlinePayment = async (payload) => {
  try {
    const res = await userRequest.post("/payments/verify-upi", payload);
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: "Verification failed" };
  }
};

// 4. Send Payment Link
export const sendPaymentLink = async (payload) => {
  try {
    const res = await userRequest.post("/payments/send-payment-link", payload);
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: "Failed to send link" };
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

export const checkPaymentStatus = async (dbOrderId) => {
  try {
    const res = await userRequest.post("/payments/check-status", { dbOrderId });
    return { status: 200, data: res.data };
  } catch (err) {
    return { status: 500, message: "Check failed" };
  }
};

export const updateInstitution = async (dispatch, id, updates) => {
  // dispatch(processStart()); // Optional: if you want global loading
  try {
    const res = await userRequest.put(`/institutions/${id}`, updates);
    
    // Update the Redux store with the new institution data
    // This ensures the app reflects changes immediately without a refresh
    dispatch(getInstitutionSuccess(res.data.institution)); 
    
    return { status: 200, data: res.data };
  } catch (err) {
    // dispatch(processFailure());
    return { 
        status: err.response?.status || 500, 
        message: err.response?.data?.message || "Update failed" 
    };
  }
};

export const fetchBillPdf = async (orderId) => {
  try {
    const res = await userRequest.get(`/pdf/bill/${orderId}`, {
        responseType: 'blob' // IMPORTANT: Expect binary data
    });
    
    // Create a Blob URL
    const file = new Blob([res.data], { type: 'application/pdf' });
    const fileURL = URL.createObjectURL(file);
    
    // Open Print Window
    const pdfWindow = window.open(fileURL);
    if (pdfWindow) {
        pdfWindow.addEventListener('load', () => {
            // pdfWindow.print(); // Optional: Auto-trigger print
        });
    }
    
    return { status: 200 };
  } catch (err) {
    return { status: 500, message: "PDF Generation Failed" };
  }
};