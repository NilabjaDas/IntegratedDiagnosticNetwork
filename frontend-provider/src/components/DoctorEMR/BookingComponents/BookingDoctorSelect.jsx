import React from 'react';
import { Form, Select, Row, Col, Typography, Card, Tag, Checkbox, Space } from 'antd';
import { IdcardOutlined, CloseCircleOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Option } = Select;
const { Text } = Typography;

const BookingDoctorSelect = ({
    activeDoctors, selectedDoctorId, setSelectedDoctorId, activeDoctor, activeDoctorCabin,
    scheduleDate, availableShifts, selectedShift, setSelectedShift,
    isFollowUp, setIsFollowUp, totalAmount
}) => {
    return (
        <div style={{ flex: 1, padding: "16px", background: "#fafafa", overflowY: "auto" }}>
            <Card size="small" bordered={false} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', height: '100%' }}>
                <Row gutter={32} style={{ height: '100%' }}>
                    
                    {/* --- LEFT COLUMN: DOCTOR PROFILE --- */}
                    {activeDoctor && (
                        <Col span={11} style={{ height: '100%' }}>
                            <div style={{ height: '100%', padding: "16px", background: "#f0f5ff", borderRadius: 8, border: "1px solid #adc6ff" }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #adc6ff', paddingBottom: 8 }}>
                                    <IdcardOutlined style={{ fontSize: 18, color: '#2f54eb', marginRight: 8 }} />
                                    <Text strong style={{ color: '#2f54eb', fontSize: 15 }}>Doctor Profile & Assignment</Text>
                                </div>
                                
                                <Space direction="vertical" size="small" style={{ width: '100%', fontSize: 13 }}>
                                    <Row>
                                        <Col span={8}><Text type="secondary">Specialization:</Text></Col>
                                        <Col span={16}><strong>{activeDoctor.professionalInfo?.specialization || "N/A"}</strong></Col>
                                    </Row>
                                    <Row>
                                        <Col span={8}><Text type="secondary">Qualifications:</Text></Col>
                                        <Col span={16}><strong>{activeDoctor.professionalInfo?.qualifications?.join(', ') || "N/A"}</strong></Col>
                                    </Row>
                                    <Row>
                                        <Col span={8}><Text type="secondary">Experience:</Text></Col>
                                        <Col span={16}><strong>{activeDoctor.professionalInfo?.experienceYears ? `${activeDoctor.professionalInfo.experienceYears} Years` : "N/A"}</strong></Col>
                                    </Row>
                                    <Row>
                                        <Col span={8}><Text type="secondary">Reg Number:</Text></Col>
                                        <Col span={16}><strong>{activeDoctor.professionalInfo?.registrationNumber || "N/A"}</strong></Col>
                                    </Row>
                                    <Row>
                                        <Col span={8}><Text type="secondary">Gender:</Text></Col>
                                        <Col span={16}><strong>{activeDoctor.personalInfo?.gender || "N/A"}</strong></Col>
                                    </Row>
                                    <Row>
                                        <Col span={8}><Text type="secondary">Contact:</Text></Col>
                                        <Col span={16}><strong>{activeDoctor.personalInfo?.publicContact || "N/A"}</strong></Col>
                                    </Row>
                                    
                                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#e6f7ff', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text strong style={{ color: '#0050b3' }}>Assigned Cabin</Text>
                                        <Tag color="geekblue" style={{ margin: 0, fontSize: 12, padding: '2px 8px' }}>
                                            {activeDoctorCabin ? `${activeDoctorCabin.name} (Rm: ${activeDoctorCabin.roomName})` : "Unassigned"}
                                        </Tag>
                                    </div>
                                </Space>
                            </div>
                        </Col>
                    )}

                    {/* --- RIGHT COLUMN: ACTION & INPUTS --- */}
                    <Col span={activeDoctor ? 13 : 24} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div>
                         <Form.Item label={<Text strong>Select Doctor</Text>} required style={{ marginBottom: 16 }}>
    <Select 
        showSearch 
        placeholder="Choose a doctor..."
        value={selectedDoctorId}
        onChange={setSelectedDoctorId}
        size="large"
        // 1. Add custom filter logic
        filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
    >
        {activeDoctors?.map(doc => (
            <Option 
                key={doc._id} 
                value={doc._id}
                // 2. Pass a combined plain text string to search against
                label={`Dr. ${doc.personalInfo?.firstName} ${doc.personalInfo?.lastName} ${doc.professionalInfo?.specialization}`}
            >
                Dr. {doc.personalInfo?.firstName} {doc.personalInfo?.lastName} - <Text type="secondary" style={{fontSize: 12}}>{doc.professionalInfo?.specialization}</Text>
            </Option>
        ))}
    </Select>
</Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label={<Text strong>Selected Date</Text>} required style={{ marginBottom: 16 }}>
                                        <div style={{ padding: '7px 12px', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text strong>{scheduleDate.format('ddd, DD MMM')}</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>(Pick from right)</Text>
                                        </div>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    {selectedDoctorId && (
                                        <Form.Item label={<Text strong>Available Shift</Text>} name="shiftName" style={{ marginBottom: 16 }}>
                                            <Select value={selectedShift} onChange={setSelectedShift} disabled={availableShifts.length === 0} size="large">
                                                {availableShifts.map(s => (
                                                    <Option key={s.shiftName} value={s.shiftName}>{s.shiftName} ({moment(s.startTime, "hh:mm").format("h:mma")} - {moment(s.endTime, "hh:mm").format("h:mma")})</Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    )}
                                </Col>
                            </Row>

                            {selectedDoctorId && availableShifts.length === 0 && (
                                <div style={{ padding: 12, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 6, color: '#cf1322', textAlign: 'center', fontSize: 13, marginTop: 8 }}>
                                    <CloseCircleOutlined style={{ marginRight: 6 }} />
                                    <strong>Doctor is on leave or unavailable on this date.</strong><br/>
                                    <span style={{ fontSize: 12, color: '#820014' }}>Please select a different date from the calendar.</span>
                                </div>
                            )}
                        </div>

                        {/* --- THIS BLOCK IS PUSHED TO THE BOTTOM USING margin-top: auto --- */}
                        {selectedDoctorId && availableShifts.length > 0 && (
                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                                <Checkbox checked={isFollowUp} onChange={(e) => setIsFollowUp(e.target.checked)}>
                                    <Text strong>Mark as Follow-up Visit</Text>
                                </Checkbox>
                                <div style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Consultation Fee</Text>
                                    <Text strong style={{ fontSize: 20, color: '#52c41a', lineHeight: 1 }}>₹{totalAmount}</Text>
                                </div>
                            </div>
                        )}
                    </Col>
                </Row>
            </Card>
        </div>
    );
};

export default BookingDoctorSelect;