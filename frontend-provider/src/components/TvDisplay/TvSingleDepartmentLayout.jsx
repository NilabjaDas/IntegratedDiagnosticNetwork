import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Typography, Row, Col, Card, Tag } from 'antd';

const { Title, Text } = Typography;

const flashAnimation = keyframes`
  0% { background-color: #fff; transform: scale(1); }
  50% { background-color: #ffe58f; transform: scale(1.02); }
  100% { background-color: #fff; transform: scale(1); }
`;

const FlashingCard = styled(Card)`
  animation: ${props => props.flash ? flashAnimation : 'none'} 1s ease-in-out;
  border-radius: 12px;
  border-left: 8px solid ${props => props.themeColor || '#1890ff'};
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
`;

const TvSingleDepartmentLayout = ({ calledTokens, waitingTokens, flashingToken, themeColor }) => {
    return (
        <Row gutter={24} style={{ padding: 32, flex: 1 }}>
            {/* LEFT PANEL: CURRENTLY CALLED */}
            <Col span={14}>
                <Title level={3} style={{ color: themeColor, marginBottom: 24 }}>Please Proceed to Cabin</Title>
                {calledTokens.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 24 }}>No patients currently called.</Text>
                ) : (
                    calledTokens.map(token => (
                        <FlashingCard key={token._id} themeColor={themeColor} flash={flashingToken === token.tokenNumber}>
                            <Row justify="space-between" align="middle">
                                <Col>
                                    <Text type="secondary" style={{ fontSize: 20 }}>Token Number</Text>
                                    <Title level={1} style={{ margin: 0, fontSize: 64, color: '#262626' }}>{token.tokenNumber}</Title>
                                    <Text strong style={{ fontSize: 24, color: '#595959' }}>{token.patientDetails?.name}</Text>
                                </Col>
                                <Col style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 20 }}>Proceed To</Text>
                                    <Title level={2} style={{ margin: 0, color: themeColor, fontSize: 48 }}>
                                        {token.assignedCounterName || (token.department === 'Consultation' ? "Doctor Cabin" : token.department)}
                                    </Title>
                                </Col>
                            </Row>
                        </FlashingCard>
                    ))
                )}
            </Col>

            {/* RIGHT PANEL: WAITING QUEUE */}
            <Col span={10}>
                <Card style={{ height: '100%', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: 0 }}>
                    <div style={{ background: '#fafafa', padding: '16px 24px', borderBottom: '1px solid #f0f0f0', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                        <Title level={4} style={{ margin: 0 }}>Upcoming Patients</Title>
                    </div>
                    <div style={{ padding: 24 }}>
                        {waitingTokens.slice(0, 8).map((token) => (
                            <Row key={token._id} justify="space-between" align="middle" style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0', fontSize: 18 }}>
                                <Col>
                                    <Text strong>{token.tokenNumber}</Text>
                                    <span style={{ marginLeft: 16, color: '#595959' }}>{token.patientDetails?.name}</span>
                                </Col>
                                <Col>
                                    {token.estimatedTimeFormatted ? (
                                        <Tag color="blue" style={{ fontSize: 16, padding: '4px 8px' }}>ETA: {token.estimatedTimeFormatted}</Tag>
                                    ) : (
                                        <Text type="secondary">Waiting...</Text>
                                    )}
                                </Col>
                            </Row>
                        ))}
                        {waitingTokens.length > 8 && (
                            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
                                + {waitingTokens.length - 8} more in queue
                            </Text>
                        )}
                    </div>
                </Card>
            </Col>
        </Row>
    );
};

export default TvSingleDepartmentLayout;