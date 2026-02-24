import React from 'react';
import { Form, InputNumber, Switch, Button, Row, Col, Typography, Divider } from 'antd';

const { Title, Text } = Typography;

const ComplianceSettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>Data Governance & Compliance</Title>
            <Text type="secondary">Manage legal retention rules and strict compliance mode toggles.</Text>
            <Divider />

            <Form 
                form={form} 
                layout="vertical" 
                initialValues={data?.compliance} 
                onFinish={(values) => onSave({ compliance: values })}
            >
                <Title level={5}>Data Retention</Title>
                <Row gutter={32} style={{ marginBottom: '24px' }}>
                    <Col span={12}>
                        <Form.Item label="Patient Record Retention (Years)" name="patientRecordRetentionYears" extra="How long to keep patient history before purging (legal standard is often 7 years).">
                            <InputNumber size="large" style={{ width: '100%' }} min={1} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="System Audit Log Retention (Days)" name="auditLogRetentionDays" extra="Logs older than this will be auto-deleted to save space.">
                            <InputNumber size="large" style={{ width: '100%' }} min={30} />
                        </Form.Item>
                    </Col>
                </Row>

                <Title level={5}>Regulatory Standards</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                    Enabling these toggles enforces stricter security flows (e.g., masking patient names on public screens, requiring PINs to download PDFs).
                </Text>

                <Form.Item label="HIPAA Compliance Mode (US)" name="hipaaCompliant" valuePropName="checked">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Form.Item label="GDPR Compliance Mode (EU)" name="gdprCompliant" valuePropName="checked">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Form.Item label="ABDM Compliance (India)" name="abdmCompliant" valuePropName="checked" extra="Ayushman Bharat Digital Mission requirements.">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ marginTop: '16px' }}>
                    Save Compliance Rules
                </Button>
            </Form>
        </div>
    );
};

export default ComplianceSettings;