import React, { useEffect, useState } from 'react';
import { Typography, message, Button, Drawer, Divider, Space } from 'antd';
import { PlusOutlined, DatabaseOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { getClinicalTests, createClinicalTest, updateClinicalTest, deleteClinicalTest } from '../../redux/apiCalls';

import ClinicalTestForm from './ClinicalTestForm';
import ClinicalTestTable from './ClinicalTestTable';
import ClinicalMasterImportModal from './ClinicalMasterImportModal';

const { Title, Text } = Typography;

const ClinicalTestManager = () => {
    const dispatch = useDispatch();
    
    // Connect to Redux
    const { clinicalTests, isFetching } = useSelector(
        (state) => state[process.env.REACT_APP_CLINICAL_TESTS_KEY] || { clinicalTests: [], isFetching: false }
    );

    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // UI states
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [importModalVisible, setImportModalVisible] = useState(false);

    useEffect(() => {
        getClinicalTests(dispatch);
    }, [dispatch]);

    // Handle Custom Test Save
    const handleSaveCustom = async (values) => {
        setSaving(true);
        try {
            if (editingItem) {
                await updateClinicalTest(dispatch, editingItem._id, values);
                message.success("Test updated successfully");
                setEditingItem(null); 
            } else {
                await createClinicalTest(dispatch, values); // Single item creation
                message.success("Custom Test added successfully");
            }
        } catch (error) {
            message.error("Failed to save test");
        } finally {
            setSaving(false);
        }
    };

    // Handle Master Catalog Bulk Import
    const handleImportMaster = async (testArray) => {
        setSaving(true);
        try {
            await createClinicalTest(dispatch, testArray); // API handles Array insertion
            message.success(`${testArray.length} tests imported successfully!`);
            setImportModalVisible(false);
        } catch (error) {
            message.error("Failed to import tests");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteClinicalTest(dispatch, id);
            message.success("Test deleted");
            if (editingItem && editingItem._id === id) {
                setEditingItem(null);
            }
        } catch (error) {
            message.error("Failed to delete test");
        }
    };

    const handleEdit = (record) => {
        setEditingItem(record);
        setDrawerVisible(true); 
        
        const drawerBody = document.querySelector('.ant-drawer-body');
        if (drawerBody) drawerBody.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeDrawer = () => {
        setDrawerVisible(false);
        setEditingItem(null); 
    };

    return (
        <div>
            {/* MAIN PAGE HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Clinical Tests</Title>
                    <Text type="secondary">Manage laboratory and imaging tests available for EMR prescriptions.</Text>
                </div>
                <Space>
                    <Button icon={<CloudDownloadOutlined />} onClick={() => setImportModalVisible(true)}>
                        Import from Catalog
                    </Button>
                    <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>
                        Custom Tests Workspace
                    </Button>
                </Space>
            </div>

            {/* MAIN PAGE DATA GRID */}
            <ClinicalTestTable 
                tests={clinicalTests} 
                loading={isFetching} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
            />

            {/* FULL PAGE DRAWER WORKSPACE */}
            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <DatabaseOutlined style={{ marginRight: 8, fontSize: '20px', color: '#1890ff' }}/>
                        <span style={{ fontSize: '18px', fontWeight: 600 }}>
                            {editingItem ? "Edit Clinical Test" : "Rapid Test Entry Workspace"}
                        </span>
                    </div>
                }
                width="100%"
                onClose={closeDrawer}
                open={drawerVisible}
                destroyOnClose={false}
                styles={{ body: { backgroundColor: '#f4f6f8', padding: '24px' } }}
            >
                <ClinicalTestForm 
                    editingItem={editingItem} 
                    onSave={handleSaveCustom} 
                    onCancel={() => setEditingItem(null)} 
                    loading={saving}
                />

                <Divider style={{ margin: '32px 0', borderColor: '#d9d9d9' }} />

                <div style={{ marginBottom: 16 }}>
                    <Title level={4} style={{ margin: 0 }}>Catalog Preview</Title>
                    <Text type="secondary">Verify entries instantly. Click the edit icon to modify a custom test.</Text>
                </div>

                <ClinicalTestTable 
                    tests={clinicalTests} 
                    loading={isFetching} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete} 
                />
            </Drawer>

            {/* IMPORT MODAL */}
            <ClinicalMasterImportModal 
                visible={importModalVisible}
                onClose={() => setImportModalVisible(false)}
                onImport={handleImportMaster}
                loading={saving}
                existingTests={clinicalTests}
            />
        </div>
    );
};

export default ClinicalTestManager;