import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { 
    Table, Button, Drawer, Form, Typography, message, Space, Popconfirm, Tag, Tabs, Card
} from 'antd';
import { 
    PlusOutlined, EditOutlined, ClockCircleOutlined, AlertOutlined, PlusSquareOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { 
    getDoctors, createDoctor, updateDoctor, deleteDoctor, 
    addDoctorOverride, fetchMyInstitutionSettings, revokeDoctorAbsence 
} from '../../redux/apiCalls';

// Modular Components (now in the same directory)
import DoctorProfileTab from './DoctorProfileTab';
import DoctorScheduleTab from './DoctorScheduleTab';
import DoctorLeavesTab from './DoctorLeavesTab';
import DoctorOverrideModal from './DoctorOverrideModal';
import DoctorSpecialShiftModal from './DoctorSpecialShiftModal';

const { Title, Text } = Typography;

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DoctorManager = () => {
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
                        timeRange: [dayjs(shift.startTime, 'HH:mm'), dayjs(shift.endTime, 'HH:mm')],
                        repeatWeeks: shift.repeatWeeks && shift.repeatWeeks.length > 0 ? shift.repeatWeeks : [1, 2, 3, 4, 5],
                        breaks: shift.breaks?.map(b => ({
                            label: b.label,
                            timeRange: [dayjs(b.startTime, 'HH:mm'), dayjs(b.endTime, 'HH:mm')]
                        })) || []
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
                gender: doctor.personalInfo?.gender,
                phone: doctor.personalInfo?.phone,
                email: doctor.personalInfo?.email,
                specialization: doctor.professionalInfo?.specialization,
                registrationNumber: doctor.professionalInfo?.registrationNumber,
                qualifications: doctor.professionalInfo?.qualifications || [],
                experienceYears: doctor.professionalInfo?.experienceYears,
                newConsultation: doctor.fees?.newConsultation,
                followUpConsultation: doctor.fees?.followUpConsultation,
                avgTimePerPatientMinutes: doctor.consultationRules?.avgTimePerPatientMinutes,
                followUpValidityDays: doctor.consultationRules?.followUpValidityDays,
                allowOverbooking: doctor.consultationRules?.allowOverbooking,
                leaveSettings: doctor.leaveSettings,
                assignedCounterId: doctor.assignedCounterId,
                prescriptionTemplateId: doctor.prescriptionTemplateId,
                schedule: buildInitialSchedule(doctor.schedule),
            });
        } else {
            form.resetFields();
            form.setFieldsValue({
                schedule: buildInitialSchedule([]),
                avgTimePerPatientMinutes: 15,
                followUpValidityDays: 7,
                leaveSettings: { leaveLimitPerYear: 20 }
            });
        }
        setDrawerVisible(true);
    };

    const handleSaveDoctor = async (values) => {
        const formattedSchedule = (values.schedule || []).map((day, index) => ({
            dayOfWeek: index, 
            isAvailable: !!day.isAvailable, 
            shifts: day.shifts?.map(shift => ({
                shiftName: shift.shiftName,
                startTime: shift.timeRange && shift.timeRange[0] ? shift.timeRange[0].format('HH:mm') : "00:00",
                endTime: shift.timeRange && shift.timeRange[1] ? shift.timeRange[1].format('HH:mm') : "00:00",
                maxTokens: shift.maxTokens,
                repeatWeeks: shift.repeatWeeks || [1, 2, 3, 4, 5],
                breaks: shift.breaks?.map(b => ({
                    label: b.label || "Break",
                    startTime: b.timeRange && b.timeRange[0] ? b.timeRange[0].format('HH:mm') : "00:00",
                    endTime: b.timeRange && b.timeRange[1] ? b.timeRange[1].format('HH:mm') : "00:00"
                })) || []
            })) || []
        }));

        const payload = {
            personalInfo: { firstName: values.firstName, lastName: values.lastName, gender: values.gender, phone: values.phone, email: values.email },
            professionalInfo: { specialization: values.specialization, registrationNumber: values.registrationNumber, qualifications: values.qualifications, experienceYears: values.experienceYears },
            fees: { newConsultation: values.newConsultation, followUpConsultation: values.followUpConsultation },
            consultationRules: { avgTimePerPatientMinutes: values.avgTimePerPatientMinutes, followUpValidityDays: values.followUpValidityDays, allowOverbooking: values.allowOverbooking },
            leaveSettings: values.leaveSettings,
            prescriptionTemplateId: values.prescriptionTemplateId,
            assignedCounterId: values.assignedCounterId,
            schedule: formattedSchedule,
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

    const handleSaveOverride = async (values) => {
        try {
            const formattedValues = { ...values, date: values.date};
            await addDoctorOverride(editingDoctor.doctorId, formattedValues);
            message.success("Schedule override applied successfully!");
            setOverrideModalVisible(false);
            getDoctors(dispatch); 
        } catch (error) {
            message.error("Failed to apply override.");
        }
    };

    const getTodayStatus = (doc) => {
        const todayStr = dayjs().format('YYYY-MM-DD');
        const todayIndex = dayjs().day();
        const totalShifts = doc.schedule?.find(s => s.dayOfWeek === todayIndex)?.shifts || [];
        const totalShiftCount = totalShifts.length;

        const todayLeaves = doc.leaves?.filter(l => todayStr >= l.startDate && todayStr <= l.endDate) || [];
        let plannedCancelledShifts = [];
        let isFullDayLeave = false;

        todayLeaves.forEach(l => {
            if (!l.shiftNames || l.shiftNames.length === 0) {
                isFullDayLeave = true;
            } else {
                plannedCancelledShifts.push(...l.shiftNames);
            }
        });

        const overrides = doc.dailyOverrides?.filter(o => o.date === todayStr) || [];
        const overrideCancelledShifts = overrides.filter(o => o.isCancelled).flatMap(o => o.shiftNames || []);
        const overridesDelays = overrides.filter(o => o.delayMinutes > 0);

        const allCancelledShifts = [...new Set([...plannedCancelledShifts, ...overrideCancelledShifts])];

        if (isFullDayLeave || (totalShiftCount > 0 && allCancelledShifts.length >= totalShiftCount)) {
            return { text: isFullDayLeave ? 'On Planned Leave' : 'Cancelled (Full Day)', color: 'red', canRevoke: true, fullyCancelled: true };
        }

        const details = [];

        if (plannedCancelledShifts.length > 0) details.push(`${plannedCancelledShifts.join(', ')}: Planned Leave`);

        const pureOverrideCancels = overrideCancelledShifts.filter(s => !plannedCancelledShifts.includes(s));
        if (pureOverrideCancels.length > 0) details.push(`${pureOverrideCancels.join(', ')}: Cancelled`);

        overridesDelays.forEach(o => {
            const activeDelays = (o.shiftNames || []).filter(s => !allCancelledShifts.includes(s));
            if (activeDelays.length > 0) details.push(`${activeDelays.join(', ')}: Late (${o.delayMinutes}m)`);
        });

        if (details.length > 0) return { text: details.join(' | '), color: 'orange', canRevoke: true, fullyCancelled: false };

        return { text: 'Active / Normal', color: 'green', canRevoke: false, fullyCancelled: false };
    };

    const handleRevokeAbsence = async (doctorId) => {
        try {
            const todayStr = dayjs().format('YYYY-MM-DD');
            await revokeDoctorAbsence(doctorId, todayStr);
            message.success("Schedule restored successfully!");
            getDoctors(dispatch); 
        } catch (error) {
            message.error("Failed to revoke absence.");
        }
    };

    const columns = [
        { title: 'Doctor Name', key: 'name', render: (_, record) => <strong>Dr. {record.personalInfo?.firstName} {record.personalInfo?.lastName}</strong> },
        { title: 'Specialization', dataIndex: ['professionalInfo', 'specialization'], key: 'specialization' },
        { title: 'Today\'s Status', key: 'todayStatus', render: (_, record) => {
            const status = getTodayStatus(record);
            return <Tag color={status.color}>{status.text}</Tag>;
        }},
        { title: 'Fees (New / FUP)', key: 'fees', render: (_, record) => `₹${record.fees?.newConsultation} / ₹${record.fees?.followUpConsultation}` },
        { title: 'Assigned Cabin', dataIndex: 'assignedCounterId', key: 'cabin', render: (id) => {
            const room = rooms.find(r => r.counterId === id);
            return room ? <Tag color="blue">{room.name}</Tag> : <Text type="secondary">Unassigned</Text>;
        }},
        { title: 'Avg Time/Pt', dataIndex: ['consultationRules', 'avgTimePerPatientMinutes'], key: 'time', render: (time) => <Tag icon={<ClockCircleOutlined />}>{time} mins</Tag> },
        { title: 'Actions', key: 'action', render: (_, record) => {
            const status = getTodayStatus(record);
            return (
                <Space size="middle">
                    <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => openDrawer(record)} />
                    
                    {status.canRevoke ? (
                        <Popconfirm title="Revoke absence/delay and restore schedule?" onConfirm={() => handleRevokeAbsence(record.doctorId)}>
                            <Button size="small" type="primary" style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>Revoke Status</Button>
                        </Popconfirm>
                    ) : null}

                    {!status.fullyCancelled && (
                        <Button type="primary" size="small" icon={<AlertOutlined />} danger onClick={() => { setEditingDoctor(record); setOverrideModalVisible(true); }}>
                            Delay / Leave
                        </Button>
                    )}
                    
                    <Button size="small" type="dashed" onClick={() => handleOpenSpecialShift(record)} icon={<PlusSquareOutlined />} style={{ color: '#722ed1', borderColor: '#722ed1' }}>
                        Special Shift
                    </Button>
                </Space>
            );
        }}
    ];

    const tabItems = [
        { key: '1', label: 'Profile & Fees', children: <DoctorProfileTab rooms={rooms} />, forceRender: true },
        { key: '2', label: 'Weekly Schedule', children: <DoctorScheduleTab form={form} />, forceRender: true },
        { 
            key: '3', 
            label: 'Leave Ledger', 
            children: <DoctorLeavesTab doctor={editingDoctor} refreshData={(updated) => { getDoctors(dispatch); if (updated) setEditingDoctor(updated); }} /> 
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Doctor Directory</Title>
                    <Text type="secondary">Manage doctor profiles, schedules, and clinical leaves</Text>
                </div>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openDrawer()}>
                    Add Doctor
                </Button>
            </div>

            <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Table columns={columns} dataSource={doctors} rowKey="doctorId" loading={isFetching} />
            </Card>

            <Drawer title={editingDoctor ? "Edit Doctor Profile" : "Add New Doctor"} width={'100%'} onClose={() => setDrawerVisible(false)} open={drawerVisible} extra={<Button type="primary" onClick={() => form.submit()}>Save Doctor</Button>}>
                <Form form={form} layout="vertical" onFinish={handleSaveDoctor}>
                    <Tabs defaultActiveKey="1" items={tabItems} />
                </Form>
            </Drawer>

            <DoctorOverrideModal visible={overrideModalVisible} onCancel={() => setOverrideModalVisible(false)} onSave={handleSaveOverride} doctor={editingDoctor} />
            <DoctorSpecialShiftModal visible={specialShiftModalVisible} onCancel={() => { setSpecialShiftModalVisible(false); setSelectedDoctorForSpecialShift(null); }} onSuccess={() => { setSpecialShiftModalVisible(false); setSelectedDoctorForSpecialShift(null); getDoctors(dispatch); }} doctor={selectedDoctorForSpecialShift} />
        </div>
    );
};

export default DoctorManager;