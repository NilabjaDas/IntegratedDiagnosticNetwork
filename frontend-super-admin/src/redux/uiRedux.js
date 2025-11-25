import { createSlice } from "@reduxjs/toolkit";

const uiReduxSlice = createSlice({
  name: "ui",
  initialState: {
    scheduledMaintenance: {
      activeStatus: false,
      startTime: "",
      endTime: "",
      updateInfo: "",
      updateDescription: "",
    },
    lastViewPort: 0,
    viewPortBeingUsed: 0,
    subViewPortBeingUsed: 0,
    defaultCurrency: {},
    bookingCreated: false,
    bookingDataStored: {},
  },
  reducers: {
    setScheduledMaintenanceData: (state, action) => {
      state.scheduledMaintenance = action.payload;
    },

    viewPortData: (state, action) => {
      state.viewPortBeingUsed = action.payload;
    },
    subViewPortData: (state, action) => {
      state.subViewPortBeingUsed = action.payload;
    },
    defaultCurrencyData: (state, action) => {
      state.defaultCurrency = action.payload;
    },
    bookingCreatedData: (state, action) => {
      state.bookingCreated = action.payload;
    },
    bookingStoredData: (state, action) => {
      state.bookingDataStored = action.payload;
    },
    lastViewPortData: (state, action) => {
      state.lastViewPort = action.payload;
    },
    
  },
});

export const {
  setScheduledMaintenanceData,
  viewPortData,
  subViewPortData,
  defaultCurrencyData,
  bookingCreatedData,
  bookingStoredData,
  lastViewPortData,
} = uiReduxSlice.actions;

export default uiReduxSlice.reducer;
