import React from 'react';
import { Form, Input, Button, Row, Col, Typography, Divider, Switch, Alert } from 'antd';

const { Title, Text } = Typography;

const IntegrationSettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();

    const handleFinish = (values) => {
        // Deep merge values so we don't accidentally wipe out secrets that weren't returned by the API
        onSave({ integrations: { ...data.integrations, ...values } });
    };

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>External Integrations</Title>
            <Text type="secondary">Connect your system to WhatsApp, PACS servers, and more.</Text>
            <Divider />

            <Alert 
                message="Security Notice" 
                description="For security reasons, API Keys and Access Tokens are not displayed here. If you enter a new token and save, it will overwrite the existing one." 
                type="info" 
                showIcon 
                style={{ marginBottom: '24px' }}
            />

            <Form 
                form={form} 
                layout="vertical" 
                initialValues={data?.integrations} 
                onFinish={handleFinish}
            >
                <Title level={5}>WhatsApp (Meta Business API)</Title>
                <Form.Item name={['whatsapp', 'enabled']} valuePropName="checked">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>
                
                <Row gutter={32}>
                    <Col span={12}>
                        <Form.Item label="Phone Number ID" name={['whatsapp', 'phoneNumberId']}>
                            <Input size="large" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="WABA ID" name={['whatsapp', 'wabaId']}>
                            <Input size="large" />
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Form.Item 
                            label="Permanent Access Token" 
                            name={['whatsapp', 'accessToken']}
                            extra="Leave blank to keep current token. Enter a new value to update."
                        >
                            <Input.Password size="large" placeholder="Enter new Meta Access Token..." />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider />

                <Title level={5}>PACS Server (Radiology Imaging)</Title>
                <Form.Item name={['pacs', 'enabled']} valuePropName="checked">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>
                <Row gutter={32}>
                    <Col span={12}>
                        <Form.Item label="Orthanc Server URL" name={['pacs', 'orthancUrl']}>
                            <Input size="large" placeholder="http://192.168.1.100:8042" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="AE Title" name={['pacs', 'aeTitle']}>
                            <Input size="large" placeholder="ORTHANC" />
                        </Form.Item>
                    </Col>
                </Row>

                <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ marginTop: '20px' }}>
                    Save Integrations
                </Button>
            </Form>
        </div>
    );
};

export default IntegrationSettings;