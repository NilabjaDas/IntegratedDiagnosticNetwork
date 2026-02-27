import React, { useEffect, useState, useMemo } from 'react';
import { Typography, message, Button, Drawer, Divider } from 'antd';
import { PlusOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { getClinicalMedicines, createClinicalMedicine, updateClinicalMedicine, deleteClinicalMedicine } from '../../redux/apiCalls';

import MedicineForm from './ClinicalMedicineForm';
import MedicineTable from './ClinicalMedicineTable';

const { Title, Text } = Typography;

const ClinicalMedicineManager = () => {
    const dispatch = useDispatch();
    
    const { clinicalMedicines, isFetching } = useSelector(
        (state) => state[process.env.REACT_APP_CLINICAL_MEDICINES_KEY] || { clinicalMedicines: [], isFetching: false }
    );

    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);

    useEffect(() => {
        getClinicalMedicines(dispatch);
    }, [dispatch]);

    // --- NEW: Extract unique indications from all medicines ---
    const existingIndications = useMemo(() => {
        const indications = new Set();
        clinicalMedicines.forEach(m => {
            if (Array.isArray(m.treatmentFor)) {
                m.treatmentFor.forEach(t => indications.add(t));
            }
        });
        return Array.from(indications).sort().map(i => ({ value: i, label: i }));
    }, [clinicalMedicines]);

    const handleSave = async (values) => {
        setSaving(true);
        try {
            if (editingItem) {
                await updateClinicalMedicine(dispatch, editingItem._id, values);
                message.success("Medicine updated successfully");
                setEditingItem(null); 
            } else {
                await createClinicalMedicine(dispatch, values);
                message.success("Medicine added successfully");
            }
        } catch (error) {
            message.error("Failed to save medicine");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteClinicalMedicine(dispatch, id);
            message.success("Medicine deleted");
            if (editingItem && editingItem._id === id) {
                setEditingItem(null);
            }
        } catch (error) {
            message.error("Failed to delete medicine");
        }
    };

    const handleEdit = (record) => {
        setEditingItem(record);
        setDrawerVisible(true); 
        
        const drawerBody = document.querySelector('.ant-drawer-body');
        if (drawerBody) {
            drawerBody.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const closeDrawer = () => {
        setDrawerVisible(false);
        setEditingItem(null); 
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Medicine Catalog</Title>
                    <Text type="secondary">Manage medicines available for EMR prescriptions.</Text>
                </div>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>
                    Add / Manage Medicines
                </Button>
            </div>

            <MedicineTable 
                medicines={clinicalMedicines} 
                loading={isFetching} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
            />

            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <DatabaseOutlined style={{ marginRight: 8, fontSize: '20px', color: '#1890ff' }}/>
                        <span style={{ fontSize: '18px', fontWeight: 600 }}>
                            {editingItem ? "Edit Medicine Entry" : "Rapid Medicine Entry Workspace"}
                        </span>
                    </div>
                }
                width="100%"
                onClose={closeDrawer}
                open={drawerVisible}
                destroyOnClose={false}
                styles={{ body: { backgroundColor: '#f4f6f8', padding: '24px' } }}
            >
                <MedicineForm 
                    editingItem={editingItem} 
                    onSave={handleSave} 
                    onCancel={() => setEditingItem(null)} 
                    loading={saving}
                    existingIndications={existingIndications} // <-- Passed down to form
                />

                <Divider style={{ margin: '32px 0', borderColor: '#d9d9d9' }} />

                <div style={{ marginBottom: 16 }}>
                    <Title level={4} style={{ margin: 0 }}>Catalog Preview</Title>
                    <Text type="secondary">Verify entries instantly. Click the edit icon to modify an existing medicine.</Text>
                </div>

                <MedicineTable 
                    medicines={clinicalMedicines} 
                    loading={isFetching} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete} 
                />
            </Drawer>
        </div>
    );
};

export default ClinicalMedicineManager;