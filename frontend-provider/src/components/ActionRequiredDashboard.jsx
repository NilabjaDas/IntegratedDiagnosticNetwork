import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Modal, Select, DatePicker, message, Alert, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import { fetchActionRequiredTokens, reschedulePatientToken } from '../redux/apiCalls';

const { Text } = Typography;
const { Option } = Select;

const ActionRequiredDashboard = () => {
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Reschedule Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedToken, setSelectedToken] = useState(null);
    const [newDate, setNewDate] = useState(null);
    const [newShift, setNewShift] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Pull doctors from Redux to figure out their available shifts
    const doctors = useSelector((state) => state.doctor?.doctors || []);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchActionRequiredTokens();
        setTokens(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenReschedule = (token) => {
        setSelectedToken(token);
        setNewDate(null);
        setNewShift(null);
        setIsModalOpen(true);
    };

    const handleSubmitReschedule = async () => {
        if (!newDate || !newShift) return message.warning("Please select a date and shift.");
        
        setSubmitting(true);
        try {
            await reschedulePatientToken(selectedToken._id, newDate.format("YYYY-MM-DD"), newShift);
            message.success("Patient successfully rescheduled with Priority status!");
            setIsModalOpen(false);
            loadData(); // Refresh table
        } catch (error) {
            message.error("Failed to reschedule.");
        }
        setSubmitting(false);
    };

    // Calculate available shifts for the chosen doctor on the chosen date
    const getAvailableShifts = () => {
        if (!selectedToken || !newDate) return [];
        const doctor = doctors.find(d => d._id === selectedToken.doctorId?._id || d._id === selectedToken.doctorId);
        if (!doctor) return [];

        const dayIndex = newDate.day();
        const daySchedule = doctor.schedule?.find(s => s.dayOfWeek === dayIndex);
        return daySchedule?.isAvailable ? daySchedule.shifts : [];
    };

    const availableShifts = getAvailableShifts();

    const columns = [
        { title: 'Patient', dataIndex: ['patientDetails', 'name'], key: 'name', render: text => <b>{text}</b> },
        { title: 'Contact', dataIndex: ['patientDetails', 'mobile'], key: 'mobile' },
        { 
            title: 'Cancelled Appointment', 
            key: 'original', 
            render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <Text type="secondary">Dr. {record.doctorId?.personalInfo?.lastName || "Unknown"}</Text>
                    <Tag color="red">{dayjs(record.date).format("DD MMM YYYY")}</Tag>
                </Space>
            ) 
        },
        { title: 'Reason / Notes', dataIndex: 'notes', key: 'notes', render: text => <Text type="danger" style={{ fontSize: 12 }}>{text}</Text> },
        { 
            title: 'Action', 
            key: 'action', 
            render: (_, record) => (
                <Button type="primary" size="small" icon={<CalendarOutlined />} onClick={() => handleOpenReschedule(record)}>
                    Call & Reschedule
                </Button>
            ) 
        }
    ];

    if (tokens.length === 0) return null; // Don't show the dashboard if there's no emergency

    return (
        <Card 
            title={<><ExclamationCircleOutlined style={{ color: '#cf1322' }} /> Action Required: Cancelled Appointments</>} 
            style={{ marginBottom: 24, border: '1px solid #ffa39e' }}
            headStyle={{ backgroundColor: '#fff1f0' }}
        >
            <Alert 
                message="Emergency Leave Detected" 
                description="The following patients had their appointments automatically cancelled due to doctor unavailability. Please contact them to reschedule. They will automatically receive Priority Queue status upon rebooking." 
                type="error" 
                showIcon 
                style={{ marginBottom: 16 }}
            />
            <Table 
                columns={columns} 
                dataSource={tokens} 
                rowKey="_id" 
                pagination={{ pageSize: 5 }} 
                size="small"
                loading={loading}
            />

            <Modal
                title={`Reschedule ${selectedToken?.patientDetails?.name}`}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={handleSubmitReschedule}
                confirmLoading={submitting}
                okText="Confirm Priority Reschedule"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <div>
                        <Text strong>1. Select New Date:</Text>
                        <DatePicker 
                            style={{ width: '100%', marginTop: 4 }} 
                            value={newDate} 
                            onChange={(d) => { setNewDate(d); setNewShift(null); }} 
                            disabledDate={(current) => current && current < dayjs().startOf('day')}
                        />
                    </div>
                    <div>
                        <Text strong>2. Select Available Shift:</Text>
                        <Select 
                            style={{ width: '100%', marginTop: 4 }} 
                            value={newShift} 
                            onChange={setNewShift} 
                            placeholder={newDate ? "Select Shift" : "Select date first"}
                            disabled={!newDate || availableShifts.length === 0}
                        >
                            {availableShifts.map(s => (
                                <Option key={s.shiftName} value={s.shiftName}>
                                    {s.shiftName} ({s.startTime} - {s.endTime})
                                </Option>
                            ))}
                        </Select>
                        {newDate && availableShifts.length === 0 && (
                            <Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                                Doctor is not scheduled to work on this date.
                            </Text>
                        )}
                    </div>
                </div>
            </Modal>
        </Card>
    );
};

export default ActionRequiredDashboard;