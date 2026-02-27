import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import DoctorWorkspace from '../components/DoctorEMR/DoctorWorkspace';
import BlankPage from './BlankPage';
import DoctorAppointmentBooking from '../components/DoctorEMR/DoctorAppointmentBooking';
import AssistantWorkspace from '../components/DoctorEMR/AssistantWorkspace';

const DoctorWorkspacePage = () => {
    const { tab } = useParams();

    switch (tab) {
        case 'workspace':
            return <DoctorWorkspace />;
        case 'booking':
            return <DoctorAppointmentBooking />;
        case 'assistant':
            return <AssistantWorkspace />;
        case 'reports':
            return <BlankPage title="Doctor EMR Reports" />;
        default:
            return <Navigate to="/doctor-emr/workspace" replace />;
    }
};

export default DoctorWorkspacePage;