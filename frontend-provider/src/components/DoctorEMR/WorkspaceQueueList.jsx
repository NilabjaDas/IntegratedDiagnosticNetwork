import React from 'react';
import { Card, List, Spin, Typography, Tag, Button, Space, Divider } from 'antd';
import { ClockCircleOutlined, NotificationOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const Avatar = ({ children, style }) => (
    <div style={{ width: 32, height: 32, borderRadius: '50%', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', ...style }}>
        {children}
    </div>
);

const renderStatusTag = (status) => {
    const colors = { WAITING: "orange", CALLED: "blue", IN_PROGRESS: "purple", COMPLETED: "green", HOLD: "red" };
    return <Tag color={colors[status] || "default"}>{status}</Tag>;
};

const WorkspaceQueueList = ({ queue, loadingQueue, activeToken, onPingTV, onStartConsultation }) => {
    return (
        <Card size="small" title="Today's Patient Queue" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} bodyStyle={{ flex: 1, overflowY: 'auto', padding: 0 }}>
            {loadingQueue ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : (
                <List
                    itemLayout="horizontal"
                    dataSource={queue}
                    locale={{ emptyText: 'No patients scheduled for this date.' }}
                    renderItem={item => (
                        <List.Item 
                            style={{ 
                                padding: '12px 16px', 
                                backgroundColor: activeToken?._id === item._id ? '#f0f5ff' : '#fff',
                                borderBottom: '1px solid #f0f0f0',
                                borderLeft: activeToken?._id === item._id ? '4px solid #1890ff' : '4px solid transparent'
                            }}
                        >
                            <List.Item.Meta
                                avatar={<Avatar style={{ backgroundColor: item.status === 'COMPLETED' ? '#52c41a' : '#1890ff' }}>{item.sequence}</Avatar>}
                                title={
                                    <Space>
                                        <Text strong>{item.patientDetails?.name || "Unknown Patient"}</Text>
                                        {renderStatusTag(item.status)}
                                    </Space>
                                }
                                description={
                                    <Space split={<Divider type="vertical" />}>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{item.tokenNumber}</Text>
                                        {item.estimatedTimeFormatted && (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                <ClockCircleOutlined /> ETA: {item.estimatedTimeFormatted}
                                            </Text>
                                        )}
                                    </Space>
                                }
                            />
                            
                            {/* ACTION BUTTONS BASED ON STATUS */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(item.status === 'WAITING' || item.status === 'HOLD') && (
                                    <Button size="small" onClick={() => onPingTV(item)} icon={<NotificationOutlined />}>Call to Cabin</Button>
                                )}
                                
                                {item.status === 'CALLED' && (
                                    <Space>
                                        <Button size="small" onClick={() => onPingTV(item)} title="Ping TV Again" icon={<NotificationOutlined />} />
                                        <Button size="small" type="primary" onClick={() => onStartConsultation(item)} icon={<PlayCircleOutlined />}>Start</Button>
                                    </Space>
                                )}
                            </div>
                        </List.Item>
                    )}
                />
            )}
        </Card>
    );
};

export default WorkspaceQueueList;