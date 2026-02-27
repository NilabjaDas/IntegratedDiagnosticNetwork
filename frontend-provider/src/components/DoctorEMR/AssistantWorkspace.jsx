import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message, Row, Col, Card, Avatar, Space, Tag, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartmentQueue, updateTokenStatus } from '../../redux/apiCalls';
import WaitingQueueList from './WaitingQueueList';

const { Title, Text } = Typography;

const AssistantWorkspace = () => {
    const dispatch = useDispatch();
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const { queue, isFetching } = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY] || state.queue);
    const consultationQueue = useMemo(() => {
        return queue.filter(token => token.department === 'Consultation');
    }, [queue]);
    
    const activeToken = consultationQueue.find(t => t.status === 'IN_CABIN' || t.status === 'CALLED' || t.status === 'IN_PROGRESS');
    useEffect(() => {
        // USE EXISTING API CALL
        fetchDepartmentQueue(dispatch, "Consultation");
    }, [dispatch]);

    const handleAction = async (tokenId, action) => {
        setActionLoadingId(tokenId);
        try {
            await updateTokenStatus(dispatch, tokenId, action);
            if (action === 'SEND_TO_CABIN') message.success("Patient called to cabin!");
        } catch (error) {
            message.error("Failed to update status");
        } finally {
            setActionLoadingId(null);
        }
    };

    // The assistant needs to know who is inside the cabin, and if the doctor is busy.

    if (isFetching && queue.length === 0) {
        return <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}><Spin size="large" /></div>;
    }

    return (
        <div style={{ padding: '24px', height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#f0f2f5' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Assistant Workspace</Title>
                <Text type="secondary">Manage the waiting queue and send patients to the Doctor's Cabin.</Text>
            </div>

            <Row gutter={24}>
                {/* DOCTOR STATUS BANNER */}
                <Col span={24} style={{ marginBottom: 24 }}>
                    <Card style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Title level={5} style={{ marginTop: 0, color: '#8c8c8c' }}>Doctor's Cabin Status</Title>
                        
                        {!activeToken ? (
                            <div style={{ padding: '16px 0', textAlign: 'center' }}>
                                <Text strong style={{ fontSize: 18, color: '#52c41a' }}>Cabin is Empty</Text><br/>
                                <Text type="secondary">Call the next patient from the queue below.</Text>
                            </div>
                        ) : (
                            <Row align="middle" justify="space-between" style={{ background: '#e6f7ff', padding: 16, borderRadius: 8, border: '1px solid #91d5ff' }}>
                                <Col>
                                    <Space size="large">
                                        <Avatar size={50} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <Text strong style={{ fontSize: 16, color: '#0050b3' }}>
                                                    {activeToken.patientDetails?.name || activeToken.patientName}
                                                </Text>
                                                <Tag color="blue">{activeToken.tokenNumber}</Tag>
                                            </div>
                                            <Text type="secondary">Age: {activeToken.patientDetails?.age || "N/A"} • Gender: {activeToken.patientDetails?.gender || "N/A"}</Text>
                                        </div>
                                    </Space>
                                </Col>
                                <Col>
                                    {activeToken.status === 'IN_PROGRESS' ? (
                                        <Tag color="orange" style={{ fontSize: 14, padding: '6px 12px' }}>Doctor is Consulting...</Tag>
                                    ) : (
                                        <Tag color="cyan" style={{ fontSize: 14, padding: '6px 12px' }}>Patient in Cabin</Tag>
                                    )}
                                </Col>
                            </Row>
                        )}
                    </Card>
                </Col>
                
                {/* WAITING QUEUE */}
                <Col span={24}>
                    <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Title level={5} style={{ marginBottom: 16 }}>Waiting Queue</Title>
                        <WaitingQueueList 
                            queue={queue} 
                            onAction={handleAction} 
                            loadingId={actionLoadingId} 
                        />
                    </div>
                </Col>
            </Row>
        </div>
    );
};

export default AssistantWorkspace;