import React from 'react';
import { Form, Select, Button, Typography, Divider, Table, Tag, Input, Space, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text } = Typography;

const InfrastructureSettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();
    
    const departments = data?.settings?.queue?.departments || [];
    const counters = data?.counters || [];

    const handleAddCounter = (values) => {
        const newCounter = { 
            counterId: uuidv4(), 
            name: values.name,
            department: values.department,
            type: values.type,
            status: 'Offline',
            currentStaffId: null
        };
        onSave({ counters: [...counters, newCounter] });
        form.resetFields();
    };

    const handleDeleteCounter = (id) => {
        onSave({ counters: counters.filter(c => c.counterId !== id) });
    };

    const handleUpdateDepartments = (newDepts) => {
        onSave({ 
            settings: { 
                ...data.settings, 
                queue: { ...data.settings.queue, departments: newDepts } 
            } 
        });
    };

    const columns = [
        { 
            title: 'Room / Desk Name', 
            dataIndex: 'name', 
            key: 'name',
            render: (text) => <strong>{text}</strong>
        },
        { 
            title: 'Assigned Department', 
            dataIndex: 'department', 
            key: 'department', 
            render: (text) => <Tag color="blue">{text}</Tag> 
        },
        { 
            title: 'Functionality Type', 
            dataIndex: 'type', 
            key: 'type',
            render: (text) => <Tag color="purple">{text}</Tag> 
        },
        { 
            title: 'Current Status', 
            dataIndex: 'status', 
            key: 'status',
            render: (text) => (
                <Tag color={text === 'Online' ? 'success' : text === 'Paused' ? 'warning' : 'default'}>
                    {text || 'Offline'}
                </Tag>
            )
        },
        { 
            title: 'Action', 
            key: 'action', 
            render: (_, record) => (
                <Popconfirm 
                    title="Delete this physical room?" 
                    description="Staff will no longer be able to log into this desk."
                    onConfirm={() => handleDeleteCounter(record.counterId)}
                    okText="Yes, Delete"
                    cancelText="Cancel"
                >
                    <Button danger type="text" icon={<DeleteOutlined />}>Delete</Button>
                </Popconfirm>
            )
        }
    ];

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>Departments & Facilities Configuration</Title>
            <Text type="secondary">Define your medical departments and map them to physical rooms or collection desks.</Text>
            <Divider />
            
            <div style={{ marginBottom: '48px', background: '#fafafa', padding: '24px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                <Title level={5}><InfoCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }}/> Active Departments</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Type a department name and press Enter. These departments will appear in dropdowns across the application for test assignments and queue management.
                </Text>
                <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    placeholder="E.g., Pathology, Radiology, Cardiology (Press Enter after typing)"
                    value={departments}
                    onChange={handleUpdateDepartments}
                    size="large"
                />
            </div>

            <Title level={5}>Physical Desks & Rooms</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
                Add physical locations where staff work. A staff member will log into one of these desks to manage the Queue for its assigned Department.
            </Text>

            <Form 
                form={form} 
                layout="vertical" 
                onFinish={handleAddCounter}
                style={{ background: '#e6f7ff', padding: '24px', borderRadius: '8px', border: '1px solid #91d5ff', marginBottom: '24px' }}
            >
                <Row gutter={16} align="bottom">
                    <Col span={8}>
                        <Form.Item name="name" label="Room/Desk Name" rules={[{ required: true, message: 'Name required' }]}>
                            <Input placeholder="e.g. Pathology Desk 1" size="large" />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="department" label="Assign to Department" rules={[{ required: true, message: 'Select Dept' }]}>
                            <Select size="large" placeholder="Select Dept">
                                {departments.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="type" label="Function Type" rules={[{ required: true }]} initialValue="Collection">
                            <Select size="large">
                                <Select.Option value="Collection">Collection</Select.Option>
                                <Select.Option value="Consultation">Consultation</Select.Option>
                                <Select.Option value="Scanning">Scanning</Select.Option>
                                <Select.Option value="Billing">Billing</Select.Option>
                                <Select.Option value="Other">Other</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} size="large" style={{ width: '100%' }}>
                                Add Room
                            </Button>
                        </Form.Item>
                    </Col>
                </Row>
            </Form>

            <Table 
                dataSource={counters} 
                columns={columns} 
                rowKey="counterId" 
                pagination={false} 
                bordered
            />
        </div>
    );
};

export default InfrastructureSettings;