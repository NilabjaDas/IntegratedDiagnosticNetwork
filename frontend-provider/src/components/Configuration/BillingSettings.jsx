import React from 'react';
import { Form, Input, InputNumber, Button, Row, Col, Typography, Divider } from 'antd';

const { Title, Text } = Typography;

const BillingSettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();

    const handleFinish = (values) => {
        onSave({ billing: { ...data.billing, ...values } });
    };

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>Billing & Taxation Configuration</Title>
            <Text type="secondary">Define tax identification numbers and default pricing behaviors.</Text>
            <Divider />

            <Form 
                form={form} 
                layout="vertical" 
                initialValues={data?.billing} 
                onFinish={handleFinish}
            >
                <Row gutter={32}>
                    <Col span={12}>
                        <Form.Item 
                            label="GSTIN / Corporate Tax ID" 
                            name="gstin" 
                            extra="This ID will be permanently affixed to printed financial invoices."
                        >
                            <Input size="large" placeholder="E.g. 27AADCB2230M1Z2" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item 
                            label="Business PAN / Registration Number" 
                            name="pan"
                            extra="Secondary tax identification."
                        >
                            <Input size="large" placeholder="E.g. ABCDE1234F" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={32} style={{ marginTop: '16px' }}>
                    <Col span={8}>
                        <Form.Item 
                            label="Default Tax Percentage (%)" 
                            name="taxPercentage"
                            extra="Automatically applied to tests unless overridden."
                        >
                            <InputNumber size="large" style={{ width: '100%' }} min={0} max={100} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item 
                            label="Default Currency Code" 
                            name="defaultCurrency"
                            extra="ISO currency code (e.g., INR, USD, EUR)"
                        >
                            <Input size="large" placeholder="INR" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item 
                            label="Standard Invoice Prefix" 
                            name="invoicePrefix"
                            extra="Prefix specifically used for financial ledgers."
                        >
                            <Input size="large" placeholder="INV" />
                        </Form.Item>
                    </Col>
                </Row>

                <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ marginTop: '16px' }}>
                    Save Billing Settings
                </Button>
            </Form>
        </div>
    );
};

export default BillingSettings;