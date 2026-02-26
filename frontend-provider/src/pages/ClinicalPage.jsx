import React from 'react';
import styled from 'styled-components';
import { useParams, Navigate } from 'react-router-dom';
import DoctorManager from '../components/DoctorManager/DoctorManager';
import BlankPage from './BlankPage';

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
                return <BlankPage title="Medicine Catalog" />;
            case 'tests':
                return <BlankPage title="Clinical Tests Configuration" />;
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