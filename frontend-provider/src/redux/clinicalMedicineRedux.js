import { createSlice } from "@reduxjs/toolkit";

const clinicalMedicineSlice = createSlice({
  name: "clinicalMedicine",
  initialState: {
    clinicalMedicines: [],
    isFetching: false,
    error: false,
  },
  reducers: {
    getClinicalMedicinesStart: (state) => {
      state.isFetching = true;
      state.error = false;
    },
    getClinicalMedicinesSuccess: (state, action) => {
      state.isFetching = false;
      state.clinicalMedicines = action.payload;
    },
    getClinicalMedicinesFailure: (state) => {
      state.isFetching = false;
      state.error = true;
    }
  },
});

export const { 
    getClinicalMedicinesStart, 
    getClinicalMedicinesSuccess, 
    getClinicalMedicinesFailure 
} = clinicalMedicineSlice.actions;

export default clinicalMedicineSlice.reducer;