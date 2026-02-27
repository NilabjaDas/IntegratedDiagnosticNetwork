import React from 'react';
import styled from 'styled-components';
import { useParams, Navigate } from 'react-router-dom';
import DoctorManager from '../components/ClinicalManager/DoctorManager';
import BlankPage from './BlankPage';
import ClinicalMedicineManager from '../components/ClinicalManager/ClinicalMedicineManager';
import ClinicalTestManager from '../components/ClinicalManager/ClinicalTestManager';

const PageContainer = styled.div`
  padding: 24px;
  background-color: #f4f6f8;
  min-height: 100vh;
`;

const ClinicalPage = () => {
    const { tab } = useParams();

    const renderContent = () => {
        switch (tab) {
            case 'doctors':
                return <DoctorManager />;
            case 'medicine':
                return <ClinicalMedicineManager/>;
            case 'tests':
                return <ClinicalTestManager/>;
            default:
                return <Navigate to="/clinical-management/doctors" replace />;
        }
    };

    return (
        <PageContainer>
            {renderContent()}
        </PageContainer>
    );
};

export default ClinicalPage;