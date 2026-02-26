import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Typography, message, Spin, Alert, Card } from 'antd';
import { useParams, Navigate } from 'react-router-dom';

import { fetchMyInstitutionSettings, updateMyInstitutionSettings } from '../redux/apiCalls';

import GeneralSettings from '../components/Configuration/GeneralSettings';
import InfrastructureSettings from '../components/Configuration/InfrastructureSettings';
import IdentitySettings from '../components/Configuration/IdentitySettings';
import BillingSettings from '../components/Configuration/BillingSettings';
import PatientPortalSettings from '../components/Configuration/PatientPortalSettings';
import ComplianceSettings from '../components/Configuration/ComplianceSettings';

// Import the Template Components
import TemplateEditor from '../components/Configuration/TemplateEditor';
import TemplateLibrary from '../components/Configuration/TemplateLibrary';

const { Title, Text } = Typography;

const PageContainer = styled.div`
  padding: 24px;
  min-height: 100vh;
  background-color: #f4f6f8;
`;

const ConfigurationPage = () => {
    const { tab } = useParams(); 
    
    const [settingsData, setSettingsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchMyInstitutionSettings();
            if (data) setSettingsData(data);
        } catch (error) {
            console.error("Error loading configuration data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async (updatedFields) => {
        setSaving(true);
        try {
            const newData = await updateMyInstitutionSettings(updatedFields);
            setSettingsData(newData);
            message.success("Institution settings updated successfully!");
        } catch (error) {
            message.error("Failed to update settings.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="Loading configurations..." />
            </div>
        );
    }

    if (!settingsData) {
        return (
            <div style={{ padding: '32px' }}>
                <Alert message="Error" description="Could not load institution settings." type="error" showIcon />
            </div>
        );
    }

    const isPathology = ['pathology', 'pathologyWithDoc'].includes(settingsData.institutionType);

    // --- NEW: SPECIAL ROUTING FOR FULL-PAGE EDITORS ---
    if (tab === 'templates') {
        return <TemplateEditor />;
    }
    if (tab === 'template-library') {
        return <TemplateLibrary />;
    }

    // --- STANDARD SETTINGS TABS ---
    const renderContent = () => {
        switch (tab) {
            case 'identity': 
                return <IdentitySettings data={settingsData} onSave={handleSaveSettings} loading={saving} />;
            case 'general': 
                return <GeneralSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />;
            case 'infrastructure': 
                return isPathology 
                    ? <InfrastructureSettings data={settingsData} onSave={handleSaveSettings} loading={saving} /> 
                    : <Alert message="Facilities & Rooms are not applicable for your institution type." type="info" showIcon />;
            case 'patient-portal': 
                return <PatientPortalSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />;
            case 'compliance': 
                return <ComplianceSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />;
            case 'billing': 
                return <BillingSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />;
            default: 
                return <Navigate to="/configuration/identity" replace />;
        }
    };

    const getTitle = () => {
        const titles = {
            'identity': 'Branding & Contact',
            'general': 'General & Formats',
            'infrastructure': 'Facilities & Rooms',
            'patient-portal': 'Patient Portal',
            'compliance': 'Data & Compliance',
            'billing': 'Billing & Taxes'
        };
        return titles[tab] || 'Configuration';
    };

    return (
        <PageContainer>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>{getTitle()}</Title>
                <Text type="secondary">Manage {settingsData.institutionName || 'your institution'} settings.</Text>
            </div>
            
            <Card style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', minHeight: '600px' }}>
                {renderContent()}
            </Card>
        </PageContainer>
    );
};

export default ConfigurationPage;