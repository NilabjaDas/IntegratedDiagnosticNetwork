import React, { useState, useEffect } from 'react';
import { Calendar, Typography, Button, Tooltip, Badge } from 'antd';
import { CalendarOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const BookingCalendar = ({ 
    selectedDoctorId, 
    scheduleDate, 
    setScheduleDate, 
    monthlyBookings = [], 
    disabledDate 
}) => {
    const [panelDate, setPanelDate] = useState(scheduleDate || dayjs());

    useEffect(() => {
        if (scheduleDate) {
            setPanelDate(scheduleDate);
        }
    }, [scheduleDate]);

    const customHeaderRender = ({ value, type, onChange }) => {
        return (
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
                <Button 
                    type="text" 
                    icon={<LeftOutlined />} 
                    onClick={() => {
                        const newDate = value.clone().subtract(1, 'month');
                        onChange(newDate);
                        setPanelDate(newDate); 
                    }} 
                />
                <Text strong style={{ fontSize: 15, color: '#262626' }}>{value.format('MMMM YYYY')}</Text>
                <Button 
                    type="text" 
                    icon={<RightOutlined />} 
                    onClick={() => {
                        const newDate = value.clone().add(1, 'month');
                        onChange(newDate);
                        setPanelDate(newDate); 
                    }} 
                />
            </div>
        );
    };

    const customFullCellRender = (date) => {
        const isSelected = scheduleDate && date.isSame(scheduleDate, 'day');
        const isToday = date.isSame(dayjs(), 'day');
        const isDisabled = disabledDate(date);
        
        // FIX: Check if this date actually belongs to the month currently being viewed
        const isCurrentMonth = date.month() === panelDate.month();
        
        const dateStr = date.format("YYYY-MM-DD");
        const dayBookings = monthlyBookings?.filter(b => b.date === dateStr) || [];
        const bookingCount = dayBookings.length;

        // Dynamic styling
        const cellStyle = {
            height: '42px',
            width: '90%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: '8px',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            background: isSelected ? '#1890ff' : 'transparent',
            
            // FIX: Faded gray for out-of-month dates, darker colors for current month
            color: isSelected ? '#fff' : (isDisabled ? '#d9d9d9' : (isCurrentMonth ? '#1f1f1f' : '#bfbfbf')), 
            
            // FIX: Only bold the available dates that are in the current month
            fontWeight: isSelected ? 600 : (isDisabled || !isCurrentMonth ? 400 : 600),
            
            transition: 'all 0.2s ease-in-out',
            border: isToday && !isSelected ? '1px solid #1890ff' : '1px solid transparent'
        };

        const tooltipContent = isDisabled 
            ? "Doctor Not Available" 
            : (bookingCount > 0 ? `${bookingCount} Patient(s) Booked` : "Available to Book");

        return (
            <Tooltip title={tooltipContent} mouseEnterDelay={0.3} arrowPointAtCenter>
                <div 
                    className={`modern-cal-cell ${!isDisabled && !isSelected ? 'hoverable-cell' : ''}`}
                    style={cellStyle}
                    onClick={() => {
                        if (!isDisabled) {
                            setScheduleDate(date);
                            setPanelDate(date);
                        }
                    }}
                >
                    <div style={{ lineHeight: '1.2' }}>{date.date()}</div>
                    {!isDisabled && bookingCount > 0 && (
                        <div style={{ marginTop: 2 }}>
                            <Badge 
                                count={bookingCount} 
                                style={{ 
                                    backgroundColor: isSelected ? '#fff' : '#52c41a', 
                                    color: isSelected ? '#1890ff' : '#fff', 
                                    transform: 'scale(0.65)', 
                                    boxShadow: 'none',
                                    marginTop: '-6px',
                                    // Optionally fade the badge slightly if it's not the current month
                                    opacity: isCurrentMonth ? 1 : 0.6 
                                }} 
                            />
                        </div>
                    )}
                </div>
            </Tooltip>
        );
    };

    return (
        <div style={{ padding: "12px", borderBottom: "1px solid #f0f0f0", background: '#fafafa' }}>
            <Title level={5} style={{ margin: '0 0 8px 0', fontSize: 14 }}>Availability Calendar</Title>
            {!selectedDoctorId ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf', border: '1px dashed #d9d9d9', borderRadius: 8, background: '#fff' }}>
                    <CalendarOutlined style={{ fontSize: 28, marginBottom: 8 }} />
                    <div style={{ fontSize: 12 }}>Select a doctor to view availability</div>
                </div>
            ) : (
                <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <style>{`
                        .ant-picker-calendar-date { margin: 0 !important; padding: 0 !important; border-top: none !important; }
                        .ant-picker-cell-inner { padding: 4px 0 !important; }
                        .ant-picker-cell-selected .ant-picker-cell-inner { background: transparent !important; }
                        .ant-picker-cell-selected::before { display: none !important; }
                        .hoverable-cell:hover { background: #e6f7ff !important; color: #1890ff !important; }
                    `}</style>
                    <Calendar 
                        fullscreen={false} 
                        value={panelDate}
                        headerRender={customHeaderRender}
                        fullCellRender={customFullCellRender}
                    />
                </div>
            )}
        </div>
    );
};

export default BookingCalendar;