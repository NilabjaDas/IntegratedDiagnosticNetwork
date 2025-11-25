import { createSlice } from "@reduxjs/toolkit";

export const tokenSlice = createSlice({
  name: "accessToken",
  initialState: {
    token: "",
    masterToken: "",
    username: "",
    name: "",
    designation: "",
    modules: "",
    properties: [],
    isFetching: false,
    error: false,
    errorMessage: "",
    key: "",
    propertyNames: [],
    roomTypesPropertyWise: [],
    analyticsData : {},
  },
  reducers: {
    getTokenStart: (state) => {
      state.isFetching = true;
      state.error = false;
      state.errorMessage = "Please wait..."
    },
    getTokenSuccess: (state, action) => {
      state.isFetching = false;
      state.token = action.payload;
      state.errorMessage = ""
    },
    getTokenFailure: (state) => {
      state.username = "";
      state.token = "";
      state.isFetching = false;
      state.error = true;
      state.errorMessage = "";
      state.modules = [];
      state.properties = [];
    },
    tokenFailureMessage: (state,action) => {
      state.token = "";
      state.isFetching = false;
      state.error = true;
      state.errorMessage = action.payload;
    },
    setUsername: (state, action) => {
      state.username = action.payload;
    },
    setKey: (state, action) => {
      state.key = action.payload;
    },
    setMasterToken: (state, action) => {
      state.masterToken = action.payload;
    },
     getModules: (state, action) => {
      state.isFetching = false;
      state.modules = action.payload;
      state.errorMessage = ""
    },
     getProperties: (state, action) => {
      state.isFetching = false;
      state.properties = action.payload;
      state.errorMessage = ""
    },
    getName:(state, action) => {
      state.name = action.payload;
    },
     getDesignation:(state, action) => {
      state.designation = action.payload;
    },
     setPropertyNames : (state, action) => {
      state.propertyNames = action.payload;
    },
     setRoomTypes : (state, action) => {
      state.roomTypesPropertyWise = action.payload;
    },
     setRatePlans : (state, action) => {
      state.ratePlansPropertyWise = action.payload;
    },
    setAnalyticsData : (state, action) => {
      state.analyticsData = action.payload;
    },
    setMasterReportsData : (state, action) => {
      state.masterReportsData = action.payload;
    },
    
  },
});

export const {
  getTokenStart,
  getTokenSuccess,
  getTokenFailure,
  tokenFailureMessage,
  setUsername,
  getName,
  getDesignation,
  setKey,
  setMasterToken,
  getModules,
  getProperties,
  setPropertyNames,
  setRoomTypes,
  setRatePlans,
  setAnalyticsData,
  setMasterReportsData
} = tokenSlice.actions;

export default tokenSlice.reducer;
