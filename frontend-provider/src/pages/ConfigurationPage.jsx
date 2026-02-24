import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Tabs, Typography, message, Spin, Alert } from 'antd';
import { useDispatch, useSelector } from "react-redux";
import { 
    SettingOutlined, 
    BankOutlined, 
    IdcardOutlined, 
    CreditCardOutlined, 
    FilePdfOutlined,
    CloudDownloadOutlined,
    AppstoreOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';

import { fetchMyInstitutionSettings, updateMyInstitutionSettings } from '../redux/apiCalls';
import { getTenentTemplateLibrary, createTemplate, updateTemplate, deleteTemplate } from "../redux/apiCalls"; 

import TemplateEditor from '../components/TemplateEditor';
import TemplateLibrary from '../components/TemplateLibrary';
import GeneralSettings from '../components/Configuration/GeneralSettings';
import InfrastructureSettings from '../components/Configuration/InfrastructureSettings';
import IdentitySettings from '../components/Configuration/IdentitySettings';
import BillingSettings from '../components/Configuration/BillingSettings';
import PatientPortalSettings from '../components/Configuration/PatientPortalSettings';
import ComplianceSettings from '../components/Configuration/ComplianceSettings';

const { Title, Text } = Typography;

const PageContainer = styled.div`
  padding: 32px;
  min-height: 100vh;
  background-color: #f4f6f8;
`;

const HeaderSection = styled.div`
  margin-bottom: 32px;
`;

const StyledTabs = styled(Tabs)`
  .ant-tabs-tab {
    padding: 16px 24px;
    font-size: 15px;
    font-weight: 500;
  }
  .ant-tabs-content-holder {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    min-height: 600px;
  }
`;

const ConfigurationPage = () => {
    const dispatch = useDispatch();
    
    const [settingsData, setSettingsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const { printTemplates } = useSelector((state) => state[process.env.REACT_APP_TEMPLATELIBRARY_DATA_KEY] || { printTemplates: [] });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            await getTenentTemplateLibrary(dispatch, "PRINT");
            const data = await fetchMyInstitutionSettings();
            if (data) setSettingsData(data);
        } catch (error) {
            console.error("Error loading configuration data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTemplate = async (initialData) => {
        try {
            const newTemplate = await createTemplate(dispatch, initialData);
            message.success("Template created successfully");
            return newTemplate;
        } catch (error) {
            message.error("Failed to create template");
        }
    };

    const handleUpdateTemplate = async (id, data) => {
        try {
            await updateTemplate(dispatch, id, data);
            message.success("Template saved successfully");
        } catch (error) {
            message.error("Failed to save changes");
        }
    };

    const handleDeleteTemplate = async (id) => {
        try {
            await deleteTemplate(dispatch, id);
            message.success("Template deleted");
        } catch (error) {
            message.error("Failed to delete template");
        }
    };

    const handleSaveSettings = async (updatedFields) => {
        console.log(updatedFields)
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

    const tabItems = [
        {
            key: 'identity',
            label: <span><IdcardOutlined /> Branding & Contact</span>,
            children: <IdentitySettings data={settingsData} onSave={handleSaveSettings} loading={saving} />,
        },
        {
            key: 'general',
            label: <span><SettingOutlined /> General & Formats</span>,
            children: <GeneralSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />,
        }
    ];

 if (isPathology) {
        tabItems.push({
            key: 'infrastructure',
            label: <span><BankOutlined /> Facilities & Rooms</span>,
            children: <InfrastructureSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />,
        });
    }

    tabItems.push(
        {
            key: 'portal',
            label: <span><AppstoreOutlined /> Patient Portal</span>,
            children: <PatientPortalSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />,
        },
        {
            key: 'compliance',
            label: <span><SafetyCertificateOutlined /> Data & Compliance</span>,
            children: <ComplianceSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />,
        },
        {
            key: 'billing',
            label: <span><CreditCardOutlined /> Billing & Taxes</span>,
            children: <BillingSettings data={settingsData} onSave={handleSaveSettings} loading={saving} />,
        },
        {
            key: 'templates_mine',
            label: <span><FilePdfOutlined /> My Templates</span>,
            children: (
                <div style={{ padding: '24px' }}>
                    <Title level={4}>Custom Templates</Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
                        Design and manage your custom PDF and print templates for reports, invoices, and receipts.
                    </Text>
                    <TemplateEditor 
                        templates={printTemplates || []} 
                        onCreate={handleCreateTemplate} 
                        onUpdate={handleUpdateTemplate} 
                        onDelete={handleDeleteTemplate} 
                    />
                </div>
            ),
        },
        {
            key: 'templates_library',
            label: <span><CloudDownloadOutlined /> Template Library</span>,
            children: (
                <div style={{ padding: '24px' }}>
                    <Title level={4}>Global Template Library</Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
                        Import pre-built, industry-standard templates into your workspace to save time.
                    </Text>
                    <TemplateLibrary />
                </div>
            ),
        }
    );

    return (
        <PageContainer>
            <HeaderSection>
                <Title level={2} style={{ margin: 0 }}>System Configuration</Title>
                <Text type="secondary">Manage {settingsData.institutionName || 'your institution'} settings.</Text>
            </HeaderSection>
            
            <StyledTabs 
                tabPosition="left" 
                items={tabItems} 
                destroyInactiveTabPane={true} 
            />
        </PageContainer>
    );
};

export default ConfigurationPage;