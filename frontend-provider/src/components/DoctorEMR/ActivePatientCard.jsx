import React from 'react';
import { Card, Typography, Button, Row, Col, Tag, Avatar, Space, Divider } from 'antd';
import { UserOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const ActivePatientCard = ({ activeToken, onStartConsultation, loading }) => {
    if (!activeToken) {
        return (
            <Card style={{ background: '#fafafa', border: '1px dashed #d9d9d9', textAlign: 'center', padding: '24px 0', borderRadius: 8 }}>
                <Text type="secondary" style={{ fontSize: 16 }}>No patient currently in cabin.</Text>
                <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Call a patient from the waiting list below, or wait for the assistant to send them in.</Text>
                </div>
            </Card>
        );
    }

    return (
        <Card 
            style={{ 
                background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)', 
                border: '1px solid #91d5ff', 
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)'
            }}
            bodyStyle={{ padding: '20px 24px' }}
        >
            <Row align="middle" justify="space-between">
                <Col>
                    <Space size="large">
                        <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                <Title level={3} style={{ margin: 0, color: '#0050b3' }}>
                                    {activeToken.patientDetails?.name || activeToken.patientName || "Walk-in Patient"}
                                </Title>
                                <Tag color="blue" style={{ fontSize: 14, padding: '2px 8px' }}>{activeToken.tokenNumber}</Tag>
                            </div>
                            <Space split={<Divider type="vertical" style={{ background: '#91d5ff' }} />}>
                                <Text strong style={{ color: '#003a8c' }}>Age: {activeToken.patientDetails?.age || "N/A"}</Text>
                                <Text strong style={{ color: '#003a8c' }}>Gender: {activeToken.patientDetails?.gender || "N/A"}</Text>
                                <Text type="secondary" style={{ color: '#0050b3' }}>Mobile: {activeToken.patientDetails?.mobile || "N/A"}</Text>
                            </Space>
                        </div>
                    </Space>
                </Col>
                <Col>
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<PlayCircleOutlined />} 
                        onClick={() => onStartConsultation(activeToken._id)}
                        loading={loading}
                        style={{ height: 50, fontSize: 16, borderRadius: 8, background: '#1890ff', borderColor: '#1890ff' }}
                    >
                        Start Consultation
                    </Button>
                </Col>
            </Row>
        </Card>
    );
};

export default ActivePatientCard;