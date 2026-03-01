import React, { useState, useEffect } from 'react';
import { Card, Button, Select, Space, Typography, Tag, Popconfirm, message } from 'antd';
import { PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLiveShifts, actionLiveShift } from '../../redux/apiCalls';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const ShiftControlBanner = ({ doctor, role, onActiveShiftChange }) => {
    const dispatch = useDispatch();
    const [selectedShiftToStart, setSelectedShiftToStart] = useState(null);
    const [loading, setLoading] = useState(false);

    // Pull live shifts from Redux
    const liveShifts = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]?.liveShifts || []);
    const doctorId = doctor?._id || doctor?.doctorId;

    // Fetch shifts on mount
    useEffect(() => {
        if (doctorId) {
            fetchLiveShifts(dispatch, doctorId);
        }
    }, [dispatch, doctorId]);

    // Calculate today's shift names from the doctor's schedule (including special shifts)
    const getTodayAvailableShiftNames = () => {
        if (!doctor) return [];
        const today = dayjs();
        const dateStr = today.format('YYYY-MM-DD');
        const dayIndex = today.day();
        const weekOfMonth = Math.ceil(today.date() / 7);

        let shiftNames = [];
        const daySchedule = doctor.schedule?.find(s => s.dayOfWeek === dayIndex);
        if (daySchedule && daySchedule.isAvailable) {
            daySchedule.shifts.forEach(s => {
                if (!s.repeatWeeks || s.repeatWeeks.length === 0 || s.repeatWeeks.includes(weekOfMonth)) {
                    shiftNames.push(s.shiftName);
                }
            });
        }
        
        // Add Special Shifts
        const special = doctor.specialShifts?.filter(s => s.date === dateStr) || [];
        special.forEach(s => shiftNames.push(s.shiftName));

        return [...new Set(shiftNames)]; // Unique names
    };

    const availableShiftNames = getTodayAvailableShiftNames();

    // Determine the currently active shift
    const activeShift = liveShifts.find(s => s.doctorId === doctorId && s.status === 'IN_PROGRESS');

    // Notify parent workspace when active shift changes so it can filter the queue!
    useEffect(() => {
        onActiveShiftChange(activeShift ? activeShift.shiftName : null);
    }, [activeShift, onActiveShiftChange]);

    const handleAction = async (action, shiftName) => {
        if (!shiftName) return message.error("Please select a shift first.");
        setLoading(true);
        try {
            await actionLiveShift(dispatch, doctorId, { action, shiftName });
            message.success(`Shift ${action} successful!`);
        } catch (error) {
            message.error(`Failed to ${action} shift.`);
        } finally {
            setLoading(false);
        }
    };

    if (!doctor) return null;

    // Read permissions
    const config = doctor.billingPreferences || {};
    const capabilities = role === 'Doctor' ? config.doctorCapabilities : config.assistantCapabilities;
    const canStartEnd = capabilities?.canStartCompleteShifts !== false;
    const canCancel = capabilities?.canCancelShifts === true;

    return (
        <Card size="small" style={{ marginBottom: 24, borderColor: activeShift ? '#b7eb8f' : '#d9d9d9', backgroundColor: activeShift ? '#f6ffed' : '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size="large">
                    <Text strong style={{ fontSize: 16 }}>Shift Control</Text>
                    {activeShift ? (
                        <Tag color="success" style={{ fontSize: 14, padding: '4px 10px' }}>
                            <span className="pulse-dot" style={{ display: 'inline-block', width: 8, height: 8, background: '#52c41a', borderRadius: '50%', marginRight: 8, animation: 'pulse 2s infinite' }}></span>
                            {activeShift.shiftName} Shift In Progress
                        </Tag>
                    ) : (
                        <Tag color="default" style={{ fontSize: 14, padding: '4px 10px' }}>No Active Shift</Tag>
                    )}
                </Space>

                <Space>
                    {!activeShift ? (
                        <>
                            <Select 
                                placeholder="Select Shift to Start" 
                                style={{ width: 200 }} 
                                value={selectedShiftToStart} 
                                onChange={setSelectedShiftToStart}
                            >
                                {availableShiftNames.map(name => {
                                    const isDone = liveShifts.find(s => s.shiftName === name && (s.status === 'COMPLETED' || s.status === 'CANCELLED'));
                                    return <Option key={name} value={name} disabled={!!isDone}>{name} {isDone ? '(Ended)' : ''}</Option>;
                                })}
                            </Select>
                            {canStartEnd && (
                                <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleAction('START', selectedShiftToStart)} loading={loading} disabled={!selectedShiftToStart}>
                                    Start Shift
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            {canStartEnd && (
                                <Popconfirm title="End this shift? No more patients can be called." onConfirm={() => handleAction('COMPLETE', activeShift.shiftName)}>
                                    <Button type="primary" danger icon={<CheckCircleOutlined />} loading={loading}>Complete Shift</Button>
                                </Popconfirm>
                            )}
                            {canCancel && (
                                <Popconfirm title="Cancel this shift? This will mark it as abandoned." onConfirm={() => handleAction('CANCEL', activeShift.shiftName)}>
                                    <Button type="dashed" danger icon={<CloseCircleOutlined />} loading={loading}>Cancel Shift</Button>
                                </Popconfirm>
                            )}
                        </>
                    )}
                </Space>
            </div>
            {/* Add a tiny CSS animation for the pulse effect */}
            <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }`}</style>
        </Card>
    );
};

export default ShiftControlBanner;