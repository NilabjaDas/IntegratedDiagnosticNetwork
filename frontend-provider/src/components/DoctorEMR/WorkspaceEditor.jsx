import React from 'react';
import { Card, Row, Col, Typography, Tag, Button, Empty, Space } from 'antd';
import { CheckCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import RichTextEditor from '../RichTextEditor';

const { Title, Text } = Typography;

const WorkspaceEditor = ({ activeToken, prescriptionContent, setPrescriptionContent, onSave, onHold, saving }) => {
    return (
        <Card size="small" style={{ flex: 1, display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {!activeToken ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Empty description="Select 'Start' on a patient from the queue to begin consultation" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    
                    {/* Active Patient Header */}
                    <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #f0f0f0' }}>
                        <Row justify="space-between" align="middle">
                            <Col>
                                <Space size="large">
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Patient Name</Text>
                                        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>{activeToken.patientDetails?.name}</Title>
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Age / Gender</Text>
                                        <div style={{ fontWeight: 500 }}>{activeToken.patientDetails?.age} Y / {activeToken.patientDetails?.gender}</div>
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Token No.</Text>
                                        <div style={{ fontWeight: 500 }}>{activeToken.tokenNumber}</div>
                                    </div>
                                </Space>
                            </Col>
                            <Col>
                                <Tag color="purple" style={{ padding: '4px 12px', fontSize: 14 }}>IN PROGRESS</Tag>
                            </Col>
                        </Row>
                    </div>

                    {/* Prescription Editor */}
                    <Text strong style={{ marginBottom: 8 }}>Digital Prescription / Clinical Notes</Text>
                    <div style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
                        <RichTextEditor 
                            value={prescriptionContent} 
                            onChange={setPrescriptionContent} 
                            style={{ height: '100%' }}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button icon={<PauseCircleOutlined />} onClick={() => onHold(activeToken)}>
                            Hold (Send to Waiting)
                        </Button>
                        <Button 
                            type="primary" 
                            size="large" 
                            icon={<CheckCircleOutlined />} 
                            onClick={() => onSave(activeToken._id, prescriptionContent)}
                            loading={saving}
                        >
                            Complete Consultation
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default WorkspaceEditor;