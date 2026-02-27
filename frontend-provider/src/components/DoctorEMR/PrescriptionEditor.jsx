import React, { useState } from 'react';
import { Card, Button, Input, Space, Typography, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PrescriptionEditor = ({ activeToken, onComplete, loading }) => {
    // In reality, this would be a rich text editor or a highly structured form.
    // We are keeping it simple for the layout foundation.
    const [prescription, setPrescription] = useState(activeToken.prescriptionHtml || "");

    return (
        <Card 
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                        <Tag color="processing" style={{ fontSize: 16, padding: '4px 12px' }}>{activeToken.tokenNumber}</Tag>
                        <Title level={4} style={{ margin: 0 }}>Consulting: {activeToken.patientDetails?.name || activeToken.patientName}</Title>
                    </Space>
                    <Tag color="green">Status: IN PROGRESS</Tag>
                </div>
            }
            style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24 }}
        >
            <div style={{ flex: 1, marginBottom: 24 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Clinical Notes & Prescription</Text>
                <TextArea 
                    rows={15} 
                    placeholder="Enter Rx, Symptoms, and Advice here..." 
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                    style={{ fontSize: 16, padding: 16 }}
                />
            </div>

            <div style={{ textAlign: 'right' }}>
                <Button 
                    type="primary" 
                    size="large" 
                    icon={<CheckCircleOutlined />}
                    loading={loading}
                    onClick={() => onComplete(activeToken._id, prescription)}
                    style={{ background: '#52c41a', borderColor: '#52c41a', minWidth: 200 }}
                >
                    Complete & Save
                </Button>
            </div>
        </Card>
    );
};

export default PrescriptionEditor;