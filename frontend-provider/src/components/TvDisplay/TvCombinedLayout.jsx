import React from 'react';
import { Row, Col, Card, Typography, Tag, Divider, Space } from 'antd';

const { Title, Text } = Typography;

const TvCombinedLayout = ({ calledTokens, waitingTokens, themeColor }) => {
    // 1. Find all unique departments currently active
    const allTokens = [...calledTokens, ...waitingTokens];
    const uniqueDepartments = [...new Set(allTokens.map(t => t.department))];

    return (
        <div style={{ padding: 32, flex: 1, width: '100%' }}>
            {uniqueDepartments.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: 100 }}>
                    <Title level={3} type="secondary">No active queues at the moment.</Title>
                </div>
            ) : (
                // 2. Render a dynamic Grid / Quadrant
                <Row gutter={[24, 24]}>
                    {uniqueDepartments.map(dept => {
                        const dCalled = calledTokens.filter(t => t.department === dept);
                        const dWaiting = waitingTokens.filter(t => t.department === dept);

                        return (
                            <Col span={12} key={dept}>
                                <Card 
                                    title={<Title level={3} style={{ color: themeColor, margin: 0 }}>{dept}</Title>} 
                                    style={{ height: '100%', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                >
                                    {/* Active Patient */}
                                    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '2px dashed #f0f0f0' }}>
                                        <Text type="secondary">Currently Calling</Text>
                                        {dCalled.length > 0 ? (
                                            <Row justify="space-between" align="middle" style={{ marginTop: 8 }}>
                                                <Col>
                                                    <Title level={2} style={{ margin: 0 }}>{dCalled[0].tokenNumber}</Title>
                                                    <Text strong style={{ fontSize: 18, color: '#595959' }}>{dCalled[0].patientDetails?.name}</Text>
                                                </Col>
                                                <Col style={{ textAlign: 'right' }}>
                                                    <Tag color="green" style={{ fontSize: 20, padding: '4px 12px' }}>
                                                        Desk: {dCalled[0].assignedCounterName || 'Cabin'}
                                                    </Tag>
                                                </Col>
                                            </Row>
                                        ) : (
                                            <div style={{ marginTop: 8 }}><Text type="secondary">None</Text></div>
                                        )}
                                    </div>

                                    {/* Waiting List Preview */}
                                    <Text type="secondary">Next in line</Text>
                                    <div style={{ marginTop: 8 }}>
                                        {dWaiting.slice(0, 3).map(token => (
                                            <Row key={token._id} justify="space-between" style={{ padding: '6px 0', fontSize: 16 }}>
                                                <Col><Text strong>{token.tokenNumber}</Text> <span style={{color:'#888', marginLeft: 8}}>{token.patientDetails?.name}</span></Col>
                                                <Col>{token.estimatedTimeFormatted ? <Tag color="blue">{token.estimatedTimeFormatted}</Tag> : 'Waiting'}</Col>
                                            </Row>
                                        ))}
                                        {dWaiting.length > 3 && <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>+ {dWaiting.length - 3} more</Text>}
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}
        </div>
    );
};

export default TvCombinedLayout;