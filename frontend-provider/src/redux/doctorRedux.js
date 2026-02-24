import { createSlice } from "@reduxjs/toolkit";

const doctorSlice = createSlice({
    name: "doctor",
    initialState: {
        doctors: [],
        isFetching: false,
        error: false,
    },
    reducers: {
        // GET ALL
        getDoctorsStart: (state) => { state.isFetching = true; state.error = false; },
        getDoctorsSuccess: (state, action) => { state.isFetching = false; state.doctors = action.payload; },
        getDoctorsFailure: (state) => { state.isFetching = false; state.error = true; },
        // CREATE
        createDoctorStart: (state) => { state.isFetching = true; },
        createDoctorSuccess: (state, action) => { state.isFetching = false; state.doctors.push(action.payload); },
        createDoctorFailure: (state) => { state.isFetching = false; state.error = true; },
        // UPDATE
        updateDoctorStart: (state) => { state.isFetching = true; },
        updateDoctorSuccess: (state, action) => {
            state.isFetching = false;
            state.doctors[state.doctors.findIndex((d) => d.doctorId === action.payload.doctorId)] = action.payload;
        },
        updateDoctorFailure: (state) => { state.isFetching = false; state.error = true; },
        // DELETE
        deleteDoctorStart: (state) => { state.isFetching = true; },
        deleteDoctorSuccess: (state, action) => {
            state.isFetching = false;
            state.doctors = state.doctors.filter(d => d.doctorId !== action.payload);
        },
        deleteDoctorFailure: (state) => { state.isFetching = false; state.error = true; },
    },
});

export const {
    getDoctorsStart, getDoctorsSuccess, getDoctorsFailure,
    createDoctorStart, createDoctorSuccess, createDoctorFailure,
    updateDoctorStart, updateDoctorSuccess, updateDoctorFailure,
    deleteDoctorStart, deleteDoctorSuccess, deleteDoctorFailure
} = doctorSlice.actions;

export default doctorSlice.reducer;