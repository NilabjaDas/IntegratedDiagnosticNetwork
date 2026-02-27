import React, { useEffect } from 'react';
import { Form, Input, Select, Switch, Button, Row, Col, Card, Space } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

const { Option } = Select;

const ClinicalTestForm = ({ editingItem, onSave, onCancel, loading }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (editingItem) {
            form.setFieldsValue(editingItem);
        } else {
            form.resetFields();
            form.setFieldsValue({ isActive: true, department: 'Pathology' });
        }
    }, [editingItem, form]);

    const handleFinish = (values) => {
        onSave(values);
        if (!editingItem) {
            form.resetFields();
            form.setFieldsValue({ isActive: true, department: 'Pathology' });
        }
    };

    return (
        <Card 
            size="small" 
            title={editingItem ? "Edit Custom Test" : "Add Custom Test"} 
            style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
            <Form 
                layout="vertical" 
                form={form} 
                onFinish={handleFinish}
                initialValues={{ isActive: true, department: 'Pathology' }}
            >
                <Row gutter={16}>
                    <Col span={6}>
                        <Form.Item name="name" label="Test Name" rules={[{ required: true, message: 'Required' }]}>
                            <Input placeholder="e.g. Complete Blood Count" autoFocus />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="alias" label="Alias (Short Name)">
                            <Input placeholder="e.g. CBC" />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="department" label="Department" rules={[{ required: true }]}>
                            <Select>
                                <Option value="Pathology">Pathology</Option>
                                <Option value="Radiology">Radiology</Option>
                                <Option value="Cardiology">Cardiology</Option>
                                <Option value="Neurology">Neurology</Option>
                                <Option value="Other">Other</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="category" label="Category">
                            <Input placeholder="e.g. Hematology" />
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
                            {editingItem ? "Update Test" : "Add Custom Test"}
                        </Button>
                    </Space>
                </div>
            </Form>
        </Card>
    );
};

export default ClinicalTestForm;