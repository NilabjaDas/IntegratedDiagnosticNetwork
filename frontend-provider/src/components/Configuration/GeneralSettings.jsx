import React from 'react';
import { Form, Input, Select, Button, Row, Col, Typography, Divider, Switch } from 'antd';

const { Title, Text } = Typography;
const { Option } = Select;

const GeneralSettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();

    const handleFinish = (values) => {
        onSave({ settings: { ...data.settings, ...values } });
    };

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>Localization & Regional Settings</Title>
            <Text type="secondary">Configure timezones, languages, and sequence generation patterns.</Text>
            <Divider />

            <Form 
                form={form} 
                layout="vertical" 
                initialValues={data?.settings} 
                onFinish={handleFinish}
            >
                <Row gutter={32}>
                    <Col span={8}>
                        <Form.Item 
                            label="System Timezone" 
                            name="timezone"
                            extra="All reports and logs will strictly use this timezone."
                        >
                            <Select size="large">
                                <Option value="Asia/Kolkata">Asia/Kolkata (IST)</Option>
                                <Option value="America/New_York">America/New_York (EST)</Option>
                                <Option value="Europe/London">Europe/London (GMT)</Option>
                                <Option value="Australia/Sydney">Australia/Sydney (AEST)</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Default Locale" name="locale">
                            <Select size="large">
                                <Option value="en-IN">English (India)</Option>
                                <Option value="en-US">English (USA)</Option>
                                <Option value="en-GB">English (UK)</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Default Language" name="defaultLanguage">
                            <Select size="large">
                                <Option value="en">English</Option>
                                <Option value="hi">Hindi</Option>
                                <Option value="es">Spanish</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>
                
                <Divider />
                <Title level={4}>Global Formatting</Title>
                <Text type="secondary">Use placeholders like {"{YYMMDD}"}, {"{SEQ}"}, and {"{PREFIX}"} to automatically generate IDs.</Text>

                <Row gutter={32} style={{ marginTop: '24px' }}>
                    <Col span={12}>
                        <Form.Item 
                            label="Order & Invoice ID Format" 
                            name="orderFormat" 
                            extra="Example output: ORD-250320-001"
                        >
                            <Input size="large" placeholder="ORD-{YYMMDD}-{SEQ}" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item 
                            label="Sample Barcode Prefix" 
                            name="sampleBarcodePrefix"
                            extra="The specific alphabetic code prepended to lab samples."
                        >
                            <Input size="large" placeholder="LAB" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item 
                            label="Sample Barcode Format" 
                            name="barcodeFormat"
                            extra="Example output: LAB-250320-001"
                        >
                            <Input size="large" placeholder="{PREFIX}-{YYMMDD}-{SEQ}" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider />
                <Title level={4}>Queue Management Defaults</Title>

                <Row gutter={32} style={{ marginTop: '24px' }}>
                    <Col span={12}>
                        <Form.Item 
                            label="Queue Token Number Format" 
                            name={['queue', 'tokenFormat']}
                            extra="Format printed on patient tokens and shown on TV displays. Example: PAT-001"
                        >
                            <Input size="large" placeholder="{OUTLET}-{NUMBER}" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item 
                            label="Incremental Per Outlet" 
                            name={['queue', 'incrementalPerOutlet']} 
                            valuePropName="checked"
                            extra="If enabled, tokens reset sequence per physical outlet."
                        >
                            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                        </Form.Item>
                    </Col>
                </Row>
                
                <Button type="primary" htmlType="submit" size="large" loading={loading}>
                    Save General Formats
                </Button>
            </Form>
        </div>
    );
};

export default GeneralSettings;