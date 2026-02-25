import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { Table, Button, Drawer, Form, Typography, message, Space, Popconfirm, Tag, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, AlertOutlined, PlusSquareOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { getDoctors, createDoctor, updateDoctor, deleteDoctor, addDoctorOverride, fetchMyInstitutionSettings } from '../redux/apiCalls';

// Modular Components
import DoctorProfileTab from '../components/Doctor Manager/DoctorProfileTab';
import DoctorScheduleTab from '../components/Doctor Manager/DoctorScheduleTab';
import DoctorLeavesTab from '../components/Doctor Manager/DoctorLeavesTab';
import DoctorOverrideModal from '../components/Doctor Manager/DoctorOverrideModal';
import DoctorSpecialShiftModal from '../components/Doctor Manager/DoctorSpecialShiftModal';

const { Title, Text } = Typography;

const PageContainer = styled.div`
  padding: 24px;
  background-color: #f4f6f8;
  min-height: 100vh;
`;

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DoctorManagerPage = () => {
    const dispatch = useDispatch();
    const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);
    const isFetching = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.isFetching);
    
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [overrideModalVisible, setOverrideModalVisible] = useState(false);
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [specialShiftModalVisible, setSpecialShiftModalVisible] = useState(false);
    const [selectedDoctorForSpecialShift, setSelectedDoctorForSpecialShift] = useState(null);
    const [form] = Form.useForm();

    useEffect(() => {
        getDoctors(dispatch);
        loadInfrastructure();
    }, [dispatch]);

    const loadInfrastructure = async () => {
        const settings = await fetchMyInstitutionSettings();
        if (settings && settings.counters) {
            setRooms(settings.counters.filter(c => c.type === 'Consultation'));
        }
    };

    const buildInitialSchedule = (existingSchedule) => {
        return DAYS_OF_WEEK.map((dayName, index) => {
            const existingDay = existingSchedule?.find(s => s.dayOfWeek === index);
            if (existingDay) {
                return {
                    ...existingDay,
                    shifts: existingDay.shifts.map(shift => ({
                        ...shift,
                        timeRange: [dayjs(shift.startTime, 'HH:mm'), dayjs(shift.endTime, 'HH:mm')]
                    }))
                };
            }
            return { dayOfWeek: index, isAvailable: false, shifts: [] };
        });
    };

    const handleOpenSpecialShift = (doc) => {
    setSelectedDoctorForSpecialShift(doc);
    setSpecialShiftModalVisible(true);
};

    const openDrawer = (doctor = null) => {
        setEditingDoctor(doctor);
        if (doctor) {
            form.setFieldsValue({
                ...doctor,
                firstName: doctor.personalInfo?.firstName,
                lastName: doctor.personalInfo?.lastName,
                phone: doctor.personalInfo?.phone,
                email: doctor.personalInfo?.email,
                specialization: doctor.professionalInfo?.specialization,
                registrationNumber: doctor.professionalInfo?.registrationNumber,
                newConsultation: doctor.fees?.newConsultation,
                followUpConsultation: doctor.fees?.followUpConsultation,
                avgTimePerPatientMinutes: doctor.consultationRules?.avgTimePerPatientMinutes,
                followUpValidityDays: doctor.consultationRules?.followUpValidityDays,
                allowOverbooking: doctor.consultationRules?.allowOverbooking,
                assignedCounterId: doctor.assignedCounterId,
                schedule: buildInitialSchedule(doctor.schedule),
                leaves: doctor.leaves?.map(l => ({
                    reason: l.reason,
                    dateRange: [dayjs(l.startDate, 'YYYY-MM-DD'), dayjs(l.endDate, 'YYYY-MM-DD')]
                }))
            });
        } else {
            form.resetFields();
            form.setFieldsValue({
                schedule: buildInitialSchedule([]),
                avgTimePerPatientMinutes: 15,
                followUpValidityDays: 7
            });
        }
        setDrawerVisible(true);
    };

 const handleSaveDoctor = async (values) => {
        // 1. Format the schedule back to DB strings
        const formattedSchedule = (values.schedule || []).map((day, index) => ({
            // FIX: Use the array index (0-6) since AntD strips unrendered fields like dayOfWeek
            dayOfWeek: index, 
            isAvailable: !!day.isAvailable, // Force boolean
            shifts: day.shifts?.map(shift => ({
                shiftName: shift.shiftName,
                // Safely format time ranges in case user left them blank
                startTime: shift.timeRange && shift.timeRange[0] ? shift.timeRange[0].format('HH:mm') : "00:00",
                endTime: shift.timeRange && shift.timeRange[1] ? shift.timeRange[1].format('HH:mm') : "00:00",
                maxTokens: shift.maxTokens
            })) || []
        }));

        // 2. Format leaves safely
        const formattedLeaves = (values.leaves || []).map(leave => ({
            startDate: leave.dateRange && leave.dateRange[0] ? leave.dateRange[0].format('YYYY-MM-DD') : null,
            endDate: leave.dateRange && leave.dateRange[1] ? leave.dateRange[1].format('YYYY-MM-DD') : null,
            reason: leave.reason
        })).filter(l => l.startDate && l.endDate); // Filter out empty ones

        const payload = {
            personalInfo: { firstName: values.firstName, lastName: values.lastName, phone: values.phone, email: values.email },
            professionalInfo: { specialization: values.specialization, registrationNumber: values.registrationNumber },
            fees: { newConsultation: values.newConsultation, followUpConsultation: values.followUpConsultation },
            consultationRules: { 
                avgTimePerPatientMinutes: values.avgTimePerPatientMinutes,
                followUpValidityDays: values.followUpValidityDays,
                allowOverbooking: values.allowOverbooking
            },
            assignedCounterId: values.assignedCounterId,
            schedule: formattedSchedule,
            leaves: formattedLeaves
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
            getDoctors(dispatch); 
        } catch (error) {
            console.error("Save Doctor Error:", error);
            message.error(error?.response?.data?.error || "Action failed.");
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoctor(dispatch, id);
            message.success("Doctor deactivated.");
            getDoctors(dispatch);
        } catch (error) {
            message.error("Failed to delete.");
        }
    };

    const handleSaveOverride = async (values) => {
        try {
            const formattedValues = { ...values, date: values.date.format('YYYY-MM-DD') };
            await addDoctorOverride(editingDoctor.doctorId, formattedValues);
            message.success("Schedule override applied successfully!");
            setOverrideModalVisible(false);
            getDoctors(dispatch); 
        } catch (error) {
            message.error("Failed to apply override.");
        }
    };

    const columns = [
        { title: 'Doctor Name', key: 'name', render: (_, record) => <strong>Dr. {record.personalInfo?.firstName} {record.personalInfo?.lastName}</strong> },
        { title: 'Specialization', dataIndex: ['professionalInfo', 'specialization'], key: 'specialization' },
        { title: 'Fees (New / Follow-up)', key: 'fees', render: (_, record) => `₹${record.fees?.newConsultation} / ₹${record.fees?.followUpConsultation}` },
        { title: 'Assigned Cabin', dataIndex: 'assignedCounterId', key: 'cabin', render: (id) => {
            const room = rooms.find(r => r.counterId === id);
            return room ? <Tag color="blue">{room.name}</Tag> : <Text type="secondary">Unassigned</Text>;
        }},
        { title: 'Avg Time/Pt', dataIndex: ['consultationRules', 'avgTimePerPatientMinutes'], key: 'time', render: (time) => <Tag icon={<ClockCircleOutlined />}>{time} mins</Tag> },
        { title: 'Actions', key: 'action', render: (_, record) => (
            <Space size="middle">
                <Button type="primary" size="small" icon={<AlertOutlined />} danger onClick={() => { setEditingDoctor(record); setOverrideModalVisible(true); }}>Delay/Leave</Button>
                <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => openDrawer(record)} />
                <Button size="small" type="dashed" onClick={() => handleOpenSpecialShift(record)} icon={<PlusSquareOutlined />} style={{ color: '#722ed1', borderColor: '#722ed1' }}>
                Special Shift
                </Button>
                <Popconfirm title="Remove this doctor?" onConfirm={() => handleDelete(record.doctorId)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            </Space>
        )}
    ];

    const tabItems = [
        { key: '1', label: 'Profile & Fees', children: <DoctorProfileTab rooms={rooms} /> },
        { key: '2', label: 'Weekly Schedule', children: <DoctorScheduleTab form={form} /> },
        { key: '3', label: 'Planned Leaves', children: <DoctorLeavesTab /> }
    ];

    return (
        <PageContainer>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <Title level={2} style={{ margin: 0 }}>Doctor Management</Title>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openDrawer()}>
                    Add Doctor
                </Button>
            </div>

            <Table columns={columns} dataSource={doctors} rowKey="doctorId" loading={isFetching} style={{ background: '#fff', borderRadius: '8px' }} />

            <Drawer
                title={editingDoctor ? "Edit Doctor Profile" : "Add New Doctor"}
                width={800}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={<Button type="primary" onClick={() => form.submit()}>Save Doctor</Button>}
            >
                <Form form={form} layout="vertical" onFinish={handleSaveDoctor}>
                    <Tabs defaultActiveKey="1" items={tabItems} />
                </Form>
            </Drawer>

            <DoctorOverrideModal 
                visible={overrideModalVisible} 
                onCancel={() => setOverrideModalVisible(false)} 
                onSave={handleSaveOverride} 
                doctor={editingDoctor} 
            />
            <DoctorSpecialShiftModal 
        visible={specialShiftModalVisible}
        onCancel={() => { setSpecialShiftModalVisible(false); setSelectedDoctorForSpecialShift(null); }}
        onSuccess={() => {
            setSpecialShiftModalVisible(false);
            setSelectedDoctorForSpecialShift(null);
            // Refresh your table data here, assuming you have a loadData() or getDoctors() function
            getDoctors(dispatch); 
        }}
        doctor={selectedDoctorForSpecialShift}
    />
        </PageContainer>
    );
};

export default DoctorManagerPage;