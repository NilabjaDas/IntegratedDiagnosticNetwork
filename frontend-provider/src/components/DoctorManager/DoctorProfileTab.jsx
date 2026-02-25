import React from 'react';
import { Form, Input, Select, InputNumber, Row, Col, Typography, Divider, Switch, Card } from 'antd';

const { Title } = Typography;
const { Option } = Select;

const DoctorProfileTab = ({ rooms, templates = [] }) => {
    return (
        <div style={{ padding: '10px 0' }}>
            <Title level={5}>Personal Details</Title>
            <Row gutter={16}>
                <Col span={8}><Form.Item name="firstName" label="First Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="lastName" label="Last Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={8}>
                    {/* NEW: GENDER FIELD */}
                    <Form.Item name="gender" label="Gender">
                        <Select placeholder="Select">
                            <Option value="Male">Male</Option>
                            <Option value="Female">Female</Option>
                            <Option value="Other">Other</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}><Form.Item name="phone" label="Phone Number"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="email" label="Email Address"><Input /></Form.Item></Col>
            </Row>
            
            <Divider />
            
            <Title level={5}>Professional Profile</Title>
            <Row gutter={16}>
                <Col span={12}><Form.Item name="specialization" label="Specialization" rules={[{ required: true }]}><Input placeholder="e.g. Cardiology" /></Form.Item></Col>
                <Col span={12}><Form.Item name="registrationNumber" label="Medical Council Reg. No." rules={[{ required: true }]}><Input /></Form.Item></Col>
                
                {/* NEW: QUALIFICATIONS & EXPERIENCE */}
                <Col span={16}>
                    <Form.Item name="qualifications" label="Qualifications (Type & Press Enter)">
                        <Select mode="tags" placeholder="e.g. MBBS, MD, FRCP" open={false} />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="experienceYears" label="Experience (Years)">
                        <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                </Col>
            </Row>
            
            <Divider />
            
            <Title level={5}>Consultation Settings & Fees</Title>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="assignedCounterId" label="Assign to Physical Room">
                        <Select placeholder="Select a Consultation Room" allowClear>
                            {rooms.map(r => <Option key={r.counterId} value={r.counterId}>{r.name}</Option>)}
                        </Select>
                    </Form.Item>
                </Col>

                {/* NEW: PRESCRIPTION TEMPLATE */}
                <Col span={12}>
                    <Form.Item name="prescriptionTemplateId" label="Default Prescription Template">
                        <Select placeholder="Select a Template" allowClear>
                            {templates.map(t => <Option key={t._id} value={t._id}>{t.name}</Option>)}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item name="avgTimePerPatientMinutes" label="Avg Time / Patient (Mins)" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name="allowOverbooking" label="Allow Overbooking?" valuePropName="checked">
                        <Switch checkedChildren="Yes" unCheckedChildren="No" />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="newConsultation" label="Fee: New (₹)" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="followUpConsultation" label="Fee: Follow-Up (₹)" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item name="followUpValidityDays" label="Free Follow-up Validity (Days)">
                        <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                </Col>
            </Row>
            <Card size="small" title="Leave & Operational Settings" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item 
                            name={['leaveSettings', 'leaveLimitPerYear']} 
                            label="Yearly Leave Limit" 
                            initialValue={20}
                            rules={[{ required: true, message: 'Please set a limit' }]}
                            tooltip="Maximum full-day cancellations allowed per year before system blocks requests."
                        >
                            <InputNumber min={0} style={{ width: '100%' }} addonAfter="Days" />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>
        </div>
    );
};

export default DoctorProfileTab;