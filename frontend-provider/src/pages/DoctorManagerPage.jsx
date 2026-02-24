import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { Table, Button, Drawer, Form, Input, Select, InputNumber, Row, Col, Typography, message, Space, Popconfirm, Tag, Modal, Switch, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, AlertOutlined } from '@ant-design/icons';
import { getDoctors, createDoctor, updateDoctor, deleteDoctor, addDoctorOverride, fetchMyInstitutionSettings } from '../redux/apiCalls';

const { Title, Text } = Typography;
const { Option } = Select;

const PageContainer = styled.div`
  padding: 24px;
  background-color: #f4f6f8;
  min-height: 100vh;
`;

const DoctorManagerPage = () => {
    const dispatch = useDispatch();
    const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);
    const isFetching = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.isFetching);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [overrideModalVisible, setOverrideModalVisible] = useState(false);
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [rooms, setRooms] = useState([]); // Fetch physical rooms from settings
    
    const [form] = Form.useForm();
    const [overrideForm] = Form.useForm();

    useEffect(() => {
        getDoctors(dispatch);
        loadInfrastructure();
    }, [dispatch]);

    const loadInfrastructure = async () => {
        const settings = await fetchMyInstitutionSettings();
        if (settings && settings.counters) {
            // Only get counters designated for Consultation
            setRooms(settings.counters.filter(c => c.type === 'Consultation'));
        }
    };

    // --- CRUD Actions ---
    const openDrawer = (doctor = null) => {
        setEditingDoctor(doctor);
        if (doctor) {
            form.setFieldsValue({
                ...doctor,
                firstName: doctor.personalInfo?.firstName,
                lastName: doctor.personalInfo?.lastName,
                specialization: doctor.professionalInfo?.specialization,
                registrationNumber: doctor.professionalInfo?.registrationNumber,
                newConsultation: doctor.fees?.newConsultation,
                followUpConsultation: doctor.fees?.followUpConsultation,
                avgTimePerPatientMinutes: doctor.consultationRules?.avgTimePerPatientMinutes,
                assignedCounterId: doctor.assignedCounterId
            });
        } else {
            form.resetFields();
        }
        setDrawerVisible(true);
    };

    const handleSaveDoctor = async (values) => {
        const payload = {
            personalInfo: { firstName: values.firstName, lastName: values.lastName, phone: values.phone, email: values.email },
            professionalInfo: { specialization: values.specialization, registrationNumber: values.registrationNumber },
            fees: { newConsultation: values.newConsultation, followUpConsultation: values.followUpConsultation },
            consultationRules: { avgTimePerPatientMinutes: values.avgTimePerPatientMinutes },
            assignedCounterId: values.assignedCounterId
        };

        try {
            if (editingDoctor) {
                await updateDoctor(dispatch, editingDoctor.doctorId, payload);
                message.success("Doctor updated successfully");
            } else {
                await createDoctor(dispatch, payload);
                message.success("Doctor created successfully");
            }
            setDrawerVisible(false);
            getDoctors(dispatch); // Refresh list
        } catch (error) {
            message.error("Action failed.");
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoctor(dispatch, id);
            message.success("Doctor deactivated.");
        } catch (error) {
            message.error("Failed to delete.");
        }
    };

    // --- Override / Delay Actions ---
    const openOverrideModal = (doctor) => {
        setEditingDoctor(doctor);
        overrideForm.resetFields();
        setOverrideModalVisible(true);
    };

    const handleSaveOverride = async (values) => {
        try {
            await addDoctorOverride(editingDoctor.doctorId, values);
            message.success("Schedule override applied successfully!");
            setOverrideModalVisible(false);
            getDoctors(dispatch); // Refresh to see new overrides
        } catch (error) {
            message.error("Failed to apply override.");
        }
    };

    // --- Table Columns ---
    const columns = [
        {
            title: 'Doctor Name',
            key: 'name',
            render: (_, record) => <strong>Dr. {record.personalInfo?.firstName} {record.personalInfo?.lastName}</strong>
        },
        { title: 'Specialization', dataIndex: ['professionalInfo', 'specialization'], key: 'specialization' },
        { 
            title: 'Fees (New / Follow-up)', 
            key: 'fees',
            render: (_, record) => `₹${record.fees?.newConsultation} / ₹${record.fees?.followUpConsultation}`
        },
        { 
            title: 'Assigned Cabin', 
            dataIndex: 'assignedCounterId', 
            key: 'cabin',
            render: (id) => {
                const room = rooms.find(r => r.counterId === id);
                return room ? <Tag color="blue">{room.name}</Tag> : <Text type="secondary">Unassigned</Text>;
            }
        },
        { 
            title: 'Avg Time/Pt', 
            dataIndex: ['consultationRules', 'avgTimePerPatientMinutes'], 
            key: 'time',
            render: (time) => <Tag icon={<ClockCircleOutlined />}>{time} mins</Tag>
        },
        {
            title: 'Actions',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    <Button type="primary" size="small" icon={<AlertOutlined />} danger onClick={() => openOverrideModal(record)}>
                        Add Delay/Leave
                    </Button>
                    <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => openDrawer(record)} />
                    <Popconfirm title="Remove this doctor?" onConfirm={() => handleDelete(record.doctorId)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <PageContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <Title level={2} style={{ margin: 0 }}>Doctor Management</Title>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openDrawer()}>
                    Add Doctor
                </Button>
            </div>

            <Table 
                columns={columns} 
                dataSource={doctors} 
                rowKey="doctorId" 
                loading={isFetching} 
                style={{ background: '#fff', borderRadius: '8px' }}
            />

            {/* --- ADD/EDIT DOCTOR DRAWER --- */}
            <Drawer
                title={editingDoctor ? "Edit Doctor Profile" : "Add New Doctor"}
                width={720}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
            >
                <Form form={form} layout="vertical" onFinish={handleSaveDoctor}>
                    <Title level={5}>Personal Details</Title>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="firstName" label="First Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="lastName" label="Last Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="phone" label="Phone Number"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="email" label="Email Address"><Input /></Form.Item></Col>
                    </Row>

                    <Divider />
                    <Title level={5}>Professional Profile</Title>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="specialization" label="Specialization" rules={[{ required: true }]}><Input placeholder="e.g. Cardiology" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="registrationNumber" label="Medical Council Reg. No." rules={[{ required: true }]}><Input /></Form.Item></Col>
                    </Row>

                    <Divider />
                    <Title level={5}>Consultation Settings & Fees</Title>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="assignedCounterId" label="Assign to Physical Room">
                                <Select placeholder="Select a Consultation Room">
                                    {rooms.map(r => <Option key={r.counterId} value={r.counterId}>{r.name} ({r.roomName})</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="avgTimePerPatientMinutes" label="Avg Time Per Patient (Minutes)" initialValue={15} rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} min={1} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="newConsultation" label="Fee: New Patient (₹)" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="followUpConsultation" label="Fee: Follow-Up (₹)" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} min={0} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Button type="primary" htmlType="submit" size="large" block style={{ marginTop: '24px' }}>
                        Save Doctor Details
                    </Button>
                </Form>
            </Drawer>

            {/* --- DAILY OVERRIDE / DELAY MODAL --- */}
            <Modal
                title={`Log Delay / Leave for Dr. ${editingDoctor?.personalInfo?.firstName}`}
                open={overrideModalVisible}
                onCancel={() => setOverrideModalVisible(false)}
                onOk={() => overrideForm.submit()}
                okText="Apply Change"
            >
                <Form form={overrideForm} layout="vertical" onFinish={handleSaveOverride}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                        If the doctor is stuck in surgery, add the delay here to automatically push back the ETA for all waiting patients.
                    </Text>
                    <Form.Item name="date" label="Date (YYYY-MM-DD)" rules={[{ required: true }]}>
                        <Input placeholder="2026-02-24" />
                    </Form.Item>
                    <Form.Item name="shiftName" label="Shift Name (Optional)">
                        <Input placeholder="e.g. Morning OPD" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="delayMinutes" label="Delay (Minutes)" initialValue={0}>
                                <InputNumber style={{ width: '100%' }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="isCancelled" label="Cancel Shift?" valuePropName="checked">
                                <Switch checkedChildren="Yes" unCheckedChildren="No" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="note" label="Note / Reason">
                        <Input.TextArea placeholder="Stuck in emergency surgery..." />
                    </Form.Item>
                </Form>
            </Modal>

        </PageContainer>
    );
};

export default DoctorManagerPage;