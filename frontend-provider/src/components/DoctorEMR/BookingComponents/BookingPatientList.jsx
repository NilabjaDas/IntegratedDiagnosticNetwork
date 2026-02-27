import React from 'react';
import { List, Avatar, Tag, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const BookingPatientList = ({ selectedDoctorId, dayBookings, setDetailOrderId }) => {
    return (
        <div style={{ flex: 1, padding: "12px", overflowY: "auto", background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Title level={5} style={{ margin: 0, fontSize: 14 }}><ClockCircleOutlined /> Booked Patients</Title>
                <Tag color="blue">{dayBookings.length} Total</Tag>
            </div>
            
            {!selectedDoctorId ? (
                <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 30, fontSize: 12 }}>Waiting for doctor selection...</Text>
            ) : (
                <List
                    size="small"
                    dataSource={dayBookings}
                    locale={{ emptyText: <div style={{ fontSize: 12, padding: 20 }}>No patients booked for this date.</div> }}
                    renderItem={booking => {
                        let color = 'blue';
                        if (booking.status === 'COMPLETED') color = 'green';
                        if (booking.status === 'CANCELLED') color = 'red';
                        if (booking.status === 'DOC_UNVAILABLE') color = 'volcano';

                        return (
                            <List.Item 
                                style={{ 
                                    padding: '8px', 
                                    border: '1px solid #f0f0f0', 
                                    borderRadius: 6, 
                                    marginBottom: 6,
                                    cursor: booking.orderId ? 'pointer' : 'default',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1890ff'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f0f0f0'}
                                onClick={() => {
                                    if(booking.orderId) setDetailOrderId(booking.orderId);
                                }}
                            >
                                <List.Item.Meta
                                    avatar={<Avatar size="small" style={{ backgroundColor: '#e6f7ff', color: '#1890ff' }}>{booking.tokenNumber}</Avatar>}
                                    title={<Text strong style={{ fontSize: 13 }}>{booking.patientName}</Text>}
                                    description={<Text type="secondary" style={{ fontSize: 11 }}>{booking.shiftName}</Text>}
                                />
                                <Tag color={color} style={{ margin: 0, fontSize: 10 }}>{booking.status}</Tag>
                            </List.Item>
                        );
                    }}
                />
            )}
        </div>
    );
};

export default BookingPatientList;