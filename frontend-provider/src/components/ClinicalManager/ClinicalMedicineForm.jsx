import React, { useEffect } from 'react';
import { Form, Input, Select, Switch, Button, Row, Col, Card, Space } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const { Option } = Select;

const ClinicalMedicineForm = ({ editingItem, onSave, onCancel, loading, existingIndications }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (editingItem) {
            form.setFieldsValue(editingItem);
        } else {
            form.resetFields();
            form.setFieldsValue({ isActive: true, type: 'Tablet', targetDemographic: 'All Ages' });
        }
    }, [editingItem, form]);

    const handleFinish = (values) => {
        onSave(values);
        if (!editingItem) {
            form.resetFields();
            form.setFieldsValue({ isActive: true, type: 'Tablet', targetDemographic: 'All Ages' });
        }
    };

    // --- NEW: Smart Dosage Formatter ---
    // If the user types pure numbers (e.g., "101"), it auto-converts to "1-0-1"
    // If they type fractions or custom text (e.g., "1/2", "SOS"), it leaves it alone
    const handleDosageChange = (e) => {
        const val = e.target.value;
        const clean = val.replace(/-/g, '');
        
        if (/^\d+$/.test(clean) && clean.length <= 4) {
            form.setFieldsValue({ defaultDosage: clean.split('').join('-') });
        } else {
            form.setFieldsValue({ defaultDosage: val });
        }
    };

    return (
        <Card 
            size="small" 
            title={editingItem ? "Edit Medicine" : "Add New Medicine"} 
            style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
            <Form 
                layout="vertical" 
                form={form} 
                onFinish={handleFinish}
                initialValues={{ isActive: true, type: 'Tablet', targetDemographic: 'All Ages' }}
            >
                <Row gutter={16}>
                    <Col span={5}>
                        <Form.Item name="name" label="Medicine Name" rules={[{ required: true, message: 'Required' }]}>
                            <Input placeholder="e.g. Calpol 500mg" autoFocus />
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item name="shortName" label="Generic Name">
                            <Input placeholder="e.g. Paracetamol" />
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item name="brand" label="Brand">
                            <Input placeholder="e.g. GSK" />
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                            <Select>
                                <Option value="Tablet">Tablet</Option>
                                <Option value="Syrup">Syrup</Option>
                                <Option value="Capsule">Capsule</Option>
                                <Option value="Injection">Injection</Option>
                                <Option value="Ointment">Ointment</Option>
                                <Option value="Drops">Drops</Option>
                                <Option value="Other">Other</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    {/* NEW FIELD */}
                    <Col span={7}>
                        <Form.Item name="targetDemographic" label="Target Demographic">
                            <Select>
                                <Option value="All Ages">All Ages</Option>
                                <Option value="Adults (12+ Yrs)">Adults (12+ Yrs)</Option>
                                <Option value="Pediatrics (0-12 Yrs)">Pediatrics (0-12 Yrs)</Option>
                                <Option value="Neonates (< 1 Mo)">Neonates (&lt; 1 Mo)</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={4}>
                        <Form.Item name="strength" label="Strength">
                            <Input placeholder="e.g. 500mg" />
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item name="defaultDosage" label="Default Dosage">
                            <Input 
                                placeholder="Type 101 -> 1-0-1" 
                                onChange={handleDosageChange} // <-- Attached smart formatter
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="defaultInstructions" label="Instructions">
                            <Input placeholder="e.g. After Food" />
                        </Form.Item>
                    </Col>
                    <Col span={10}>
                        <Form.Item name="treatmentFor" label="Indications (Press Enter to add new)">
                            <Select 
                                mode="tags" 
                                placeholder="Select or type (e.g. Fever)" 
                                options={existingIndications} // <-- Dynamic list of existing tags
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Form.Item name="isActive" valuePropName="checked" style={{ marginBottom: 0 }}>
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                    
                    <Space>
                        {editingItem && (
                            <Button icon={<CloseOutlined />} onClick={onCancel}>
                                Cancel Edit
                            </Button>
                        )}
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                            {editingItem ? "Update Medicine" : "Add Medicine"}
                        </Button>
                    </Space>
                </div>
            </Form>
        </Card>
    );
};

export default ClinicalMedicineForm;