import React, { useState } from 'react';
import { Form, Select, Button, Typography, Divider, Table, Tag, Input, Space, Popconfirm, InputNumber, Col, Row, Modal, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined, ClockCircleOutlined, EditOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text } = Typography;

const InfrastructureSettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    
    // Edit Modal State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingCounterId, setEditingCounterId] = useState(null);

    const departments = data?.settings?.queue?.departments || [];
    const counters = data?.counters || [];

    const handleAddCounter = (values) => {
        const newCounter = { 
            counterId: uuidv4(), 
            name: values.name,
            roomName: values.roomName,
            department: values.department,
            type: values.type,
            status: 'Offline',
            currentStaffId: null,
            scheduling: {
                slotDurationMinutes: 15,
                bufferTimeMinutes: 0,
                maxPatientsPerSlot: 1
            }
        };
        onSave({ counters: [...counters, newCounter] });
        form.resetFields();
    };

    const handleDeleteCounter = (id) => {
        onSave({ counters: counters.filter(c => c.counterId !== id) });
    };

    const handleUpdateCounterSetting = (id, field, value) => {
        const updatedCounters = counters.map(c => {
            if (c.counterId === id) {
                if (['slotDurationMinutes', 'bufferTimeMinutes', 'maxPatientsPerSlot'].includes(field)) {
                    return { ...c, scheduling: { ...c.scheduling, [field]: value } };
                }
                return { ...c, [field]: value };
            }
            return c;
        });
        onSave({ counters: updatedCounters });
    };

    // --- Modal Edit Handlers ---
    const openEditModal = (record) => {
        setEditingCounterId(record.counterId);
        editForm.setFieldsValue({
            name: record.name,
            roomName: record.roomName,
            department: record.department,
            type: record.type
        });
        setIsEditModalVisible(true);
    };

    const handleEditSave = (values) => {
        const updatedCounters = counters.map(c => 
            c.counterId === editingCounterId ? { ...c, ...values } : c
        );
        onSave({ counters: updatedCounters });
        setIsEditModalVisible(false);
        setEditingCounterId(null);
    };

    const handleUpdateDepartments = (newDepts) => {
        onSave({ settings: { ...data.settings, queue: { ...data.settings.queue, departments: newDepts } } });
    };

    const columns = [
        { 
            title: 'Machine / Desk', 
            dataIndex: 'name', 
            key: 'name',
            render: (text) => <strong>{text}</strong>
        },
        { 
            title: 'Physical Room', 
            dataIndex: 'roomName',
            key: 'roomName',
            render: (text) => <Text type="secondary">{text}</Text>
        },
        { 
            title: 'Dept & Type', 
            key: 'type', 
            render: (_, record) => (
                <div>
                    <Tag color="blue" style={{ marginBottom: '4px' }}>{record.department}</Tag><br/>
                    <Tag color="purple">{record.type}</Tag>
                </div>
            ) 
        },
        {
            title: 'Slot Duration (Mins)',
            key: 'slotDurationMinutes',
            render: (_, record) => (
                <InputNumber 
                    min={1} 
                    value={record.scheduling?.slotDurationMinutes || 15} 
                    onChange={(val) => handleUpdateCounterSetting(record.counterId, 'slotDurationMinutes', val)}
                    addonAfter={<ClockCircleOutlined />}
                    style={{ width: '100px' }}
                />
            )
        },
        {
            title: 'Max Patients / Slot',
            key: 'maxPatients',
            render: (_, record) => (
                <InputNumber 
                    min={1} 
                    value={record.scheduling?.maxPatientsPerSlot || 1} 
                    onChange={(val) => handleUpdateCounterSetting(record.counterId, 'maxPatientsPerSlot', val)}
                    style={{ width: '80px' }}
                />
            )
        },
        { 
            title: 'Current Status', 
            dataIndex: 'status', 
            key: 'status',
            render: (text, record) => (
                <Select 
                    value={text || 'Offline'} 
                    style={{ width: 100 }}
                    size="small"
                    onChange={(val) => handleUpdateCounterSetting(record.counterId, 'status', val)}
                >
                    <Select.Option value="Online"><Tag color="success">Online</Tag></Select.Option>
                    <Select.Option value="Paused"><Tag color="warning">Paused</Tag></Select.Option>
                    <Select.Option value="Offline"><Tag color="default">Offline</Tag></Select.Option>
                </Select>
            )
        },
        { 
            title: 'Action', 
            key: 'action', 
            render: (_, record) => (
                <Space>
                    <Tooltip title="Edit Details">
                        <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => openEditModal(record)} />
                    </Tooltip>
                    <Popconfirm title="Delete this room?" onConfirm={() => handleDeleteCounter(record.counterId)}>
                        <Button danger type="text" icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>Departments & Facilities Configuration</Title>
            <Text type="secondary">Define your medical departments, physical rooms, and scheduling rules per room.</Text>
            <Divider />
            
            <div style={{ marginBottom: '48px', background: '#fafafa', padding: '24px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                <Title level={5}><InfoCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }}/> Active Departments</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Type a department name and press Enter.
                </Text>
                <Select
                    mode="tags"
                    style={{ width: '100%' }}
                    placeholder="E.g., Pathology, Radiology, Cardiology (Press Enter)"
                    value={departments}
                    onChange={handleUpdateDepartments}
                    size="large"
                />
            </div>

            <Title level={5}>Physical Desks, Rooms & Machines</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '24px' }}>
                Add physical locations. You can define specific time durations for machines (e.g., MRI = 45 mins) vs general collection desks (e.g., Blood Draw = 5 mins).
            </Text>

            <Form form={form} layout="vertical" onFinish={handleAddCounter} style={{ background: '#e6f7ff', padding: '24px', borderRadius: '8px', border: '1px solid #91d5ff', marginBottom: '24px' }}>
                <Row gutter={16} align="bottom">
                    <Col span={5}>
                        <Form.Item name="name" label="Machine/Desk Name" rules={[{ required: true }]}>
                            <Input placeholder="e.g. MRI Scanner" size="large" />
                        </Form.Item>
                    </Col>
                    <Col span={5}>
                        <Form.Item name="roomName" label="Room Location" rules={[{ required: true }]}>
                            <Input placeholder="e.g. Room 102, Ground Fl." size="large" />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="department" label="Assign to Dept" rules={[{ required: true }]}>
                            <Select size="large" placeholder="Select Dept">
                                {departments.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="type" label="Function" rules={[{ required: true }]} initialValue="Collection">
                            <Select size="large">
                                <Select.Option value="Collection">Collection</Select.Option>
                                <Select.Option value="Scanning">Scanning</Select.Option>
                                <Select.Option value="Consultation">Consultation</Select.Option>
                                <Select.Option value="Billing">Billing</Select.Option>
                                <Select.Option value="Other">Other</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={2}>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} size="large" style={{ width: '100%' }} />
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

            {/* EDIT MODAL */}
            <Modal
                title="Edit Machine / Room Details"
                open={isEditModalVisible}
                onCancel={() => setIsEditModalVisible(false)}
                onOk={() => editForm.submit()}
                okText="Save Changes"
                destroyOnClose
            >
                <Form form={editForm} layout="vertical" onFinish={handleEditSave}>
                    <Form.Item name="name" label="Machine / Desk Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="roomName" label="Physical Room Location" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="department" label="Assigned Department" rules={[{ required: true }]}>
                        <Select>
                            {departments.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="type" label="Function Type" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="Collection">Collection</Select.Option>
                            <Select.Option value="Scanning">Scanning</Select.Option>
                            <Select.Option value="Consultation">Consultation</Select.Option>
                            <Select.Option value="Billing">Billing</Select.Option>
                            <Select.Option value="Other">Other</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default InfrastructureSettings;