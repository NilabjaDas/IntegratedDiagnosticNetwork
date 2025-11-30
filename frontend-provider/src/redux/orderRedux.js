import { createSlice } from "@reduxjs/toolkit";

const orderSlice = createSlice({
  name: "order",
  initialState: {
    orders: [],
    searchResults: [], // For patients
    isFetching: false,
    error: false,
  },
  reducers: {
    orderProcessStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    orderProcessFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    },
    getOrdersSuccess: (state, action) => {
      state.isFetching = false;
      state.orders = action.payload;
    },
    patientSearchSuccess: (state, action) => {
      state.isFetching = false;
      state.searchResults = action.payload;
    },
    createOrderSuccess: (state, action) => {
      state.isFetching = false;
      state.orders.unshift(action.payload); // Add new order to top
    },
  },
});

export const {
  orderProcessStart,
  orderProcessFailure,
  getOrdersSuccess,
  patientSearchSuccess,
  createOrderSuccess,
} = orderSlice.actions;

export default orderSlice.reducer;