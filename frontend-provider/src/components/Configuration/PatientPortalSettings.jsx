import React from 'react';
import { Form, Switch, Button, Typography, Divider } from 'antd';

const { Title, Text } = Typography;

const PatientPortalSettings = ({ data, onSave, loading }) => {
    const [form] = Form.useForm();

    return (
        <div style={{ padding: '32px' }}>
            <Title level={4}>Patient Portal & App Rules</Title>
            <Text type="secondary">Control what patients are allowed to do on their consumer app.</Text>
            <Divider />

            <Form 
                form={form} 
                layout="vertical" 
                initialValues={data?.patientPortalSettings} 
                onFinish={(values) => onSave({ patientPortalSettings: values })}
            >
                <Form.Item label="Allow Online Booking" name="allowOnlineBooking" valuePropName="checked" extra="If disabled, patients can only view catalogs but must call to book.">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Form.Item label="Allow Rescheduling" name="allowRescheduling" valuePropName="checked">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Form.Item label="Allow Cancellations" name="allowCancellations" valuePropName="checked" extra="Let patients cancel appointments directly from the app.">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Form.Item label="Auto-Approve Bookings" name="autoApproveBookings" valuePropName="checked" extra="If disabled, reception staff must manually approve new appointments.">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Form.Item label="Show Test Prices Publicly" name="showTestPrices" valuePropName="checked" extra="Turn off for B2B labs who don't want direct pricing visible.">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Form.Item label="Allow Patients to Download Reports" name="allowReportDownload" valuePropName="checked" extra="If disabled, reports must be physically collected or sent via WhatsApp.">
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ marginTop: '16px' }}>
                    Save Portal Settings
                </Button>
            </Form>
        </div>
    );
};

export default PatientPortalSettings;