import React, { useState, useEffect } from 'react';
import { Calendar, Badge, Drawer, Spin, Typography, List, Tag, Space, Alert, Select, Button, Row, Col, Avatar, message } from 'antd';
import { CalendarOutlined, LeftOutlined, RightOutlined, UserOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { fetchDoctorMonthlyBookings } from '../../redux/apiCalls';

// Import your existing OrderDetailsDrawer
import OrderDetailsDrawer from '../OrderManager/OrderDetailsDrawer';

const { Title, Text } = Typography;
const { Option } = Select;

const DoctorCalendarWorkspace = ({ visible, onClose, doctors }) => {
    const [selectedDoctorId, setSelectedDoctorId] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Calendar States
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [dayDetailsVisible, setDayDetailsVisible] = useState(false);
    const [dayDetails, setDayDetails] = useState(null);

    // Order Details State
    const [selectedOrderId, setSelectedOrderId] = useState(null);

    // Auto-select the first doctor when the modal opens
    useEffect(() => {
        if (visible && !selectedDoctorId && doctors?.length > 0) {
            setSelectedDoctorId(doctors[0].doctorId);
        }
    }, [visible, doctors, selectedDoctorId]);

    useEffect(() => {
        if (visible && selectedDoctorId) {
            loadMonthData(selectedDoctorId, selectedDate);
        }
    }, [selectedDoctorId, selectedDate.month(), selectedDate.year(), visible]);

    const loadMonthData = async (docId, date) => {
        setLoading(true);
        const data = await fetchDoctorMonthlyBookings(docId, date.year(), date.month() + 1);
        setBookings(data || []);
        setLoading(false);
    };

    const activeDoctor = doctors?.find(d => d.doctorId === selectedDoctorId);

const handleDateSelect = (date, info) => {
        setSelectedDate(date);
        
        // FIX: Only open the drawer if the user explicitly clicked a day cell (not when changing months)
        if (info?.source === 'date') {
            const dateStr = date.format('YYYY-MM-DD');
            const dayData = getDayData(date);
            setDayDetails({ date: dateStr, ...dayData });
            setDayDetailsVisible(true);
        }
    };

    const getDayData = (date) => {
        if (!activeDoctor) return null;
        
        const dateStr = date.format('YYYY-MM-DD');
        const dayOfWeek = date.day();
        
        const baseSchedule = activeDoctor.schedule?.find(s => s.dayOfWeek === dayOfWeek);
        const isNormallyAvailable = baseSchedule?.isAvailable;
        const totalBaseShifts = isNormallyAvailable ? baseSchedule.shifts.length : 0;

        const isPlannedLeave = activeDoctor.leaves?.some(l => dateStr >= l.startDate && dateStr <= l.endDate);

        const overrides = activeDoctor.dailyOverrides?.filter(o => o.date === dateStr) || [];
        const isFullDayOverride = overrides.some(o => o.isCancelled && (!o.shiftNames || o.shiftNames.length >= totalBaseShifts));
        
        const dayBookings = bookings.filter(b => b.date === dateStr);
        const totalBooked = dayBookings.length;
        const waiting = dayBookings.filter(b => b.status === 'WAITING').length;
        const completed = dayBookings.filter(b => b.status === 'COMPLETED').length;

        let status = 'normal';
        let badgeType = 'success';
        
        if (isPlannedLeave || isFullDayOverride) {
            status = 'leave';
            badgeType = 'error';
        } else if (!isNormallyAvailable && overrides.length === 0 && (!activeDoctor.specialShifts || !activeDoctor.specialShifts.some(s => s.date === dateStr))) {
            status = 'off';
            badgeType = 'default';
        } else if (overrides.some(o => o.delayMinutes > 0)) {
            status = 'delayed';
            badgeType = 'warning';
        }

        return { status, badgeType, totalBaseShifts, totalBooked, waiting, completed, dayBookings, baseSchedule, overrides, isPlannedLeave };
    };

    const cellRender = (current, info) => {
        if (info.type !== 'date') return info.originNode;
        
        const data = getDayData(current);
        if (!data || data.status === 'off') return null;

        return (
            <div style={{ fontSize: '12px', padding: '4px 0' }}>
                {data.status === 'leave' ? (
                    <Badge status="error" text={<span style={{ color: 'red', fontWeight: 500 }}>On Leave</span>} />
                ) : (
                    <>
                        {data.totalBaseShifts > 0 && (
                            <div><Badge status="processing" text={<span style={{ color: '#595959' }}>{data.totalBaseShifts} Shifts</span>} /></div>
                        )}
                        {data.status === 'delayed' && (
                            <div><Badge status="warning" text="Delayed" /></div>
                        )}
                        {data.totalBooked > 0 && (
                            <div style={{ marginTop: 6, padding: '2px 6px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, display: 'inline-block' }}>
                                <Text type="success" strong>{data.totalBooked} Booked</Text>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // CUSTOM SATISFYING CALENDAR HEADER
    const headerRender = ({ value, type, onChange, onTypeChange }) => {
        const start = 0;
        const end = 12;
        const monthOptions = [];
        const current = value.clone();
        const localeData = value.localeData();
        const months = [];
        for (let i = 0; i < 12; i++) {
            current.month(i);
            months.push(localeData.monthsShort(current));
        }

        for (let i = start; i < end; i++) {
            monthOptions.push(
                <Option key={i} value={i} className="month-item">
                    {months[i]}
                </Option>,
            );
        }

        const year = value.year();
        const month = value.month();
        const options = [];
        for (let i = year - 5; i < year + 5; i += 1) {
            options.push(
                <Option key={i} value={i} className="year-item">
                    {i}
                </Option>,
            );
        }

        return (
            <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', background: '#fafafa', borderRadius: '8px 8px 0 0' }}>
                <Space size="middle">
                    <Button 
                        icon={<LeftOutlined />} 
                        onClick={() => {
                            const newValue = value.clone().subtract(1, 'month');
                            onChange(newValue);
                            setSelectedDate(newValue);
                        }} 
                    />
                    <Title level={4} style={{ margin: 0, minWidth: 160, textAlign: 'center' }}>
                        {value.format('MMMM YYYY')}
                    </Title>
                    <Button 
                        icon={<RightOutlined />} 
                        onClick={() => {
                            const newValue = value.clone().add(1, 'month');
                            onChange(newValue);
                            setSelectedDate(newValue);
                        }} 
                    />
                </Space>
                <Space>
                    <Button onClick={() => {
                        const today = dayjs();
                        onChange(today);
                        setSelectedDate(today);
                    }}>
                        Today
                    </Button>
                    <Select
                        size="middle"
                        dropdownMatchSelectWidth={false}
                        value={month}
                        onChange={(newMonth) => {
                            const newValue = value.clone().month(newMonth);
                            onChange(newValue);
                            setSelectedDate(newValue);
                        }}
                    >
                        {monthOptions}
                    </Select>
                    <Select
                        size="middle"
                        dropdownMatchSelectWidth={false}
                        value={year}
                        onChange={(newYear) => {
                            const newValue = value.clone().year(newYear);
                            onChange(newValue);
                            setSelectedDate(newValue);
                        }}
                    >
                        {options}
                    </Select>
                </Space>
            </div>
        );
    };

    return (
        <Drawer
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarOutlined style={{ marginRight: 12, fontSize: '24px', color: '#1890ff' }}/>
                        <span style={{ fontSize: '20px', fontWeight: 600 }}>Doctor Schedule & Bookings</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: 40 }}>
                        <Text strong style={{ marginRight: 12, fontSize: 16 }}>Viewing:</Text>
                        <Select 
                            size="large"
                            style={{ width: 300 }} 
                            value={selectedDoctorId} 
                            onChange={setSelectedDoctorId}
                            showSearch
                            optionFilterProp="children"
                        >
                            {doctors.map(doc => (
                                <Option key={doc.doctorId} value={doc.doctorId}>
                                    <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8, backgroundColor: '#1890ff' }} />
                                    Dr. {doc.personalInfo?.firstName} {doc.personalInfo?.lastName}
                                </Option>
                            ))}
                        </Select>
                    </div>
                </div>
            }
            width="100%"
            onClose={onClose}
            open={visible}
            styles={{ body: { backgroundColor: '#f4f6f8', padding: '24px' } }}
            destroyOnClose={false}
        >
            <div style={{ position: 'relative', background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {loading && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                        <Spin size="large" tip="Loading Schedule..." />
                    </div>
                )}
                
                <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                    <Calendar 
                        value={selectedDate} 
                        onSelect={handleDateSelect} 
                        headerRender={headerRender}
                        cellRender={cellRender} 
                    />
                </div>
            </div>

            {/* INNER DRAWER: DAY DETAILS */}
            <Drawer
                title={
                    <Space>
                        <CalendarOutlined style={{ color: '#1890ff' }}/>
                        <span>Details for {dayDetails?.date}</span>
                    </Space>
                }
                placement="right"
                width={500}
                onClose={() => setDayDetailsVisible(false)}
                open={dayDetailsVisible}
                styles={{ body: { padding: '16px 24px', backgroundColor: '#fafafa' } }}
            >
                {dayDetails && (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      {dayDetails.status === 'leave' && <Alert message="Doctor is on leave this day." type="error" showIcon />}
{dayDetails.status === 'off' && <Alert message="Scheduled Off Day." type="info" showIcon />}
{dayDetails.status === 'delayed' && <Alert message="Doctor has reported a delay for today." type="warning" showIcon />}

                        {dayDetails.baseSchedule?.shifts?.length > 0 && (
                            <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}><ClockCircleOutlined /> Scheduled Shifts</Title>
                                <Row gutter={[12, 12]}>
                                    {dayDetails.baseSchedule.shifts.map(shift => (
                                        <Col span={24} key={shift.shiftName}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f9f9f9', borderRadius: 6 }}>
                                                <Text strong>{shift.shiftName}</Text>
                                                <Text type="secondary">
                                                    {shift.timeRange?.[0]?.format('HH:mm') || shift.startTime} - {shift.timeRange?.[1]?.format('HH:mm') || shift.endTime}
                                                </Text>
                                            </div>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        )}

                        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Title level={5} style={{ margin: 0 }}><UserOutlined /> Patient Bookings</Title>
                                <Tag color="blue">{dayDetails.totalBooked} Total</Tag>
                            </div>
                            
                            {dayDetails.dayBookings.length > 0 ? (
                                <List
                                    itemLayout="horizontal"
                                    dataSource={dayDetails.dayBookings}
                                    renderItem={booking => {
                                        let color = 'blue';
                                        if (booking.status === 'COMPLETED') color = 'green';
                                        if (booking.status === 'CANCELLED') color = 'red';
                                        if (booking.status === 'DOC_UNVAILABLE') color = 'volcano';

                                        return (
                                            <List.Item 
                                                style={{ 
                                                    padding: '12px', 
                                                    border: '1px solid #f0f0f0', 
                                                    borderRadius: 8, 
                                                    marginBottom: 8,
                                                    cursor: booking.orderId ? 'pointer' : 'default',
                                                    transition: 'all 0.2s',
                                                }}
                                                className="booking-list-item"
                                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1890ff'}
                                                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f0f0f0'}
                                                onClick={() => {
                                                    if(booking.orderId) setSelectedOrderId(booking.orderId);
                                                    else message.info("No order ID associated with this booking.");
                                                }}
                                            >
                                                <List.Item.Meta
                                                    avatar={<Avatar style={{ backgroundColor: '#e6f7ff', color: '#1890ff' }}>{booking.tokenNumber}</Avatar>}
                                                    title={<Text strong>{booking.patientName}</Text>}
                                                    description={<Text type="secondary" style={{ fontSize: 12 }}>{booking.shiftName}</Text>}
                                                />
                                                <Space direction="vertical" align="end" size={2}>
                                                    <Tag color={color} style={{ margin: 0 }}>{booking.status}</Tag>
                                                    {booking.orderId && <Text type="secondary" style={{ fontSize: 11 }}><InfoCircleOutlined /> Click for Order</Text>}
                                                </Space>
                                            </List.Item>
                                        );
                                    }}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <Text type="secondary">No patients booked for this day.</Text>
                                </div>
                            )}
                        </div>

                    </Space>
                )}
            </Drawer>

            {/* ORDER DETAILS DRAWER OVERLAY */}
            <OrderDetailsDrawer 
                open={!!selectedOrderId}
                orderId={selectedOrderId}
                onClose={() => setSelectedOrderId(null)}
            />
            
        </Drawer>
    );
};

export default DoctorCalendarWorkspace;